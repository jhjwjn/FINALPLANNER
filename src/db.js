import { getAuthUser, getSupabaseClient, isSupabaseConfigured } from "./supabase.js";

export const DB_NAME = "life_planner_prototype";
export const DB_VERSION = 2;
export const STORES = [
  "settings",
  "categories",
  "schedule_templates",
  "schedule_events",
  "repeat_rules",
  "goals",
  "tasks",
  "habits",
  "habit_logs",
  "projects",
  "notes",
  "dreams",
  "reviews"
];

const INTERNAL_STORES = ["sync_queue"];
const ALL_STORES = [...STORES, ...INTERNAL_STORES];
const SYNC_TABLE = "planner_records";

let dbPromise;
let syncTimer = null;
let syncRunning = false;

export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : false;
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      ALL_STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(store, mode = "readonly") {
  const db = await openDb();
  return db.transaction(store, mode).objectStore(store);
}

async function readAll(store) {
  const objectStore = await tx(store);
  return new Promise((resolve, reject) => {
    const request = objectStore.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function readOne(store, id) {
  const objectStore = await tx(store);
  return new Promise((resolve, reject) => {
    const request = objectStore.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function writeOne(store, value) {
  const objectStore = await tx(store, "readwrite");
  return new Promise((resolve, reject) => {
    const request = objectStore.put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

async function deleteOne(store, id) {
  const objectStore = await tx(store, "readwrite");
  return new Promise((resolve, reject) => {
    const request = objectStore.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function writeMany(store, values) {
  const db = await openDb();
  const transaction = db.transaction(store, "readwrite");
  const objectStore = transaction.objectStore(store);
  values.forEach((value) => objectStore.put(value));
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function queueSync(action, store, payload) {
  if (!STORES.includes(store)) return;
  const id = `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await writeOne("sync_queue", {
    id,
    action,
    store,
    recordId: payload?.id || payload,
    payload,
    createdAt: new Date().toISOString()
  });
}

async function getRemoteOwnerId(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Supabase login is required.");
  return data.user.id;
}

async function pushRecord(client, store, value) {
  const ownerId = await getRemoteOwnerId(client);
  const { error } = await client.from(SYNC_TABLE).upsert({
    owner_id: ownerId,
    store,
    id: value.id,
    data: value,
    updated_at: value.updatedAt || new Date().toISOString()
  }, { onConflict: "owner_id,store,id" });
  if (error) throw error;
}

async function deleteRecord(client, store, id) {
  const ownerId = await getRemoteOwnerId(client);
  const { error } = await client
    .from(SYNC_TABLE)
    .delete()
    .eq("owner_id", ownerId)
    .eq("store", store)
    .eq("id", id);
  if (error) throw error;
}

export async function flushSyncQueue() {
  const client = getSupabaseClient();
  if (!client || !isOnline()) return { ok: false, pending: (await readAll("sync_queue")).length };
  if (syncRunning) return { ok: false, pending: (await readAll("sync_queue")).length, busy: true };

  syncRunning = true;
  const queue = (await readAll("sync_queue")).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  let synced = 0;
  try {
    await getRemoteOwnerId(client);
    for (const item of queue) {
      if (item.action === "delete") await deleteRecord(client, item.store, item.recordId);
      else await pushRecord(client, item.store, item.payload);
      await deleteOne("sync_queue", item.id);
      synced += 1;
    }
    dispatchSyncEvent({ ok: true, synced, pending: 0 });
    return { ok: true, synced, pending: 0 };
  } catch (error) {
    console.warn("Supabase sync paused:", error);
    const result = { ok: false, synced, pending: Math.max(0, queue.length - synced), error };
    dispatchSyncEvent(result);
    return result;
  } finally {
    syncRunning = false;
  }
}

function syncSoon() {
  if (!isOnline()) return;
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    flushSyncQueue().catch((error) => console.warn("Supabase sync failed:", error));
  }, 1200);
}

function dispatchSyncEvent(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("planner-sync", { detail }));
}

export async function all(store) {
  return readAll(store);
}

export async function get(store, id) {
  return readOne(store, id);
}

export async function put(store, value, options = {}) {
  const next = { ...value, updatedAt: value.updatedAt || new Date().toISOString() };
  await writeOne(store, next);
  if (!options.localOnly) {
    await queueSync("upsert", store, next);
    syncSoon();
  }
  return next;
}

export async function remove(store, id, options = {}) {
  await deleteOne(store, id);
  if (!options.localOnly) {
    await queueSync("delete", store, id);
    syncSoon();
  }
}

export async function bulkPut(store, values, options = {}) {
  const now = new Date().toISOString();
  const nextValues = values.map((value) => ({ ...value, updatedAt: value.updatedAt || now }));
  await writeMany(store, nextValues);
  if (!options.localOnly) {
    for (const value of nextValues) await queueSync("upsert", store, value);
    syncSoon();
  }
}

export async function clearStore(store, options = {}) {
  const oldValues = await readAll(store);
  const objectStore = await tx(store, "readwrite");
  await new Promise((resolve, reject) => {
    const request = objectStore.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  if (!options.localOnly) {
    for (const value of oldValues) await queueSync("delete", store, value.id);
    syncSoon();
  }
}

export async function exportBackup() {
  const backup = {};
  for (const store of STORES) backup[store] = await all(store);
  return backup;
}

export async function importBackupObject(backup) {
  const now = new Date().toISOString();
  for (const store of STORES) await clearStore(store);
  for (const store of STORES) {
    const values = Array.isArray(backup[store]) ? backup[store] : [];
    if (values.length) await bulkPut(store, values.map((item) => ({ ...item, updatedAt: item.updatedAt || now })));
  }
}

export async function syncAllToSupabase() {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: new Error("Supabase is not configured.") };
  for (const store of STORES) {
    const values = await all(store);
    for (const value of values) await pushRecord(client, store, value);
  }
  await flushSyncQueue();
  return { ok: true };
}

export async function pullAllFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: new Error("Supabase is not configured.") };
  const ownerId = await getRemoteOwnerId(client);
  const { data, error } = await client
    .from(SYNC_TABLE)
    .select("store,id,data,updated_at")
    .eq("owner_id", ownerId);
  if (error) throw error;

  const grouped = new Map();
  (data || []).forEach((row) => {
    if (!STORES.includes(row.store)) return;
    if (!grouped.has(row.store)) grouped.set(row.store, []);
    grouped.get(row.store).push({ ...row.data, id: row.id, updatedAt: row.data?.updatedAt || row.updated_at });
  });

  for (const [store, values] of grouped.entries()) {
    await bulkPut(store, values, { localOnly: true });
  }
  return { ok: true, count: data?.length || 0 };
}

export async function dbHealthCheck() {
  const pending = (await readAll("sync_queue")).length;
  if (!isOnline()) return { online: false, configured: isSupabaseConfigured(), connected: false, pending };
  const client = getSupabaseClient();
  if (!client) return { online: true, configured: false, connected: false, pending };

  try {
    const user = await getAuthUser();
    if (!user) return { online: true, configured: true, connected: false, authenticated: false, pending };
    const { count, error } = await client
      .from(SYNC_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    return { online: true, configured: true, connected: !error, authenticated: true, pending, remoteCount: count || 0, error };
  } catch (error) {
    return { online: true, configured: true, connected: false, pending, error };
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushSyncQueue().catch((error) => console.warn("Supabase sync failed:", error));
  });
  window.setInterval(() => {
    if (isOnline()) flushSyncQueue().catch((error) => console.warn("Supabase sync failed:", error));
  }, 60000);
}
