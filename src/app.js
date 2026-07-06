import {
  STORES,
  all,
  get,
  put,
  remove,
  bulkPut,
  dbHealthCheck,
  exportBackup,
  flushSyncQueue,
  importBackupObject,
  pullAllFromSupabase,
  syncAllToSupabase
} from "./db.js";
import { getAuthUser, isSupabaseConfigured, isSupabaseReady, onAuthStateChange, signInWithGoogle, signOut } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const today = () => iso(new Date());
const pad = (n) => String(n).padStart(2, "0");
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateFromISO = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (value, days) => {
  const d = dateFromISO(value);
  d.setDate(d.getDate() + days);
  return iso(d);
};
const addMonths = (value, months) => {
  const d = dateFromISO(value);
  d.setMonth(d.getMonth() + months, 1);
  return iso(d);
};
const weekStart = (value) => {
  const d = dateFromISO(value);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return iso(d);
};
const fmtMD = (value) => {
  const d = dateFromISO(value);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};
const minutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const duration = (a, b) => Math.max(30, minutes(b) - minutes(a));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const hourTime = (hour) => `${pad(hour)}:00`;
const slotTime = (hour, minute = 0) => `${pad(hour)}:${pad(minute)}`;
const timeFromMinutes = (value) => {
  const safe = clamp(value, 0, 23 * 60 + 59);
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
};

const monthStart = (value = today()) => `${value.slice(0, 8)}01`;
const monthEnd = (value = today()) => {
  const [y, m] = value.split("-").map(Number);
  return iso(new Date(y, m, 0));
};
const yearStart = (value = today()) => `${value.slice(0, 4)}-01-01`;
const yearEnd = (value = today()) => `${value.slice(0, 4)}-12-31`;
const monthLabel = (value = today()) => {
  const d = dateFromISO(value);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
};
const validTimeRange = (startTime, endTime) => minutes(endTime) > minutes(startTime);
const confirmDanger = (message) => window.confirm(message);

const themes = {
  paper: {
    label: "Paper Calm",
    dark: false,
    colors: ["#5f6f52", "#b99470", "#a67c7c", "#6b8a9f", "#8b7aa8"],
    vars: {
      bg: "#f5f1ea",
      shell: "#ebe5db",
      card: "#fffdf9",
      soft: "#f7f2ea",
      text: "#202124",
      muted: "#77736b",
      line: "#dfd7ca",
      accent: "#5f6f52",
      accent2: "#b99470",
      danger: "#c75146"
    }
  },
  mist: {
    label: "Mist Blue",
    dark: false,
    colors: ["#4d7c8a", "#7a9e9f", "#b8a27a", "#7d84b2", "#ba7f7f"],
    vars: {
      bg: "#eef3f4",
      shell: "#dfe9eb",
      card: "#fbfefe",
      soft: "#edf6f7",
      text: "#172326",
      muted: "#637276",
      line: "#d2e0e3",
      accent: "#4d7c8a",
      accent2: "#7d84b2",
      danger: "#c65353"
    }
  },
  mono: {
    label: "Soft Mono",
    dark: false,
    colors: ["#252525", "#6d6d6d", "#9d8771", "#687a8f", "#8a7b8f"],
    vars: {
      bg: "#f4f4f1",
      shell: "#e6e4df",
      card: "#ffffff",
      soft: "#eeeeea",
      text: "#191919",
      muted: "#707070",
      line: "#d8d6d1",
      accent: "#252525",
      accent2: "#687a8f",
      danger: "#b94b4b"
    }
  },
  neon: {
    label: "Dark Sage",
    dark: true,
    colors: ["#8db7a3", "#9aa9c7", "#b9a7c8", "#d4bd8a", "#c58f8f"],
    vars: {
      bg: "#050505",
      shell: "#0b0b0b",
      card: "#111111",
      soft: "#181818",
      text: "#f1f0ec",
      muted: "#a7a39b",
      line: "#30302e",
      accent: "#8db7a3",
      accent2: "#9aa9c7",
      danger: "#d98585"
    }
  },
  amber: {
    label: "Dark Brass",
    dark: true,
    colors: ["#c9ad74", "#8fae9f", "#9ea7bd", "#b9938f", "#a996bd"],
    vars: {
      bg: "#050505",
      shell: "#0c0c0b",
      card: "#121211",
      soft: "#1b1a18",
      text: "#f2eee3",
      muted: "#aaa396",
      line: "#302d28",
      accent: "#c9ad74",
      accent2: "#8fae9f",
      danger: "#cf7f76"
    }
  },
  violet: {
    label: "Dark Plum",
    dark: true,
    colors: ["#a994bd", "#91a7c5", "#8eb5ad", "#c4a47d", "#bd8f9a"],
    vars: {
      bg: "#040404",
      shell: "#0b0a0b",
      card: "#121113",
      soft: "#1a181d",
      text: "#f2eef6",
      muted: "#aaa2ae",
      line: "#2f2a34",
      accent: "#a994bd",
      accent2: "#91a7c5",
      danger: "#d88494"
    }
  }
};

const navItems = [
  ["today", "오늘"],
  ["planner", "주간계획"],
  ["monthly", "월간계획"],
  ["dashboard", "주간대시보드"],
  ["daily", "일간"],
  ["tasks", "할 일"],
  ["habits", "습관"],
  ["goals", "목표"],
  ["projects", "프로젝트"],
  ["notes", "메모"],
  ["review", "회고"],
  ["dreams", "꿈/비전"],
  ["database", "데이터"],
  ["settings", "설정"],
  ["ai", "AI"]
];

const state = {
  view: "today",
  weekStart: weekStart(today()),
  monthStart: monthStart(today()),
  selectedDate: today(),
  selectedCategory: "all",
  selectedProject: "",
  dataTab: "events",
  query: "",
  theme: "paper",
  modal: null,
  modalData: null,
  drag: null,
  syncStatus: null,
  authUser: null,
  authReady: false,
  suppressClickUntil: 0,
  toast: ""
};

const memory = {
  settings: null,
  categories: [],
  templates: [],
  events: [],
  repeats: [],
  goals: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  projects: [],
  notes: [],
  dreams: [],
  reviews: []
};

async function seed() {
  const settings = await get("settings", "app");
  if (!settings) {
    await put("settings", { id: "app", theme: "paper", weekStart: "월", focusMode: false, updatedAt: new Date().toISOString() });
  }
  if ((await all("categories")).length === 0) {
    const now = new Date().toISOString();
    await bulkPut("categories", ["공부", "운동", "독서", "프로젝트", "생활", "휴식"].map((name, index) => ({
      id: uid("cat"),
      name,
      sortOrder: index,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })));
  }
  const categories = await all("categories");
  const cat = (name) => categories.find((c) => c.name === name)?.id || categories[0]?.id;
  const baseToday = today();
  if ((await all("schedule_events")).length === 0) {
    await bulkPut("schedule_events", [
      eventSeed("전자기학 2장", baseToday, "09:00", "10:30", cat("공부"), 0, "교재 예제 5개"),
      eventSeed("웨이트", baseToday, "18:30", "19:30", cat("운동"), 1, "하체"),
      eventSeed("프로젝트 설계", addDays(baseToday, 1), "13:00", "15:00", cat("프로젝트"), 3, "Planner 기능 구조"),
      eventSeed("독서", addDays(baseToday, 2), "21:00", "21:30", cat("독서"), 2, "회고와 함께"),
      eventSeed("모의고사 복습", addDays(baseToday, 4), "10:00", "12:00", cat("공부"), 4, "")
    ]);
  }
  if ((await all("schedule_templates")).length === 0) {
    await bulkPut("schedule_templates", [
      templateSeed("전자기학 공부", cat("공부"), 0, "기본 90분"),
      templateSeed("웨이트", cat("운동"), 1, "운동 후 기록"),
      templateSeed("독서", cat("독서"), 2, "30분 이상"),
      templateSeed("프로젝트 설계", cat("프로젝트"), 3, "결과물 기준")
    ]);
  }
  if ((await all("tasks")).length === 0) {
    await bulkPut("tasks", [
      taskSeed("전자기학 오답 정리", baseToday, "high", cat("공부")),
      taskSeed("주간 계획 빈 시간 확인", baseToday, "medium", cat("생활")),
      taskSeed("프로젝트 DB 구조 메모", addDays(baseToday, 1), "medium", cat("프로젝트"))
    ]);
  }
  if ((await all("habits")).length === 0) {
    await bulkPut("habits", [
      habitSeed("기상 후 물 마시기", "daily", cat("생활")),
      habitSeed("운동", "weekly", cat("운동")),
      habitSeed("독서 20분", "daily", cat("독서")),
      habitSeed("취침 전 회고", "daily", cat("생활"))
    ]);
  }
  if ((await all("goals")).length === 0) {
    await bulkPut("goals", [
      goalSeed("전자기학 핵심 개념 3개 설명 가능", "weekly", "task", "3", cat("공부")),
      goalSeed("운동 4회 완료", "weekly", "completion", "4", cat("운동")),
      goalSeed("독서 2챕터 요약", "monthly", "task", "2", cat("독서"))
    ]);
  }
  if ((await all("projects")).length === 0) {
    const p1 = projectSeed("Planner 앱 완성", cat("프로젝트"));
    const p2 = projectSeed("개인 루틴 안정화", cat("생활"));
    await bulkPut("projects", [p1, p2]);
    await bulkPut("tasks", [
      taskSeed("오늘 화면 설계 정리", addDays(baseToday, 2), "high", cat("프로젝트"), p1.id),
      taskSeed("습관 기록 UI 검토", addDays(baseToday, 3), "medium", cat("프로젝트"), p1.id),
      taskSeed("수면 루틴 시간 고정", addDays(baseToday, 4), "medium", cat("생활"), p2.id)
    ]);
  }
  if ((await all("notes")).length === 0) {
    await bulkPut("notes", [
      noteSeed("일정관리 원칙", "계획은 촘촘하게, 실행은 유연하게. 하루 첫 화면은 오늘 실행만 보여줘야 한다.", "원칙"),
      noteSeed("AI에게 물어볼 것", "이번 주 일정이 목표 달성에 충분한지, 불필요하게 과밀한 구간이 있는지 피드백 받기.", "AI")
    ]);
  }
  if ((await all("dreams")).length === 0) {
    await bulkPut("dreams", [
      dreamSeed("1년 뒤의 나", "꾸준한 루틴과 결과물이 쌓인 사람", "career"),
      dreamSeed("건강한 생활", "수면, 운동, 식사를 무너지지 않게 유지", "life")
    ]);
  }
}

function eventSeed(name, date, startTime, endTime, categoryId, colorIndex, memo) {
  const now = new Date().toISOString();
  return { id: uid("evt"), name, date, startTime, endTime, categoryId, colorIndex, memo, status: "planned", repeatRuleId: "", createdAt: now, updatedAt: now };
}
function repeatEvents(rule) {
  const dayIndex = ["월", "화", "수", "목", "금", "토", "일"].indexOf(rule.day);
  if (dayIndex < 0 || rule.isActive === false) return [];
  const startDate = rule.startDate || state.weekStart;
  const endDate = rule.endDate || addDays(startDate, 55);
  const intervalWeeks = Number(rule.intervalWeeks || 1);
  const exceptionDates = Array.isArray(rule.exceptionDates) ? rule.exceptionDates : [];
  const firstWeekStart = weekStart(startDate);
  const firstDate = addDays(firstWeekStart, dayIndex);
  const first = firstDate < startDate ? addDays(firstDate, 7 * intervalWeeks) : firstDate;
  const events = [];
  for (let date = first; date <= endDate && events.length < 104; date = addDays(date, 7 * intervalWeeks)) {
    if (exceptionDates.includes(date)) continue;
    events.push({ ...eventSeed(rule.name, date, rule.startTime, rule.endTime, rule.categoryId, rule.colorIndex, "반복일정"), repeatRuleId: rule.id });
  }
  return events;
}
function templateSeed(name, categoryId, colorIndex, memo) {
  const now = new Date().toISOString();
  return { id: uid("tpl"), name, categoryId, colorIndex, defaultMemo: memo, useCount: 1, isFavorite: false, isActive: true, createdAt: now, updatedAt: now };
}
function taskSeed(name, dueDate, priority, categoryId, projectId = "", estimatedMinutes = 60) {
  const now = new Date().toISOString();
  return { id: uid("tsk"), name, dueDate, priority, categoryId, projectId, estimatedMinutes, status: "todo", memo: "", createdAt: now, updatedAt: now };
}
function habitSeed(name, rhythm, categoryId) {
  const now = new Date().toISOString();
  return { id: uid("hab"), name, rhythm, categoryId, target: rhythm === "weekly" ? 4 : 1, isActive: true, createdAt: now, updatedAt: now };
}
function goalSeed(name, period, method, target, categoryId) {
  const start = period === "weekly" ? weekStart(today()) : period === "monthly" ? monthStart(today()) : yearStart(today());
  const now = new Date().toISOString();
  return { id: uid("gol"), name, period, method, target, current: 0, unit: method === "time" ? "시간" : "회", categoryId, startDate: start, endDate: period === "weekly" ? addDays(start, 6) : period === "monthly" ? monthEnd(today()) : yearEnd(today()), status: "active", memo: "", createdAt: now, updatedAt: now };
}
function projectSeed(name, categoryId) {
  const now = new Date().toISOString();
  return { id: uid("prj"), name, categoryId, status: "active", area: "개인", memo: "", createdAt: now, updatedAt: now };
}
function noteSeed(title, body, tag) {
  const now = new Date().toISOString();
  return { id: uid("not"), title, body, tag, createdAt: now, updatedAt: now };
}
function dreamSeed(title, body, area) {
  const now = new Date().toISOString();
  return { id: uid("drm"), title, body, area, horizon: "year", createdAt: now, updatedAt: now };
}

async function load() {
  memory.settings = await get("settings", "app");
  state.theme = memory.settings?.theme || "paper";
  memory.categories = (await all("categories")).filter((x) => x.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder);
  memory.templates = (await all("schedule_templates")).filter((x) => x.isActive !== false);
  memory.events = await all("schedule_events");
  memory.repeats = await all("repeat_rules");
  memory.goals = await all("goals");
  memory.tasks = await all("tasks");
  memory.habits = (await all("habits")).filter((x) => x.isActive !== false);
  memory.habitLogs = await all("habit_logs");
  memory.projects = await all("projects");
  memory.notes = await all("notes");
  memory.dreams = await all("dreams");
  memory.reviews = await all("reviews");
  applyTheme();
}

function applyTheme() {
  const theme = themes[state.theme] || themes.paper;
  Object.entries(theme.vars).forEach(([key, value]) => document.documentElement.style.setProperty(`--${key}`, value));
  document.documentElement.dataset.theme = theme.dark ? "dark" : "light";
}

function category(id) {
  return memory.categories.find((x) => x.id === id) || { id: "", name: "기타", sortOrder: 0 };
}
function color(index = 0) {
  return themes[state.theme].colors[index % themes[state.theme].colors.length];
}
function weekDates() {
  return Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
}
function monthCalendarDates() {
  const first = monthStart(state.monthStart);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
function monthEvents() {
  const start = monthStart(state.monthStart);
  const end = monthEnd(state.monthStart);
  return memory.events.filter((event) => event.date >= start && event.date <= end);
}
function isSameMonth(date, base = state.monthStart) {
  return date.slice(0, 7) === base.slice(0, 7);
}
function weekEvents() {
  const start = state.weekStart;
  const end = addDays(start, 6);
  return memory.events.filter((event) => event.date >= start && event.date <= end);
}
function dayEvents(date = state.selectedDate) {
  return memory.events.filter((event) => event.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
}
function eventSpanSlots(event) {
  return Math.max(1, Math.ceil(duration(event.startTime, event.endTime) / 30));
}
function eventVisualHeight(event) {
  return Math.max(24, eventSpanSlots(event) * 30 - 6);
}
function slotInlineStyle(events) {
  return events.length ? ` style="overflow:visible; z-index:${10 + events.length};"` : "";
}
function eventsOverlap(a, b) {
  return a.date === b.date && minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);
}
function findEventConflict(candidate, ignoreId = "") {
  return memory.events.find((event) => event.id !== ignoreId && eventsOverlap(candidate, event)) || null;
}
function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => { state.toast = ""; render(); }, 1600);
}
function friendlyAuthError(error) {
  const message = String(error?.message || error?.msg || error || "");
  if (message.includes("Unsupported provider") || message.includes("provider is not enabled")) {
    return "Supabase에서 Google Provider를 활성화해야 합니다.";
  }
  if (message.includes("redirect") || message.includes("Redirect")) {
    return "Supabase Redirect URL 설정을 확인해야 합니다.";
  }
  return "Google 로그인을 시작하지 못했습니다.";
}
function completedEvents() {
  return memory.events.filter((event) => event.status === "completed");
}
function activeTasks() {
  return memory.tasks.filter((task) => task.status !== "done");
}
function goalProgress(goal) {
  if (goal.manualProgress || Number(goal.current || 0) > 0 || ["count", "time", "progress"].includes(goal.method)) {
    const current = Number(goal.current || 0);
    return { current, pct: clamp(Math.round((current / Number(goal.target || 1)) * 100), 0, 100) };
  }
  const linkedEvents = completedEvents().filter((event) => event.goalId === goal.id && event.date >= goal.startDate && event.date <= goal.endDate);
  const linkedTasks = memory.tasks.filter((task) => task.status === "done" && task.goalId === goal.id && (!task.dueDate || (task.dueDate >= goal.startDate && task.dueDate <= goal.endDate)));
  const catEvents = completedEvents().filter((event) =>
    event.categoryId === goal.categoryId && event.date >= goal.startDate && event.date <= goal.endDate
  );
  const catTasks = memory.tasks.filter((task) =>
    task.status === "done" && task.categoryId === goal.categoryId && (!task.dueDate || (task.dueDate >= goal.startDate && task.dueDate <= goal.endDate))
  );
  const current = goal.method === "completion"
    ? (linkedEvents.length > 0 ? linkedEvents.length : catEvents.length)
    : (linkedTasks.length > 0 ? linkedTasks.length : catTasks.length);
  return { current, pct: clamp(Math.round((current / Number(goal.target || 1)) * 100), 0, 100) };
}
function habitDone(habitId, date = today()) {
  return memory.habitLogs.some((log) => log.habitId === habitId && log.date === date && log.done);
}

function appShell() {
  if (isSupabaseConfigured() && isSupabaseReady() && navigator.onLine && state.authReady && !state.authUser) return loginShell();
  const theme = themes[state.theme];
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brandMark"></div>
        <div>
          <h1>Life Planner</h1>
          <p>offline workspace</p>
        </div>
      </div>
      <nav>${navItems.map(([id, label]) => `<button class="navItem ${state.view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}</nav>
      <div class="sidebarCard">
        <span>이번 주</span>
        <strong>${fmtMD(state.weekStart)} - ${fmtMD(addDays(state.weekStart, 6))}</strong>
        <div class="swatches">${theme.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
      </div>
      ${state.authUser ? `<div class="sidebarCard"><span>로그인</span><strong>${escapeHtml(state.authUser.email || "Google 사용자")}</strong><button class="ghost full" data-action="signOut">로그아웃</button></div>` : ""}
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <p class="eyebrow">${theme.label}</p>
          <h2>${viewTitle()}</h2>
        </div>
        <div class="topActions"><input class="globalSearch" value="${escapeAttr(state.query)}" placeholder="검색">${renderTopActions()}</div>
      </header>
      <section class="actionPanel">${renderActions()}</section>
      <section class="content">${renderView()}</section>
    </main>
    ${renderModal()}
    ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
  `;
}

function loginShell() {
  return `<main class="loginShell">
    <section class="loginCard">
      <div class="brandMark"></div>
      <p class="eyebrow">Life Planner</p>
      <h1>Google 계정으로 시작하세요</h1>
      <p class="muted">일정은 먼저 이 기기의 IndexedDB에 저장되고, 로그인 후 Supabase에 자동 동기화됩니다.</p>
      <button class="primary" data-action="signInGoogle">Google로 로그인</button>
      <p class="tiny">오프라인 중이면 기존 로컬 데이터는 보존됩니다. 온라인에서 로그인하면 대기 중인 변경사항을 동기화합니다.</p>
    </section>
    ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
  </main>`;
}

function viewTitle() {
  return ({
    today: "오늘 실행",
    planner: "주간 계획",
    monthly: "월간 계획",
    dashboard: "주간 대시보드",
    daily: "일간 대시보드",
    tasks: "할 일 인박스",
    habits: "습관",
    goals: "목표",
    projects: "프로젝트",
    notes: "메모",
    review: "회고",
    dreams: "꿈 / 비전",
    database: "데이터베이스",
    settings: "환경 설정",
    ai: "AI 에이전트"
  })[state.view];
}

function renderTopActions() {
  const weekNav = `<button class="ghost" data-action="prevWeek">이전주</button><button class="ghost" data-action="thisWeek">이번주</button><button class="ghost" data-action="nextWeek">다음주</button>`;
  if (state.view === "today") return `<button class="primary" data-modal="quickAdd">빠른 추가</button>`;
  if (["planner", "dashboard", "daily"].includes(state.view)) return `${weekNav}<button class="primary" data-modal="event">일정 추가</button>`;
  if (state.view === "monthly") return `<button class="ghost" data-action="prevMonth">이전달</button><button class="ghost" data-action="thisMonth">이번달</button><button class="ghost" data-action="nextMonth">다음달</button><button class="primary" data-modal="event">일정 추가</button>`;
  if (state.view === "tasks") return `<button class="primary" data-modal="task">할 일 추가</button>`;
  if (state.view === "habits") return `<button class="primary" data-modal="habit">습관 추가</button>`;
  if (state.view === "goals") return `<button class="primary" data-modal="goal">목표 추가</button>`;
  if (state.view === "projects") return `<button class="primary" data-modal="project">프로젝트 추가</button><button class="soft" data-modal="task">다음 행동</button>`;
  if (state.view === "notes") return `<button class="primary" data-modal="note">메모 추가</button>`;
  if (state.view === "review") return `<button class="primary" data-modal="review">회고 작성</button>`;
  if (state.view === "dreams") return `<button class="primary" data-modal="dream">비전 추가</button>`;
  if (state.view === "database") return `<button class="primary" data-modal="template">일정사전 추가</button><button class="soft" data-modal="category">카테고리</button>`;
  if (state.view === "settings") return `<button class="primary" data-action="exportBackup">백업 내보내기</button><button class="soft" data-action="importBackup">백업 가져오기</button><button class="soft" data-action="checkSupabase">연결 확인</button><input class="backupInput" type="file" accept="application/json,.json" hidden>`;
  if (state.view === "ai") return `<button class="primary" data-action="copyPrompt">프롬프트 복사</button>`;
  return "";
}

function renderActions() {
  const cats = [`<button class="pill ${state.selectedCategory === "all" ? "active" : ""}" data-filter-cat="all">전체</button>`]
    .concat(memory.categories.map((cat) => `<button class="pill ${state.selectedCategory === cat.id ? "active" : ""}" data-filter-cat="${cat.id}">${cat.name}</button>`));
  if (state.view === "database") return [
    ["events", "일정 기록"],
    ["templates", "자주 쓰는 일정"],
    ["categories", "분류"],
    ["repeats", "반복 일정"]
  ].map(([id, label]) => `<button class="pill ${state.dataTab === id ? "active" : ""}" data-data-tab="${id}">${label}</button>`).join("");
  if (["today", "planner", "monthly", "dashboard", "daily", "tasks", "goals"].includes(state.view)) return cats.join("");
  if (state.view === "habits") return `<span class="panelHint">습관 칸을 누르면 해당 날짜의 체크 상태가 바뀝니다.</span>`;
  if (state.view === "projects") return `<span class="panelHint">프로젝트는 다음 행동 완료율로 진행률을 계산합니다.</span>`;
  if (state.view === "notes") return `<span class="panelHint">계획 원칙, AI 질문, 장기 아이디어를 한 곳에 보관합니다.</span>`;
  if (state.view === "review") return `<span class="panelHint">완료 일정, 습관, 할 일을 기준으로 실행 점수를 계산합니다.</span>`;
  if (state.view === "dreams") return `<span class="panelHint">꿈과 비전은 목표보다 긴 기간의 방향성을 기록하는 공간입니다.</span>`;
  if (state.view === "settings") return `<span class="panelHint">테마, 백업, 오프라인 저장 상태를 관리합니다.</span>`;
  if (state.view === "ai") return `<button class="primary" data-ai="weekly">주간 피드백</button><button class="soft" data-ai="goal">목표 추천</button><button class="soft" data-ai="habit">습관 분석</button><button class="soft" data-ai="review">회고 요약</button>`;
  return "";
}

function filtered(items) {
  const byCategory = state.selectedCategory === "all" ? items : items.filter((item) => item.categoryId === state.selectedCategory);
  const q = state.query.trim().toLowerCase();
  if (!q) return byCategory;
  return byCategory.filter((item) => [
    item.name,
    item.title,
    item.body,
    item.memo,
    item.defaultMemo,
    item.area,
    item.status,
    item.tag,
    category(item.categoryId).name
  ].filter(Boolean).join(" ").toLowerCase().includes(q));
}

function renderView() {
  if (state.view === "today") return renderToday();
  if (state.view === "planner") return renderPlanner();
  if (state.view === "monthly") return renderMonthly();
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "daily") return renderDaily();
  if (state.view === "tasks") return renderTasks();
  if (state.view === "habits") return renderHabits();
  if (state.view === "goals") return renderGoals();
  if (state.view === "projects") return renderProjects();
  if (state.view === "notes") return renderNotes();
  if (state.view === "review") return renderReview();
  if (state.view === "dreams") return renderDreams();
  if (state.view === "database") return renderDatabase();
  if (state.view === "settings") return renderSettings();
  if (state.view === "ai") return renderAI();
  return "";
}
function renderMonthly() {
  const dates = monthCalendarDates();
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const events = filtered(monthEvents());
  return `
    <div class="plannerGrid monthlyGrid">
      ${days.map((day) => `<div class="dayHead"><b>${day}</b><span>${monthLabel(state.monthStart)}</span></div>`).join("")}
      ${dates.map((date) => {
        const inDay = events.filter((event) => event.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const visible = inDay.slice(0, 4);
        const extra = inDay.length - visible.length;
        return `<div class="slot hour monthSlot ${isSameMonth(date) ? "" : "outsideMonth"}" data-month-day="${date}">
          <button class="ghost monthDate ${date === today() ? "todayDate" : ""}" data-month-select="${date}">${fmtMD(date)}</button>
          ${visible.map(eventPill).join("")}
          ${extra > 0 ? `<button class="ghost monthMore" data-day="${date}">+${extra}개 더 보기</button>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
}

function renderToday() {
  const events = dayEvents(today());
  const tasks = activeTasks().filter((task) => !task.dueDate || task.dueDate <= today()).slice(0, 7);
  const goals = memory.goals.filter((goal) => goal.status !== "done" && goal.startDate <= today() && goal.endDate >= today());
  const focus = nextFocusItem(events, tasks);
  return `
    <div class="todayGrid">
      <section class="heroCard">
        <p class="eyebrow">Today</p>
        <h3>${fmtMD(today())} 실행 보드</h3>
        <p>일정 ${events.length}개, 할 일 ${tasks.length}개, 진행 목표 ${goals.length}개</p>
        <div class="focusLine"><span></span><b>${focus.label}</b><em>${focus.text}</em></div>
      </section>
      <section class="card">
        <div class="cardHead"><h3>타임라인</h3><button data-modal="event">추가</button></div>
        <div class="timeline">${events.map(eventRow).join("") || empty("오늘 일정이 없습니다.")}</div>
      </section>
      <section class="card">
        <div class="cardHead"><h3>오늘 할 일</h3><button data-modal="task">추가</button></div>
        <div class="taskList">${tasks.map(taskRow).join("") || empty("오늘 처리할 할 일이 없습니다.")}</div>
      </section>
      <section class="card">
        <div class="cardHead"><h3>습관 체크</h3><button data-modal="habit">추가</button></div>
        <div class="habitCompact">${memory.habits.map(habitMini).join("")}</div>
      </section>
      <section class="card wide">
        <div class="cardHead"><h3>목표 진행</h3><button data-view="goals">전체 보기</button></div>
        <div class="goalBars">${goals.map(goalBar).join("") || empty("이번 주 목표가 없습니다.")}</div>
      </section>
    </div>
  `;
}

function nextFocusItem(events, tasks) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const nextEvent = events
    .filter((event) => event.status !== "completed")
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .find((event) => minutes(event.startTime) >= current) || events.find((event) => event.status !== "completed");
  if (nextEvent) return { label: "다음 일정", text: `${nextEvent.startTime} ${nextEvent.name}` };
  const urgentTask = tasks.find((task) => task.priority === "high") || tasks[0];
  if (urgentTask) return { label: "다음 할 일", text: urgentTask.name };
  return { label: "오늘 정리", text: "오늘 계획을 추가하세요" };
}

function renderPlanner() {
  const dates = weekDates();
  const slots = Array.from({ length: 36 }, (_, i) => ({ hour: 6 + Math.floor(i / 2), minute: i % 2 ? 30 : 0 }));
  return `
    <div class="plannerGrid" style="grid-template-columns: 58px repeat(7, 1fr)">
      <div class="corner"></div>
      ${dates.map((date, index) => `<div class="dayHead"><b>${["월", "화", "수", "목", "금", "토", "일"][index]}</b><span>${fmtMD(date)}</span></div>`).join("")}
      ${slots.map(({ hour, minute }) => `
        <div class="timeCell ${minute ? "half" : "hour"}">${minute ? `${pad(hour)}:30` : `${pad(hour)}:00`}</div>
        ${dates.map((date) => {
          const time = slotTime(hour, minute);
          const inSlot = filtered(memory.events).filter((event) => event.date === date && event.startTime === time);
          return `<div class="slot ${minute ? "half" : "hour"}" data-date="${date}" data-hour="${hour}" data-minute="${minute}"${slotInlineStyle(inSlot)}>${inSlot.map(eventChip).join("")}</div>`;
        }).join("")}
      `).join("")}
    </div>
  `;
}

function renderDashboard() {
  const events = filtered(weekEvents());
  const total = events.reduce((sum, event) => sum + duration(event.startTime, event.endTime), 0);
  const done = events.filter((event) => event.status === "completed").length;
  const goals = memory.goals.filter((goal) => goal.period === "weekly" && goal.startDate === state.weekStart);
  const habitsDone = memory.habits.reduce((sum, habit) => sum + weekDates().filter((date) => habitDone(habit.id, date)).length, 0);
  const pendingTasks = memory.tasks.filter((task) => task.status !== "done" && (!task.dueDate || (task.dueDate >= state.weekStart && task.dueDate <= addDays(state.weekStart, 6)))).length;
  const reviewScore = Math.round(((events.length ? done / events.length : 0) * 40) + ((memory.habits.length ? habitsDone / (memory.habits.length * 7) : 0) * 30) + ((goals.length ? goals.reduce((s, g) => s + goalProgress(g).pct, 0) / goals.length / 100 : 0) * 30));
  return `
    <div class="dashboardGrid">
      <div class="metric"><span>일정</span><b>${events.length}</b><em>${Math.round(total / 60)}시간 계획</em></div>
      <div class="metric"><span>완료</span><b>${done}</b><em>${events.length ? Math.round(done / events.length * 100) : 0}%</em></div>
      <div class="metric"><span>목표</span><b>${goals.length}</b><em>주간 목표</em></div>
      <section class="card wide2">
        <div class="cardHead"><h3>가로형 주간 흐름</h3><span>${fmtMD(state.weekStart)} - ${fmtMD(addDays(state.weekStart, 6))}</span></div>
        <div class="flowBoard">${weekDates().map((date, i) => `
          <div class="flowDay">
            <h4>${["월", "화", "수", "목", "금", "토", "일"][i]} <span>${fmtMD(date)}</span></h4>
            ${events.filter((e) => e.date === date).map(eventPill).join("") || "<p class='muted'>비어 있음</p>"}
          </div>`).join("")}</div>
      </section>
      <section class="card wide">
        <div class="cardHead"><h3>목표 게이지</h3><span>완료 기준</span></div>
        <div class="goalBars">${goals.map(goalBar).join("") || empty("이번 주 목표가 없습니다.")}</div>
      </section>
      <section class="card">
        <div class="cardHead"><h3>주간 리뷰</h3><span>자동 요약</span></div>
        <div class="reviewSummary">
          <b>${reviewScore}</b>
          <p>완료 일정 ${done}개 · 습관 ${habitsDone}회 · 남은 할 일 ${pendingTasks}개</p>
          <em>${reviewScore >= 75 ? "출력해도 좋은 안정적인 주간 계획입니다." : reviewScore >= 45 ? "계획은 잡혔지만 목표/습관 보강이 필요합니다." : "이번 주 실행 기준이 아직 부족합니다."}</em>
        </div>
      </section>
    </div>
  `;
}

function renderDaily() {
  const dates = weekDates();
  const events = dayEvents(state.selectedDate);
  const slots = Array.from({ length: 36 }, (_, i) => ({ hour: 6 + Math.floor(i / 2), minute: i % 2 ? 30 : 0 }));
  return `
    <div class="dailyWrap">
      <div class="dayPicker">${dates.map((date, index) => `<button class="${state.selectedDate === date ? "active" : ""}" data-day="${date}">${["월", "화", "수", "목", "금", "토", "일"][index]}<span>${fmtMD(date)}</span></button>`).join("")}</div>
      <div class="dailyBoard">
        ${slots.map(({ hour, minute }) => {
          const time = slotTime(hour, minute);
          const inSlot = events.filter((event) => event.startTime === time);
          return `<div class="dailyTime ${minute ? "half" : "hour"}">${minute ? `${pad(hour)}:30` : `${pad(hour)}:00`}</div><div class="dailySlot ${minute ? "half" : "hour"}"${slotInlineStyle(inSlot)}>${inSlot.map(eventChip).join("")}</div>`;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTasks() {
  const groups = {
    overdue: activeTasks().filter((task) => task.dueDate && task.dueDate < today()),
    today: activeTasks().filter((task) => task.dueDate === today()),
    later: activeTasks().filter((task) => !task.dueDate || task.dueDate > today()),
    done: memory.tasks.filter((task) => task.status === "done")
  };
  return `<div class="kanban taskBoard">${Object.entries(groups).map(([key, tasks]) => `
    <section class="lane"><h3>${{ overdue: "밀린 일", today: "오늘 실행", later: "다음 행동", done: "완료" }[key]} <span>${tasks.length}</span></h3>${filtered(tasks).map(taskCard).join("") || empty("없음")}</section>
  `).join("")}</div>`;
}

function renderHabits() {
  const dates = weekDates();
  return `
    <div class="card full">
      <div class="cardHead"><h3>습관 트래커</h3><span>${fmtMD(state.weekStart)} - ${fmtMD(addDays(state.weekStart, 6))}</span></div>
      <div class="habitGrid">
        <div></div>${dates.map((date, i) => `<b>${["월", "화", "수", "목", "금", "토", "일"][i]}<span>${fmtMD(date)}</span></b>`).join("")}<em>달성</em>
        ${memory.habits.map((habit) => `
          <strong>${habit.name}<span>${category(habit.categoryId).name}</span></strong>
          ${dates.map((date) => `<button class="checkDot ${habitDone(habit.id, date) ? "done" : ""}" data-habit="${habit.id}" data-date="${date}"></button>`).join("")}
          <em>${dates.filter((date) => habitDone(habit.id, date)).length}/7</em>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGoals() {
  const goals = filtered(memory.goals);
  return `<div class="goalBoard">${goals.map((goal) => `
    <article class="goalCard" data-goal="${goal.id}">
      <div class="goalTop"><span>${goal.period}</span><b>${goal.status}</b></div>
      <h3>${goal.name}</h3>
      ${goalBar(goal)}
      <div class="goalStepper">
        <button data-goal-step="${goal.id}" data-step="-1">-1</button>
        <button data-goal-step="${goal.id}" data-step="1">+1 ${goal.unit || ""}</button>
      </div>
      <p>${category(goal.categoryId).name} · ${goal.startDate} ~ ${goal.endDate}</p>
      <div class="miniActions"><button data-edit-goal="${goal.id}">수정</button><button class="dangerText" data-delete-goal="${goal.id}">삭제</button></div>
    </article>`).join("")}</div>`;
}

function renderProjects() {
  return `<div class="projectGrid">${filtered(memory.projects).map((project) => {
    const tasks = memory.tasks.filter((task) => task.projectId === project.id);
    const done = tasks.filter((task) => task.status === "done").length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const next = tasks.filter((task) => task.status !== "done").slice(0, 3);
    return `<article class="projectCard" data-project="${project.id}">
      <div class="projectAccent" style="background:${color(memory.categories.findIndex((c) => c.id === project.categoryId))}"></div>
      <h3>${project.name}</h3><p>${category(project.categoryId).name} · ${project.area}</p>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <small>${done}/${tasks.length} 완료</small>
      <div class="projectTasks">${next.map(taskRow).join("") || empty("다음 행동이 없습니다.")}</div>
    </article>`;
  }).join("")}</div>`;
}

function renderNotes() {
  return `<div class="notesGrid">
    <section class="card wide">
      <div class="cardHead"><h3>지식 / 메모</h3><button data-modal="note">추가</button></div>
      <div class="noteList">${memory.notes.map((note) => `
        <article class="noteItem">
          <span>${note.tag}</span>
          <h3>${note.title}</h3>
          <p>${note.body}</p>
        </article>`).join("") || empty("저장된 메모가 없습니다.")}</div>
    </section>
    <section class="card">
      <h3>메모 활용</h3>
      <p class="muted">반복되는 생각, AI에게 물어볼 질문, 계획 원칙을 보관합니다.</p>
      <div class="settingRows">
        <article><b>계획 원칙</b><span>${memory.notes.filter((n) => n.tag === "원칙").length}</span></article>
        <article><b>AI 질문</b><span>${memory.notes.filter((n) => n.tag === "AI").length}</span></article>
        <article><b>전체 메모</b><span>${memory.notes.length}</span></article>
      </div>
    </section>
  </div>`;
}

function renderReview() {
  const reviews = memory.reviews.sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="reviewGrid">
    <section class="card"><div class="cardHead"><h3>오늘 체크</h3><button data-modal="review">작성</button></div>
      <div class="scoreRing"><b>${todayScore()}%</b><span>오늘 실행 점수</span></div>
      <p class="muted">완료 일정, 습관 체크, 할 일 처리 기준으로 계산합니다.</p>
    </section>
    <section class="card wide">${reviews.map((review) => `<article class="reviewItem"><b>${review.date}</b><p>${review.win}</p><span>${review.lesson}</span></article>`).join("") || empty("회고가 없습니다.")}</section>
  </div>`;
}

function renderDreams() {
  return `<div class="dreamBoard">
    ${memory.dreams.map((dream) => `<article class="dreamCard"><span>${dream.area}</span><h3>${dream.title}</h3><p>${dream.body}</p><button data-modal="dream" data-edit="${dream.id}">다듬기</button></article>`).join("")}
    <section class="card"><h3>비전 질문</h3><p>1년 뒤에도 유지하고 싶은 루틴은 무엇인가?</p><p>목표가 아니라 정체성으로 남길 문장은 무엇인가?</p></section>
  </div>`;
}

function renderDatabase() {
  const categoryMap = Object.fromEntries(memory.categories.map((cat) => [cat.id, cat.name]));
  if (state.dataTab === "templates") {
    return `<div class="dataGrid single"><section class="card"><div class="cardHead"><h3>자주 쓰는 일정</h3><button data-modal="template">추가</button></div>
      <table><thead><tr><th>일정명</th><th>분류</th><th>기본 메모</th><th>사용</th></tr></thead><tbody>
      ${filtered(memory.templates).map((t) => `<tr><td>${t.name}</td><td>${categoryMap[t.categoryId] || "기타"}</td><td>${t.defaultMemo}</td><td>${t.useCount || 0}</td></tr>`).join("")}</tbody></table>
    </section></div>`;
  }
  if (state.dataTab === "categories") {
    return `<div class="dataGrid single"><section class="card"><div class="cardHead"><h3>분류</h3><button data-modal="category">추가</button></div>
      <div class="categoryList">${memory.categories.map((cat, i) => `<button><i style="background:${color(i)}"></i>${cat.name}</button>`).join("")}</div>
    </section></div>`;
  }
  if (state.dataTab === "repeats") {
    return `<div class="dataGrid single"><section class="card"><div class="cardHead"><h3>반복 일정</h3><span>${memory.repeats.length}개</span></div>
      <table><thead><tr><th>반복명</th><th>요일</th><th>시간</th><th>기간/주기</th><th>분류</th><th>관리</th></tr></thead><tbody>
      ${memory.repeats.map((r) => {
        const intervalLabel = Number(r.intervalWeeks || 1) === 1 ? "매주" : Number(r.intervalWeeks || 1) === 2 ? "격주" : `${r.intervalWeeks}주마다`;
        return `<tr><td>${r.name}</td><td>${r.day}</td><td>${r.startTime}-${r.endTime}</td><td>${r.startDate || state.weekStart} ~ ${r.endDate || addDays(state.weekStart, 55)} · ${intervalLabel}</td><td>${categoryMap[r.categoryId] || "기타"}</td><td><button data-edit-repeat="${r.id}">수정</button><button data-toggle-repeat="${r.id}">${r.isActive ? "중지" : "사용"}</button><button class="dangerText" data-delete-repeat="${r.id}">삭제</button></td></tr>`;
      }).join("") || `<tr><td colspan="6">반복일정이 없습니다.</td></tr>`}</tbody></table>
    </section></div>`;
  }
  return `<div class="dataGrid single"><section class="card"><div class="cardHead"><h3>일정 기록</h3><span>${filtered(memory.events).length}개</span></div>
    <table><thead><tr><th>일정명</th><th>날짜</th><th>시간</th><th>분류</th><th>상태</th></tr></thead><tbody>
    ${filtered(memory.events).map((e) => `<tr><td>${e.name}</td><td>${e.date}</td><td>${e.startTime}-${e.endTime}</td><td>${categoryMap[e.categoryId] || "기타"}</td><td>${e.status}</td></tr>`).join("")}</tbody></table>
  </section></div>`;
}

function renderSettings() {
  const sync = state.syncStatus;
  const syncLabel = sync
    ? sync.connected ? "연결됨" : sync.configured && sync.authenticated === false ? "로그인 필요" : sync.configured ? "연결 실패" : "설정 필요"
    : "확인 전";
  const syncDetail = sync
    ? `${sync.online ? "온라인" : "오프라인"} · 대기 ${sync.pending || 0}건 · 원격 ${sync.remoteCount ?? "-"}건`
    : "연결 확인을 누르면 Supabase 상태를 확인합니다.";
  return `<div class="settingsGrid">
    <section class="card">
      <div class="cardHead"><h3>테마</h3><span>라이트 3개 · 다크 3개</span></div>
      <div class="themeGrid">${Object.entries(themes).map(([key, theme]) => `
        <button class="themeCard ${state.theme === key ? "active" : ""}" data-theme="${key}">
          <strong>${theme.label}</strong>
          <span>${theme.dark ? "Dark" : "Light"}</span>
          <i>${theme.colors.map((c) => `<b style="background:${c}"></b>`).join("")}</i>
        </button>`).join("")}</div>
    </section>
    <section class="card">
      <div class="cardHead"><h3>데이터 안정성</h3><span>Local-first</span></div>
      <p class="muted">모든 변경은 먼저 현재 기기의 IndexedDB에 저장됩니다. 인터넷이 끊겨도 조회, 추가, 수정이 가능하며 Supabase가 연결되어 있으면 온라인 상태에서 원격 DB로 동기화됩니다.</p>
      <div class="settingRows">
        <article><b>오프라인 사용</b><span>가능</span></article>
        <article><b>로컬 저장</b><span>IndexedDB</span></article>
        <article><b>Supabase</b><span>${syncLabel}</span></article>
        <article><b>사용자</b><span>${state.authUser?.email || "로그인 안 됨"}</span></article>
        <article><b>동기화 상태</b><span>${syncDetail}</span></article>
      </div>
      <div class="inlineActions">
        <button class="soft" data-action="syncPull">Supabase에서 가져오기</button>
        <button class="soft" data-action="syncPush">Supabase로 올리기</button>
        <button class="soft" data-action="syncFlush">대기 동기화</button>
      </div>
    </section>
    <section class="card wide">
      <div class="cardHead"><h3>운영 규칙</h3><span>개인용 기본값</span></div>
      <div class="settingRows twoCols">
        <article><b>시간 단위</b><span>30분 고정</span></article>
        <article><b>주 시작</b><span>월요일</span></article>
        <article><b>목표 계산</b><span>완료된 일정/할 일 기준</span></article>
        <article><b>AI 연결</b><span>프롬프트 생성 후 복사</span></article>
      </div>
    </section>
  </div>`;
}

function renderAI() {
  return `<div class="aiGrid">
    <section class="card">
      <h3>프롬프트 종류</h3>
      <button class="aiChoice" data-ai="weekly">이번 주 계획 피드백</button>
      <button class="aiChoice" data-ai="goal">목표 추천</button>
      <button class="aiChoice" data-ai="habit">습관 실패 원인 분석</button>
      <button class="aiChoice" data-ai="review">회고 요약</button>
    </section>
    <section class="card wide"><div class="cardHead"><h3>복사용 프롬프트</h3><button data-action="copyPrompt">복사</button></div><textarea id="aiPrompt">${buildPrompt("weekly")}</textarea></section>
  </div>`;
}

function eventRow(event) {
  return `<article class="eventRow" data-event="${event.id}"><i style="background:${color(event.colorIndex)}"></i><time>${event.startTime}</time><div><b>${event.name}</b><span>${category(event.categoryId).name} · ${event.memo || "메모 없음"}</span></div><button data-complete="${event.id}">${event.status === "completed" ? "완료됨" : "완료"}</button></article>`;
}
function eventChip(event) {
  const height = eventVisualHeight(event);
  return `<button class="eventChip ${event.status === "completed" ? "done" : ""}" data-event="${event.id}" style="--event:${color(event.colorIndex)}; height:${height}px; min-height:${height}px;"><b>${event.name}</b><span>${event.startTime}-${event.endTime}</span></button>`;
}
function eventPill(event) {
  return `<button class="eventPill" data-event="${event.id}" style="--event:${color(event.colorIndex)}"><span>${event.startTime}</span>${event.name}</button>`;
}
function taskRow(task) {
  return `<article class="taskRow"><button class="check ${task.status === "done" ? "done" : ""}" data-task-done="${task.id}"></button><div><b>${task.name}</b><span>${task.dueDate || "기한 없음"} · ${category(task.categoryId).name} · ${task.estimatedMinutes || 60}분</span></div></article>`;
}
function taskCard(task) {
  return `<article class="taskCard" data-task="${task.id}"><div>${taskRow(task)}</div><span class="priority ${task.priority}">${task.priority}</span></article>`;
}
function habitMini(habit) {
  return `<button class="habitMini ${habitDone(habit.id) ? "done" : ""}" data-habit="${habit.id}" data-date="${today()}"><span></span>${habit.name}</button>`;
}
function goalBar(goal) {
  const progress = goalProgress(goal);
  return `<div class="goalBar"><div><b>${goal.name}</b><span>${progress.current}/${goal.target}</span></div><p><i style="width:${progress.pct}%"></i></p><em>${progress.pct}%</em></div>`;
}
function empty(text) {
  return `<div class="empty">${text}</div>`;
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(value) {
  return escapeHtml(value);
}
function todayScore() {
  const events = dayEvents(today());
  const eventPct = events.length ? events.filter((e) => e.status === "completed").length / events.length : 0;
  const habitPct = memory.habits.length ? memory.habits.filter((h) => habitDone(h.id)).length / memory.habits.length : 0;
  const tasks = memory.tasks.filter((task) => task.dueDate === today());
  const taskPct = tasks.length ? tasks.filter((task) => task.status === "done").length / tasks.length : 0;
  return Math.round(((eventPct + habitPct + taskPct) / 3) * 100);
}

function renderModal() {
  if (!state.modal) return "";
  const titles = {
    quickAdd: "빠른 추가",
    event: "일정 입력",
    repeat: "반복일정",
    task: "할 일 입력",
    habit: "습관 입력",
    goal: "목표 입력",
    project: "프로젝트 입력",
    note: "메모 입력",
    review: "회고 작성",
    dream: "비전 입력",
    template: "일정사전",
    category: "카테고리"
  };
  return `<div class="modalBackdrop" data-close="1"><form class="modal" data-form="${state.modal}">
    <header><h3>${titles[state.modal]}</h3><button type="button" data-close="1">닫기</button></header>
    ${modalBody(state.modal)}
    <footer><button class="primary" type="submit">저장</button></footer>
  </form></div>`;
}
function categoryOptions(selected = "") {
  return memory.categories.map((cat) => `<option value="${cat.id}" ${cat.id === selected ? "selected" : ""}>${cat.name}</option>`).join("");
}
function goalOptions(selected = "") {
  return `<option value="">없음</option>${memory.goals.filter((goal) => goal.status !== "done").map((goal) => `<option value="${goal.id}" ${goal.id === selected ? "selected" : ""}>${goal.name}</option>`).join("")}`;
}
function templateDatalist() {
  return `<datalist id="templateSuggestions">${memory.templates.map((template) => `<option value="${escapeAttr(template.name)}">${escapeHtml(category(template.categoryId).name)}</option>`).join("")}</datalist>`;
}
function modalBody(type) {
  if (type === "quickAdd") return `<label>내용<input name="name" placeholder="일정 또는 할 일"></label><div class="two"><label>날짜<input type="date" name="date" value="${today()}"></label><label>종류<select name="kind"><option value="event">일정</option><option value="task">할 일</option></select></label></div>`;
  if (type === "event") {
    const eventValue = state.modalData || {};
    return `<label>일정명<input name="name" list="templateSuggestions" autocomplete="off" required placeholder="예: 전자기학 공부" value="${escapeAttr(eventValue.name || "")}"></label>${templateDatalist()}<div class="two"><label>날짜<input type="date" name="date" value="${eventValue.date || state.selectedDate}"></label><label>카테고리<select name="categoryId">${categoryOptions(eventValue.categoryId)}</select></label></div><div class="two"><label>시작<input type="time" name="startTime" value="${eventValue.startTime || "09:00"}" step="1800"></label><label>종료<input type="time" name="endTime" value="${eventValue.endTime || "10:00"}" step="1800"></label></div><label>연결 목표<select name="goalId">${goalOptions(eventValue.goalId || "")}</select></label><label>메모<textarea name="memo">${escapeHtml(eventValue.memo || "")}</textarea></label>${eventValue.id ? `${eventValue.repeatRuleId ? `<button class="dangerInline" type="button" data-skip-repeat-event="${eventValue.id}">이번 회차만 제외</button>` : ""}<button class="dangerInline" type="button" data-delete-event="${eventValue.id}">일정 삭제</button>` : ""}`;
  }
  if (type === "repeat") {
    const repeat = state.modalData || {};
    return `<label>반복명<input name="name" required value="${escapeAttr(repeat.name || "")}"></label><div class="two"><label>요일<select name="day">${["월", "화", "수", "목", "금", "토", "일"].map((d) => `<option ${repeat.day === d ? "selected" : ""}>${d}</option>`).join("")}</select></label><label>카테고리<select name="categoryId">${categoryOptions(repeat.categoryId)}</select></label></div><div class="two"><label>시작<input type="time" name="startTime" value="${repeat.startTime || "09:00"}" step="1800"></label><label>종료<input type="time" name="endTime" value="${repeat.endTime || "10:00"}" step="1800"></label></div><div class="three"><label>반복 시작일<input type="date" name="startDate" value="${repeat.startDate || state.weekStart}"></label><label>반복 종료일<input type="date" name="endDate" value="${repeat.endDate || addDays(state.weekStart, 55)}"></label><label>반복 주기<select name="intervalWeeks"><option value="1" ${Number(repeat.intervalWeeks || 1) === 1 ? "selected" : ""}>매주</option><option value="2" ${Number(repeat.intervalWeeks || 1) === 2 ? "selected" : ""}>격주</option><option value="4" ${Number(repeat.intervalWeeks || 1) === 4 ? "selected" : ""}>4주마다</option></select></label></div>`;
  }
  if (type === "task") {
    const task = state.modalData || {};
    return `<label>할 일<input name="name" required value="${escapeAttr(task.name || "")}"></label><div class="two"><label>기한<input type="date" name="dueDate" value="${task.dueDate || today()}"></label><label>우선순위<select name="priority">${["high", "medium", "low"].map((p) => `<option value="${p}" ${task.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select></label></div><div class="two"><label>예상 소요시간<input type="number" name="estimatedMinutes" min="30" step="30" value="${task.estimatedMinutes || 60}"></label><label>프로젝트<select name="projectId"><option value="">없음</option>${memory.projects.map((p) => `<option value="${p.id}" ${task.projectId === p.id ? "selected" : ""}>${p.name}</option>`).join("")}</select></label></div><div class="two"><label>카테고리<select name="categoryId">${categoryOptions(task.categoryId)}</select></label><label>연결 목표<select name="goalId">${goalOptions(task.goalId || "")}</select></label></div>${task.id ? `<button class="dangerInline" type="button" data-schedule-task="${task.id}">캘린더에 배치</button><button class="dangerInline" type="button" data-delete-task="${task.id}">할 일 삭제</button>` : ""}`;
  }
  if (type === "habit") return `<label>습관명<input name="name" required></label><div class="two"><label>주기<select name="rhythm"><option value="daily">매일</option><option value="weekly">주간</option></select></label><label>카테고리<select name="categoryId">${categoryOptions()}</select></label></div>`;
  if (type === "goal") {
    const goal = state.modalData || {};
    return `<label>목표명<input name="name" required value="${escapeAttr(goal.name || "")}"></label><div class="two"><label>기간<select name="period">${["weekly", "monthly", "yearly"].map((p) => `<option value="${p}" ${goal.period === p ? "selected" : ""}>${p === "weekly" ? "주간" : p === "monthly" ? "월간" : "연간"}</option>`).join("")}</select></label><label>진행 방식<select name="method">${[
      ["count", "횟수 직접 입력"],
      ["time", "시간 직접 입력"],
      ["progress", "진도 직접 입력"],
      ["task", "할 일 완료 기준"],
      ["completion", "일정 완료 기준"]
    ].map(([m, label]) => `<option value="${m}" ${goal.method === m ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><div class="three"><label>현재<input type="number" name="current" value="${goal.current || 0}" step="0.5"></label><label>목표<input type="number" name="target" value="${goal.target || 3}" step="0.5"></label><label>단위<input name="unit" value="${escapeAttr(goal.unit || "회")}"></label></div><label>분류<select name="categoryId">${categoryOptions(goal.categoryId)}</select></label><label>메모<textarea name="memo">${escapeHtml(goal.memo || "")}</textarea></label>${goal.id ? `<button class="dangerInline" type="button" data-delete-goal="${goal.id}">목표 삭제</button>` : ""}`;
  }
  if (type === "project") {
    const project = state.modalData || {};
    return `<label>프로젝트명<input name="name" required value="${escapeAttr(project.name || "")}"></label><div class="two"><label>영역<input name="area" value="${escapeAttr(project.area || "개인")}"></label><label>카테고리<select name="categoryId">${categoryOptions(project.categoryId)}</select></label></div><label>메모<textarea name="memo">${escapeHtml(project.memo || "")}</textarea></label>${project.id ? `<button class="dangerInline" type="button" data-delete-project="${project.id}">프로젝트 삭제</button>` : ""}`;
  }
  if (type === "note") return `<label>제목<input name="title" required></label><div class="two"><label>태그<input name="tag" value="메모"></label><label>작성일<input type="date" name="date" value="${today()}"></label></div><label>내용<textarea name="body"></textarea></label>`;
  if (type === "review") return `<div class="two"><label>날짜<input type="date" name="date" value="${today()}"></label><label>점수<input type="number" name="score" value="${todayScore()}"></label></div><label>잘한 것<textarea name="win" placeholder="오늘 유지한 것"></textarea></label><label>배운 것<textarea name="lesson" placeholder="다음에 바꿀 것"></textarea></label>`;
  if (type === "dream") return `<label>제목<input name="title" required></label><div class="two"><label>영역<select name="area"><option>career</option><option>life</option><option>health</option><option>relationship</option></select></label><label>기간<select name="horizon"><option>year</option><option>life</option><option>quarter</option></select></label></div><label>설명<textarea name="body"></textarea></label>`;
  if (type === "template") return `<label>일정명<input name="name" required></label><div class="two"><label>카테고리<select name="categoryId">${categoryOptions()}</select></label><label>색상<input type="number" name="colorIndex" value="0" min="0" max="4"></label></div><label>기본 메모<textarea name="defaultMemo"></textarea></label>`;
  if (type === "category") return `<label>카테고리명<input name="name" required></label>`;
  return "";
}

function buildPrompt(type) {
  const events = weekEvents().map((e) => `- ${e.date} ${e.startTime}-${e.endTime} ${e.name} [${category(e.categoryId).name}] ${e.status}`).join("\n");
  const goals = memory.goals.map((g) => {
    const p = goalProgress(g);
    return `- ${g.name}: ${p.current}/${g.target} (${p.pct}%)`;
  }).join("\n");
  const habits = memory.habits.map((h) => `- ${h.name}: 이번 주 ${weekDates().filter((d) => habitDone(h.id, d)).length}/7`).join("\n");
  const base = `나는 개인 일정/습관/목표를 관리하고 있습니다. 조언은 구체적이고 실행 가능하게 해주세요.\n\n[이번 주 일정]\n${events || "없음"}\n\n[목표]\n${goals || "없음"}\n\n[습관]\n${habits || "없음"}`;
  if (type === "goal") return `${base}\n\n위 데이터를 바탕으로 이번 주에 세우기 좋은 목표 5개를 추천해주세요. 너무 추상적인 목표 말고, 완료 여부를 판단할 수 있는 목표로 제안해주세요.`;
  if (type === "habit") return `${base}\n\n습관 달성이 무너지는 원인을 추정하고, 내 일정 흐름에 맞는 개선안을 제시해주세요.`;
  if (type === "review") return `${base}\n\n이번 주 회고를 작성하려고 합니다. 잘한 점, 병목, 다음 주 개선안으로 정리해주세요.`;
  return `${base}\n\n이번 주 계획의 현실성, 과밀 시간대, 목표 달성 가능성, 조정해야 할 우선순위를 피드백해주세요.`;
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const now = new Date().toISOString();
  if (["event", "repeat"].includes(state.modal) && !validTimeRange(data.startTime, data.endTime)) {
    state.toast = "종료 시간은 시작 시간보다 늦어야 합니다.";
    render();
    setTimeout(() => { state.toast = ""; render(); }, 1600);
    return;
  }
  if (state.modal === "quickAdd") {
    if (data.kind === "task") await put("tasks", taskSeed(data.name, data.date, "medium", memory.categories[0].id));
    else {
      const quickEvent = eventSeed(data.name, data.date, "09:00", "10:00", memory.categories[0].id, 0, "");
      const conflict = findEventConflict(quickEvent);
      if (conflict) {
        showToast(`겹치는 일정이 있습니다: ${conflict.name}`);
        return;
      }
      await put("schedule_events", quickEvent);
    }
  }
  if (state.modal === "event") {
    const old = state.modalData?.id ? await get("schedule_events", state.modalData.id) : null;
    const nextEvent = {
      id: old?.id || uid("evt"),
      name: data.name,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      categoryId: data.categoryId,
      goalId: data.goalId || "",
      colorIndex: memory.categories.findIndex((c) => c.id === data.categoryId),
      memo: data.memo,
      status: old?.status || "planned",
      repeatRuleId: old?.repeatRuleId || "",
      createdAt: old?.createdAt || now,
      updatedAt: now,
      completedAt: old?.completedAt || ""
    };
    const conflict = findEventConflict(nextEvent, old?.id || "");
    if (conflict) {
      showToast(`겹치는 일정이 있습니다: ${conflict.name}`);
      return;
    }
    await put("schedule_events", nextEvent);
  }
  if (state.modal === "repeat") {
    const old = state.modalData?.id ? await get("repeat_rules", state.modalData.id) : null;
    const rule = {
      id: old?.id || uid("rep"),
      name: data.name,
      day: data.day,
      startTime: data.startTime,
      endTime: data.endTime,
      startDate: data.startDate || state.weekStart,
      endDate: data.endDate || addDays(state.weekStart, 55),
      intervalWeeks: Number(data.intervalWeeks || old?.intervalWeeks || 1),
      categoryId: data.categoryId,
      colorIndex: memory.categories.findIndex((c) => c.id === data.categoryId),
      isActive: old?.isActive ?? true,
      createdAt: old?.createdAt || now,
      updatedAt: now
    };
    if (rule.endDate < rule.startDate) {
      showToast("반복 종료일은 시작일보다 늦어야 합니다.");
      return;
    }
    const generatedEvents = repeatEvents(rule);
    const existingEvents = memory.events.filter((eventValue) => eventValue.repeatRuleId !== rule.id);
    const conflict = generatedEvents.find((generated) => existingEvents.some((eventValue) => eventsOverlap(generated, eventValue)));
    if (conflict) {
      const conflictingEvent = existingEvents.find((eventValue) => eventsOverlap(conflict, eventValue));
      showToast(`반복일정이 기존 일정과 겹칩니다: ${conflictingEvent?.name || "이름 없음"}`);
      return;
    }
    await put("repeat_rules", rule);
    await Promise.all(memory.events.filter((eventValue) => eventValue.repeatRuleId === rule.id).map((eventValue) => remove("schedule_events", eventValue.id)));
    await bulkPut("schedule_events", generatedEvents);
  }
  if (state.modal === "task") {
    const old = state.modalData?.id ? await get("tasks", state.modalData.id) : null;
    await put("tasks", { id: old?.id || uid("tsk"), name: data.name, dueDate: data.dueDate, priority: data.priority, categoryId: data.categoryId, goalId: data.goalId || "", projectId: data.projectId, estimatedMinutes: Number(data.estimatedMinutes || old?.estimatedMinutes || 60), status: old?.status || "todo", memo: old?.memo || "", createdAt: old?.createdAt || now, updatedAt: now });
  }
  if (state.modal === "habit") await put("habits", { id: uid("hab"), name: data.name, rhythm: data.rhythm, categoryId: data.categoryId, target: data.rhythm === "weekly" ? 4 : 1, isActive: true, createdAt: now, updatedAt: now });
  if (state.modal === "goal") {
    const old = state.modalData?.id ? await get("goals", state.modalData.id) : null;
    const start = data.period === "weekly" ? state.weekStart : data.period === "monthly" ? monthStart(today()) : yearStart(today());
    await put("goals", { id: old?.id || uid("gol"), name: data.name, period: data.period, method: data.method, current: Number(data.current || old?.current || 0), target: Number(data.target || 1), unit: data.unit || old?.unit || "회", categoryId: data.categoryId, startDate: old?.startDate || start, endDate: old?.endDate || (data.period === "weekly" ? addDays(start, 6) : data.period === "monthly" ? monthEnd(today()) : yearEnd(today())), status: old?.status || "active", memo: data.memo, createdAt: old?.createdAt || now, updatedAt: now });
  }
  if (state.modal === "project") {
    const old = state.modalData?.id ? await get("projects", state.modalData.id) : null;
    await put("projects", { id: old?.id || uid("prj"), name: data.name, categoryId: data.categoryId, area: data.area, status: old?.status || "active", memo: data.memo, createdAt: old?.createdAt || now, updatedAt: now });
  }
  if (state.modal === "note") await put("notes", { id: uid("not"), title: data.title, body: data.body, tag: data.tag, date: data.date, createdAt: now, updatedAt: now });
  if (state.modal === "review") await put("reviews", { id: uid("rev"), date: data.date, score: Number(data.score), win: data.win, lesson: data.lesson, createdAt: now, updatedAt: now });
  if (state.modal === "dream") await put("dreams", { id: uid("drm"), title: data.title, area: data.area, horizon: data.horizon, body: data.body, createdAt: now, updatedAt: now });
  if (state.modal === "template") await put("schedule_templates", { id: uid("tpl"), name: data.name, categoryId: data.categoryId, colorIndex: Number(data.colorIndex), defaultMemo: data.defaultMemo, useCount: 0, isFavorite: false, isActive: true, createdAt: now, updatedAt: now });
  if (state.modal === "category") await put("categories", { id: uid("cat"), name: data.name, sortOrder: memory.categories.length, isActive: true, createdAt: now, updatedAt: now });
  state.modal = null;
  state.modalData = null;
  await refresh("저장했습니다.");
}

async function refresh(toast = "") {
  await load();
  if (state.view === "settings") {
    state.syncStatus = await dbHealthCheck();
  }
  state.toast = toast;
  render();
  if (toast) setTimeout(() => { state.toast = ""; render(); }, 1600);
}

function render(focusSearch = false) {
  $("#app").innerHTML = appShell();
  if (focusSearch) {
    const input = $(".globalSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function openEventModal(data = {}) {
  state.modal = "event";
  state.modalData = data;
  state.selectedDate = data.date || state.selectedDate;
  render();
}

function slotFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest?.(".slot") || null;
}

function clearPlannerDragClasses() {
  $$(".slot.selecting, .slot.dropTarget, .monthSlot.dropTarget").forEach((slot) => slot.classList.remove("selecting", "dropTarget"));
  $$(".eventChip.dragging, .eventPill.dragging").forEach((chip) => chip.classList.remove("dragging"));
}

function paintPlannerSelection() {
  clearPlannerDragClasses();
  if (!state.drag || state.drag.type !== "select") return;
  const start = Math.min(state.drag.startMinute, state.drag.endMinute);
  const end = Math.max(state.drag.startMinute, state.drag.endMinute);
  $$(`.slot[data-date="${state.drag.date}"]`).forEach((slot) => {
    const minute = Number(slot.dataset.hour) * 60 + Number(slot.dataset.minute || 0);
    if (minute >= start && minute <= end) slot.classList.add("selecting");
  });
}

function paintMoveTarget(slot) {
  $$(".slot.dropTarget, .monthSlot.dropTarget").forEach((item) => item.classList.remove("dropTarget"));
  if (slot) slot.classList.add("dropTarget");
}



async function moveEventToSlot(eventId, slot) {
  const eventValue = await get("schedule_events", eventId);
  if (!eventValue || !slot) return;
  const newStartMinute = Number(slot.dataset.hour) * 60 + Number(slot.dataset.minute || 0);
  const lengthMinutes = duration(eventValue.startTime, eventValue.endTime);
  const newStart = timeFromMinutes(newStartMinute);
  const newEnd = timeFromMinutes(newStartMinute + lengthMinutes);
  const nextEvent = {
    ...eventValue,
    date: slot.dataset.date,
    startTime: newStart,
    endTime: newEnd,
    updatedAt: new Date().toISOString()
  };
  const conflict = findEventConflict(nextEvent, eventId);
  if (conflict) {
    showToast(`겹치는 일정이 있습니다: ${conflict.name}`);
    return;
  }
  await put("schedule_events", nextEvent);
  await refresh("일정을 이동했습니다.");
}

// Move event to a new month day (for monthly view drag)
async function moveEventToMonthDay(eventId, slot) {
  const eventValue = await get("schedule_events", eventId);
  const nextDate = slot?.dataset?.monthDay;
  if (!eventValue || !nextDate) return;
  const nextEvent = {
    ...eventValue,
    date: nextDate,
    updatedAt: new Date().toISOString()
  };
  const conflict = findEventConflict(nextEvent, eventId);
  if (conflict) {
    showToast(`겹치는 일정이 있습니다: ${conflict.name}`);
    return;
  }
  await put("schedule_events", nextEvent);
  await refresh("일정을 이동했습니다.");
}

async function scheduleTask(taskId) {
  const task = await get("tasks", taskId);
  if (!task) return;
  const startDate = task.dueDate || state.selectedDate || today();
  const startTime = "09:00";
  const estimated = Number(task.estimatedMinutes || 60);
  const candidate = {
    ...eventSeed(task.name, startDate, startTime, timeFromMinutes(minutes(startTime) + estimated), task.categoryId, memory.categories.findIndex((c) => c.id === task.categoryId), `할 일에서 배치됨${task.projectId ? ` · ${memory.projects.find((p) => p.id === task.projectId)?.name || "프로젝트"}` : ""}`),
    goalId: task.goalId || "",
    taskId: task.id
  };
  const conflict = findEventConflict(candidate);
  if (conflict) {
    showToast(`겹치는 일정이 있습니다: ${conflict.name}`);
    return;
  }
  await put("schedule_events", candidate);
  await put("tasks", { ...task, scheduledEventId: candidate.id, updatedAt: new Date().toISOString() });
  state.modal = null;
  state.modalData = null;
  await refresh("할 일을 캘린더에 배치했습니다.");
}

// Skip a single occurrence of a repeat event
async function skipRepeatEvent(eventId) {
  const eventValue = await get("schedule_events", eventId);
  if (!eventValue?.repeatRuleId) return;
  const rule = await get("repeat_rules", eventValue.repeatRuleId);
  if (!rule) return;
  const exceptionDates = Array.isArray(rule.exceptionDates) ? rule.exceptionDates : [];
  const nextExceptions = exceptionDates.includes(eventValue.date) ? exceptionDates : [...exceptionDates, eventValue.date];
  await put("repeat_rules", { ...rule, exceptionDates: nextExceptions, updatedAt: new Date().toISOString() });
  await remove("schedule_events", eventId);
  state.modal = null;
  state.modalData = null;
  await refresh("이번 반복 회차를 제외했습니다.");
}

function importBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const backup = JSON.parse(reader.result);
      const hasValidStore = STORES.some((store) => Array.isArray(backup[store]));
      if (!hasValidStore) {
        await refresh("백업 형식이 올바르지 않습니다.");
        return;
      }
      if (!confirmDanger("백업을 가져오면 현재 브라우저의 기존 데이터가 백업 파일 내용으로 교체됩니다. 계속할까요?")) return;
      await importBackupObject(backup);
      await seed();
      await refresh("백업을 복원했습니다.");
    } catch (error) {
      console.error(error);
      await refresh("백업 파일을 읽지 못했습니다.");
    }
  };
  reader.readAsText(file);
}

function askDelete(kind) {
  return confirmDanger(`${kind}을(를) 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
}

document.addEventListener("click", async (event) => {
  if (Date.now() < state.suppressClickUntil) return;
  const target = event.target.closest("button, [data-close]");
  if (target?.dataset.action === "signInGoogle") {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      showToast(friendlyAuthError(error));
    }
    return;
  }
  if (target?.dataset.action === "signOut") {
    try {
      await signOut();
      state.authUser = null;
      state.syncStatus = await dbHealthCheck();
      render();
    } catch (error) {
      console.error(error);
      showToast("로그아웃에 실패했습니다.");
    }
    return;
  }
  if (target?.dataset.goalStep) {
    const goal = await get("goals", target.dataset.goalStep);
    if (goal) {
      const step = Number(target.dataset.step || 1);
      await put("goals", { ...goal, current: Math.max(0, Number(goal.current || 0) + step), manualProgress: true, updatedAt: new Date().toISOString() });
      await refresh("목표 진행도를 반영했습니다.");
    }
    return;
  }
  const editableCard = event.target.closest("[data-task], [data-goal], [data-project]");
  if (!target && editableCard) {
    if (editableCard.dataset.task) {
      const task = await get("tasks", editableCard.dataset.task);
      if (task) {
        state.modal = "task";
        state.modalData = task;
        render();
      }
      return;
    }
    if (editableCard.dataset.goal) {
      const goal = await get("goals", editableCard.dataset.goal);
      if (goal) {
        state.modal = "goal";
        state.modalData = goal;
        render();
      }
      return;
    }
    if (editableCard.dataset.project) {
      const project = await get("projects", editableCard.dataset.project);
      if (project) {
        state.modal = "project";
        state.modalData = project;
        render();
      }
      return;
    }
  }
  if (!target) return;
  if (target.dataset.view) {
    state.view = target.dataset.view;
    render();
    return;
  }
  if (target.dataset.modal) {
    state.modal = target.dataset.modal;
    state.modalData = null;
    render();
    return;
  }
  if (target.dataset.close) {
    state.modal = null;
    state.modalData = null;
    render();
    return;
  }
  if (target.dataset.event) {
    const eventValue = await get("schedule_events", target.dataset.event);
    if (eventValue) openEventModal(eventValue);
    return;
  }
  if (target.dataset.deleteEvent) {
    if (!askDelete("일정")) return;
    await remove("schedule_events", target.dataset.deleteEvent);
    state.modal = null;
    state.modalData = null;
    await refresh("일정을 삭제했습니다.");
    return;
  }
  if (target.dataset.skipRepeatEvent) {
    if (!askDelete("이번 반복 회차")) return;
    await skipRepeatEvent(target.dataset.skipRepeatEvent);
    return;
  }
  if (target.dataset.deleteGoal) {
    if (!askDelete("목표")) return;
    await remove("goals", target.dataset.deleteGoal);
    state.modal = null;
    state.modalData = null;
    await refresh("목표를 삭제했습니다.");
    return;
  }
  if (target.dataset.deleteTask) {
    if (!askDelete("할 일")) return;
    await remove("tasks", target.dataset.deleteTask);
    state.modal = null;
    state.modalData = null;
    await refresh("할 일을 삭제했습니다.");
    return;
  }
  if (target.dataset.scheduleTask) {
    await scheduleTask(target.dataset.scheduleTask);
    return;
  }
  if (target.dataset.editGoal) {
    const goal = await get("goals", target.dataset.editGoal);
    if (goal) {
      state.modal = "goal";
      state.modalData = goal;
      render();
    }
    return;
  }
  if (target.dataset.deleteProject) {
    if (!askDelete("프로젝트")) return;
    const projectId = target.dataset.deleteProject;
    await remove("projects", projectId);
    await Promise.all(memory.tasks.filter((task) => task.projectId === projectId).map((task) => put("tasks", { ...task, projectId: "", updatedAt: new Date().toISOString() })));
    state.modal = null;
    state.modalData = null;
    await refresh("프로젝트를 삭제했습니다.");
    return;
  }
  if (target.dataset.editRepeat) {
    const repeat = await get("repeat_rules", target.dataset.editRepeat);
    if (repeat) {
      state.modal = "repeat";
      state.modalData = repeat;
      render();
    }
    return;
  }
  if (target.dataset.toggleRepeat) {
    const repeat = await get("repeat_rules", target.dataset.toggleRepeat);
    if (repeat) {
      const next = { ...repeat, isActive: !repeat.isActive, updatedAt: new Date().toISOString() };
      const generatedEvents = repeatEvents(next);
      const existingEvents = memory.events.filter((eventValue) => eventValue.repeatRuleId !== next.id);
      if (next.isActive) {
        const conflict = generatedEvents.find((generated) => existingEvents.some((eventValue) => eventsOverlap(generated, eventValue)));
        if (conflict) {
          const conflictingEvent = existingEvents.find((eventValue) => eventsOverlap(conflict, eventValue));
          showToast(`반복일정이 기존 일정과 겹칩니다: ${conflictingEvent?.name || "이름 없음"}`);
          return;
        }
      }
      await put("repeat_rules", next);
      await Promise.all(memory.events.filter((eventValue) => eventValue.repeatRuleId === next.id).map((eventValue) => remove("schedule_events", eventValue.id)));
      if (next.isActive) await bulkPut("schedule_events", generatedEvents);
    }
    await refresh("반복일정 상태를 변경했습니다.");
    return;
  }
  if (target.dataset.deleteRepeat) {
    if (!askDelete("반복일정")) return;
    const id = target.dataset.deleteRepeat;
    await remove("repeat_rules", id);
    await Promise.all(memory.events.filter((eventValue) => eventValue.repeatRuleId === id).map((eventValue) => remove("schedule_events", eventValue.id)));
    await refresh("반복일정을 삭제했습니다.");
    return;
  }
  if (target.dataset.filterCat) {
    state.selectedCategory = target.dataset.filterCat;
    render();
    return;
  }
  if (target.dataset.dataTab) {
    state.dataTab = target.dataset.dataTab;
    render();
    return;
  }
  if (target.dataset.day) {
    state.selectedDate = target.dataset.day;
    state.view = "daily";
    render();
    return;
  }
  if (target.dataset.monthSelect) {
    state.selectedDate = target.dataset.monthSelect;
    openEventModal({ date: target.dataset.monthSelect, startTime: "09:00", endTime: "10:00", categoryId: memory.categories[0]?.id || "", colorIndex: 0 });
    return;
  }
  if (target.dataset.complete) {
    const eventValue = await get("schedule_events", target.dataset.complete);
    await put("schedule_events", { ...eventValue, status: eventValue.status === "completed" ? "planned" : "completed", updatedAt: new Date().toISOString() });
    await refresh("상태를 변경했습니다.");
    return;
  }
  if (target.dataset.taskDone) {
    const task = await get("tasks", target.dataset.taskDone);
    await put("tasks", { ...task, status: task.status === "done" ? "todo" : "done", updatedAt: new Date().toISOString() });
    await refresh("할 일을 갱신했습니다.");
    return;
  }
  if (target.dataset.habit && target.dataset.date) {
    const id = `${target.dataset.habit}_${target.dataset.date}`;
    const old = await get("habit_logs", id);
    await put("habit_logs", { id, habitId: target.dataset.habit, date: target.dataset.date, done: !old?.done, updatedAt: new Date().toISOString() });
    await refresh("습관을 기록했습니다.");
    return;
  }
  if (target.dataset.ai) {
    $("#aiPrompt").value = buildPrompt(target.dataset.ai);
    return;
  }
  if (target.dataset.theme) {
    state.theme = target.dataset.theme;
    await put("settings", { ...memory.settings, id: "app", theme: state.theme, updatedAt: new Date().toISOString() });
    await refresh("테마를 변경했습니다.");
    return;
  }
  if (target.dataset.action === "prevWeek") state.weekStart = addDays(state.weekStart, -7);
  if (target.dataset.action === "thisWeek") state.weekStart = weekStart(today());
  if (target.dataset.action === "nextWeek") state.weekStart = addDays(state.weekStart, 7);
  if (["prevWeek", "thisWeek", "nextWeek"].includes(target.dataset.action)) {
    state.selectedDate = state.weekStart;
    render();
    return;
  }
  if (target.dataset.action === "prevMonth") state.monthStart = monthStart(addMonths(state.monthStart, -1));
  if (target.dataset.action === "thisMonth") state.monthStart = monthStart(today());
  if (target.dataset.action === "nextMonth") state.monthStart = monthStart(addMonths(state.monthStart, 1));
  if (["prevMonth", "thisMonth", "nextMonth"].includes(target.dataset.action)) {
    state.selectedDate = state.monthStart;
    render();
    return;
  }
  if (target.dataset.action === "copyPrompt") {
    await navigator.clipboard.writeText($("#aiPrompt").value);
    await refresh("프롬프트를 복사했습니다.");
  }
  if (target.dataset.action === "exportBackup") {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-planner-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await refresh("백업 파일을 만들었습니다.");
  }
  if (target.dataset.action === "importBackup") {
    const input = $(".backupInput");
    if (input) input.click();
  }
  if (target.dataset.action === "checkSupabase") {
    state.syncStatus = await dbHealthCheck();
    render();
    return;
  }
  if (target.dataset.action === "syncFlush") {
    const result = await flushSyncQueue();
    state.syncStatus = await dbHealthCheck();
    await refresh(result.ok ? "대기 동기화를 완료했습니다." : "동기화 대기가 남아 있습니다.");
    return;
  }
  if (target.dataset.action === "syncPush") {
    try {
      await syncAllToSupabase();
      state.syncStatus = await dbHealthCheck();
      await refresh("Supabase로 올렸습니다.");
    } catch (error) {
      console.error(error);
      await refresh("Supabase 업로드에 실패했습니다.");
    }
    return;
  }
  if (target.dataset.action === "syncPull") {
    if (!confirmDanger("Supabase 데이터를 현재 브라우저 로컬 저장소에 병합합니다. 계속할까요?")) return;
    try {
      await pullAllFromSupabase();
      await seed();
      state.syncStatus = await dbHealthCheck();
      await refresh("Supabase에서 가져왔습니다.");
    } catch (error) {
      console.error(error);
      await refresh("Supabase 가져오기에 실패했습니다.");
    }
    return;
  }
  if (target.dataset.action === "clearDone") {
    await Promise.all(memory.tasks.filter((t) => t.status === "done").map((t) => remove("tasks", t.id)));
    await refresh("완료 할 일을 정리했습니다.");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches(".globalSearch")) {
    state.query = event.target.value;
    render(true);
    return;
  }
  if (state.modal === "event" && event.target.matches('.modal input[name="name"]')) {
    const q = event.target.value.trim().toLowerCase();
    if (q.length < 2) return;
    const template = memory.templates.find((item) => item.name.toLowerCase() === q) || memory.templates.find((item) => item.name.toLowerCase().includes(q));
    if (!template) return;
    const form = event.target.closest("form");
    const categorySelect = form?.querySelector('select[name="categoryId"]');
    const memo = form?.querySelector('textarea[name="memo"]');
    if (categorySelect && !categorySelect.dataset.autofilled) {
      categorySelect.value = template.categoryId;
      categorySelect.dataset.autofilled = "1";
    }
    if (memo && !memo.value) memo.value = template.defaultMemo || "";
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches(".backupInput")) {
    importBackupFile(event.target.files?.[0]);
    event.target.value = "";
  }
});

window.addEventListener("planner-sync", async () => {
  if (state.view !== "settings") return;
  state.syncStatus = await dbHealthCheck();
  render();
});

document.addEventListener("mousedown", (event) => {
  if (!["planner", "monthly"].includes(state.view) || event.button !== 0 || state.modal) return;

  const eventChipElement = event.target.closest(".eventChip, .eventPill");
  const plannerSlot = event.target.closest(".slot");
  const monthSlot = event.target.closest(".monthSlot");

  if (eventChipElement) {
    state.drag = {
      type: state.view === "monthly" ? "monthMove" : "move",
      eventId: eventChipElement.dataset.event,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      targetSlot: state.view === "monthly" ? eventChipElement.closest(".monthSlot") : eventChipElement.closest(".slot")
    };

    eventChipElement.classList.add("dragging");
    event.preventDefault();
    return;
  }

  if (state.view === "planner" && plannerSlot) {
    const startMinute = Number(plannerSlot.dataset.hour) * 60 + Number(plannerSlot.dataset.minute || 0);

    state.drag = {
      type: "select",
      date: plannerSlot.dataset.date,
      startMinute,
      endMinute: startMinute
    };

    paintPlannerSelection();
    event.preventDefault();
    return;
  }

  if (state.view === "monthly" && monthSlot) {
    state.selectedDate = monthSlot.dataset.monthDay || state.selectedDate;
  }
});

document.addEventListener("mousemove", (event) => {
  if (!state.drag) return;

  if (["move", "monthMove"].includes(state.drag.type)) {
    const movedEnough =
      Math.abs(event.clientX - state.drag.startX) > 6 ||
      Math.abs(event.clientY - state.drag.startY) > 6;

    if (!movedEnough && !state.drag.moved) return;

    state.drag.moved = true;

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const slot = state.drag.type === "monthMove"
      ? element?.closest?.(".monthSlot")
      : element?.closest?.(".slot");

    if (slot) state.drag.targetSlot = slot;
    paintMoveTarget(slot);
    event.preventDefault();
    return;
  }

  if (state.drag.type === "select") {
    const slot = slotFromPoint(event.clientX, event.clientY);

    if (slot && slot.dataset.date === state.drag.date) {
      state.drag.endMinute = Number(slot.dataset.hour) * 60 + Number(slot.dataset.minute || 0);
      paintPlannerSelection();
    }

    event.preventDefault();
  }
});

document.addEventListener("mouseup", async () => {
  if (!state.drag) return;

  const drag = state.drag;
  state.drag = null;
  clearPlannerDragClasses();

  if (drag.type === "move") {
    if (drag.moved && drag.targetSlot) {
      state.suppressClickUntil = Date.now() + 350;
      await moveEventToSlot(drag.eventId, drag.targetSlot);
    }
    return;
  }

  if (drag.type === "monthMove") {
    if (drag.moved && drag.targetSlot) {
      state.suppressClickUntil = Date.now() + 350;
      await moveEventToMonthDay(drag.eventId, drag.targetSlot);
    }
    return;
  }

  if (drag.type === "select") {
    const start = Math.min(drag.startMinute, drag.endMinute);
    const end = Math.max(drag.startMinute, drag.endMinute) + 30;
    const startTime = timeFromMinutes(start);
    const endTime = timeFromMinutes(end);

    state.suppressClickUntil = Date.now() + 350;
    openEventModal({
      date: drag.date,
      startTime,
      endTime,
      categoryId: memory.categories[0]?.id || "",
      colorIndex: 0
    });
  }
});

async function boot() {
  state.authUser = await getAuthUser();
  state.authReady = true;
  onAuthStateChange(async (user) => {
    state.authUser = user;
    state.authReady = true;
    if (user) {
      await flushSyncQueue();
      state.syncStatus = await dbHealthCheck();
    }
    render();
  });
  await seed();
  if (state.authUser) await flushSyncQueue();
  await refresh();
}

boot().catch((error) => {
  console.error(error);
  const app = document.querySelector("#app");
  if (app) app.innerHTML = `<div class="empty">앱을 시작하지 못했습니다. 콘솔을 확인해 주세요.</div>`;
});
