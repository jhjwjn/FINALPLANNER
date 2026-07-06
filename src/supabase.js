// Supabase is optional. The app always saves to IndexedDB first, then syncs
// here when these values are configured and the browser is online.
export const SUPABASE_URL = "https://fpfjclkuzysclxgeuobp.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZmpjbGt1enlzY2x4Z2V1b2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMDcxNjksImV4cCI6MjA5ODc4MzE2OX0.qsSj5O16yysHW4R6KaEpj0YAZIEpkqYRnjvlp5Ad8EM";

let client = null;

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_") &&
    !SUPABASE_ANON_KEY.includes("YOUR_")
  );
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined" || !window.supabase?.createClient) return null;
  if (!client) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = client;
  }
  return client;
}

export function isSupabaseReady() {
  return Boolean(getSupabaseClient());
}

export async function getAuthUser() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return data?.subscription || { unsubscribe: () => {} };
}
