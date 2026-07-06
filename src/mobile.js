import { all, get, put, flushSyncQueue, pullAllFromSupabase } from "./db.js";
import { getAuthUser, isSupabaseConfigured, isSupabaseReady, onAuthStateChange, signInWithGoogle, signOut } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const pad = (n) => String(n).padStart(2, "0");
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => iso(new Date());
const dateFromISO = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (value, days) => {
  const d = dateFromISO(value);
  d.setDate(d.getDate() + days);
  return iso(d);
};
const weekStart = (value) => {
  const d = dateFromISO(value);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return iso(d);
};
const monthStart = (value = today()) => `${value.slice(0, 8)}01`;
const monthEnd = (value = today()) => {
  const [y, m] = value.split("-").map(Number);
  return iso(new Date(y, m, 0));
};
const addMonths = (value, months) => {
  const d = dateFromISO(value);
  d.setMonth(d.getMonth() + months, 1);
  return iso(d);
};
const fmtMD = (value) => {
  const d = dateFromISO(value);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};
const fmtFull = (value) => {
  const d = dateFromISO(value);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const timestampTitle = () => {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} / ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const minutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const timeFromMinutes = (value) => `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const escapeAttr = escapeHtml;

const themes = {
  paper: {
    label: "Paper",
    dark: false,
    colors: ["#5f6f52", "#b99470", "#a67c7c", "#6b8a9f", "#8b7aa8"],
    vars: { bg: "#f5f1ea", shell: "#ebe5db", card: "#fffdf9", soft: "#f7f2ea", text: "#202124", muted: "#77736b", line: "#dfd7ca", accent: "#5f6f52", accent2: "#b99470", danger: "#c75146" }
  },
  mist: {
    label: "Mist",
    dark: false,
    colors: ["#4d7c8a", "#7a9e9f", "#b8a27a", "#7d84b2", "#ba7f7f"],
    vars: { bg: "#eef3f4", shell: "#dfe9eb", card: "#fbfefe", soft: "#edf6f7", text: "#172326", muted: "#637276", line: "#d2e0e3", accent: "#4d7c8a", accent2: "#7d84b2", danger: "#c65353" }
  },
  mono: {
    label: "Mono",
    dark: false,
    colors: ["#252525", "#6d6d6d", "#9d8771", "#687a8f", "#8a7b8f"],
    vars: { bg: "#f2f2ef", shell: "#e3e3df", card: "#ffffff", soft: "#eeeeeb", text: "#1f1f1d", muted: "#6e6e68", line: "#d8d8d2", accent: "#252525", accent2: "#9d8771", danger: "#b84d4d" }
  },
  dark: {
    label: "Dark",
    dark: true,
    colors: ["#a994bd", "#91a7c5", "#8eb5ad", "#c4a47d", "#bd8f9a"],
    vars: { bg: "#050505", shell: "#0b0b0b", card: "#121212", soft: "#181818", text: "#f2f2f2", muted: "#a3a3a3", line: "#2b2b2b", accent: "#a994bd", accent2: "#8eb5ad", danger: "#ff7d7d" }
  }
};

const state = {
  user: null,
  ready: false,
  view: "main",
  calendarView: "day",
  date: today(),
  weekStart: weekStart(today()),
  monthStart: monthStart(today()),
  modal: null,
  editingEvent: null,
  toast: "",
  theme: localStorage.getItem("planner.mobile.theme") || "paper",
  offlineMode: false
};

const memory = {
  categories: [],
  events: [],
  notes: [],
  goals: []
};

function applyTheme() {
  const theme = themes[state.theme] || themes.paper;
  Object.entries(theme.vars).forEach(([key, value]) => document.documentElement.style.setProperty(`--${key}`, value));
  document.documentElement.dataset.theme = theme.dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.vars.bg);
}

function color(index = 0) {
  return (themes[state.theme] || themes.paper).colors[Math.abs(Number(index || 0)) % (themes[state.theme] || themes.paper).colors.length];
}

function category(id) {
  return memory.categories.find((cat) => cat.id === id) || { id: "", name: "기타" };
}

async function ensureCategories() {
  if ((await all("categories")).length > 0) return;
  const now = new Date().toISOString();
  const defaults = ["공부", "운동", "독서", "프로젝트", "생활", "휴식"];
  await Promise.all(defaults.map((name, sortOrder) => put("categories", { id: uid("cat"), name, sortOrder, isActive: true, createdAt: now, updatedAt: now })));
}

async function load() {
  await ensureCategories();
  memory.categories = (await all("categories")).filter((cat) => cat.isActive !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  memory.events = await all("schedule_events");
  memory.notes = await all("notes");
  memory.goals = await all("goals");
}

function dayEvents(date = state.date) {
  return memory.events.filter((event) => event.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function weekDates() {
  return Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
}

function monthDates() {
  const start = weekStart(monthStart(state.monthStart));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function importantEvent(event) {
  return /중요|시험|마감|면접|발표|병원|예약/i.test(`${event.name} ${event.memo || ""}`);
}

function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

function loginView() {
  return `<main class="mLogin">
    <section class="mLoginCard">
      <div class="mLogo"></div>
      <p class="eyebrow">Life Planner Mobile</p>
      <h1>오늘, 이번 주, 이번 달을 빠르게 확인하세요.</h1>
      <p>모바일은 일정 확인과 빠른 입력에 집중합니다. 자세한 계획은 데스크탑에서 이어가세요.</p>
      <button class="primary" data-action="login">Google로 로그인</button>
    </section>
    ${toast()}
  </main>`;
}

function appView() {
  return `<main class="mobileShell">
    <header class="mTop">
      <div>
        <p class="eyebrow">${themes[state.theme].label}</p>
        <h1>${title()}</h1>
      </div>
    </header>
    ${state.view === "calendar" ? `<nav class="viewTabs">${["day", "week", "month"].map((view) => `<button class="${state.calendarView === view ? "active" : ""}" data-calendar-view="${view}">${view.toUpperCase()}</button>`).join("")}</nav><section class="mNav"><button data-action="prev">이전</button><button data-action="today">이번</button><button data-action="next">다음</button></section>` : ""}
    <section class="mContent">${content()}</section>
    <footer class="mBottom">
      <button class="${state.view === "main" ? "active" : ""}" data-view="main">메인</button>
      <button class="${state.view === "calendar" ? "active" : ""}" data-view="calendar">일정</button>
      <button class="${state.view === "memo" ? "active" : ""}" data-view="memo">메모</button>
      <button class="${state.view === "settings" ? "active" : ""}" data-view="settings">설정</button>
    </footer>
    ${state.view === "calendar" ? `<button class="fab" data-action="newEvent">+</button>` : ""}
    ${modal()}
    ${toast()}
  </main>`;
}

function title() {
  if (state.view === "main") return "오늘";
  if (state.view === "memo") return "빠른 메모";
  if (state.view === "settings") return "설정";
  if (state.calendarView === "day") return fmtFull(state.date);
  if (state.calendarView === "week") return `${fmtMD(state.weekStart)} - ${fmtMD(addDays(state.weekStart, 6))}`;
  const d = dateFromISO(state.monthStart);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function content() {
  if (state.view === "main") return mainView();
  if (state.view === "memo") return memoView();
  if (state.view === "settings") return mobileSettingsView();
  if (state.calendarView === "week") return weekView();
  if (state.calendarView === "month") return monthView();
  return dayView();
}

function mainView() {
  const events = dayEvents();
  const completed = events.filter((event) => event.status === "completed").length;
  const activeGoals = memory.goals.filter((goal) => goal.status !== "done").slice(0, 4);
  const latestNotes = [...memory.notes].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0, 3);
  return `<div class="mainStack">
    <section class="todayHero">
      <span>${fmtFull(today())} · ${events.length}개 일정</span>
      <h2>${events.find((event) => event.status !== "completed")?.name || "오늘 실행할 일을 확인하세요"}</h2>
      <p>완료 ${completed}/${events.length || 0} · 메모 ${memory.notes.length}개 · 목표 ${memory.goals.length}개</p>
    </section>
    <section class="summaryGrid">
      <article><b>${events.length}</b><span>오늘 일정</span></article>
      <article><b>${completed}</b><span>완료</span></article>
      <article><b>${activeGoals.length}</b><span>진행 목표</span></article>
    </section>
    <section class="mobileCard"><div class="cardHead"><h3>오늘 일정</h3><button data-view="calendar">전체</button></div>${events.slice(0, 5).map(eventCard).join("") || empty("오늘 일정이 없습니다.")}</section>
    <section class="mobileCard"><div class="cardHead"><h3>목표</h3><span>확인용</span></div>${activeGoals.map(goalMini).join("") || empty("진행 중인 목표가 없습니다.")}</section>
    <section class="mobileCard"><div class="cardHead"><h3>최근 메모</h3><button data-view="memo">작성</button></div>${latestNotes.map(noteMini).join("") || empty("최근 메모가 없습니다.")}</section>
  </div>`;
}

function memoView() {
  const latestNotes = [...memory.notes].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return `<div class="mainStack memoStack">
    ${latestNotes.map(noteMini).join("") || empty("메모가 없습니다.")}
    <button class="bottomAction primary" data-action="quickNote">새 메모</button>
  </div>`;
}

function mobileSettingsView() {
  return `<div class="mainStack">
    <section class="mobileCard"><div class="cardHead"><h3>테마</h3><span>모바일 전용</span></div><div class="themeList">${Object.entries(themes).map(([key, theme]) => `<button class="${state.theme === key ? "active" : ""}" data-mobile-theme="${key}"><span>${theme.label}</span><i>${theme.colors.map((c) => `<b style="background:${c}"></b>`).join("")}</i></button>`).join("")}</div></section>
    <section class="mobileCard"><div class="cardHead"><h3>동기화</h3><span>${state.user?.email || "offline"}</span></div><button class="soft" data-action="syncNow">지금 동기화</button><button class="soft" data-action="enableNotifications">알림 권한 켜기</button><button class="ghost" data-action="logout">로그아웃</button></section>
  </div>`;
}

function dayView() {
  return `<div class="dayStack">
    <section class="dayCalendar">${dailySlots()}</section>
  </div>`;
}

function dailySlots() {
  const start = 6 * 60;
  const rows = Array.from({ length: 36 }, (_, i) => start + i * 30);
  return `<div class="timeRail">${rows.map((minute) => `<div class="${minute % 60 === 0 ? "hour" : "half"}"><span>${minute % 60 === 0 ? `${Math.floor(minute / 60)}시` : "30"}</span></div>`).join("")}</div>
    <div class="dailyTrack">
      ${rows.map((minute) => `<button class="dailyCell ${minute % 60 === 0 ? "hour" : "half"}" data-new-at="${timeFromMinutes(minute)}"></button>`).join("")}
      ${dayEvents().map((event) => {
        const top = ((minutes(event.startTime) - start) / 30) * 42;
        const height = Math.max(36, ((minutes(event.endTime) - minutes(event.startTime)) / 30) * 42 - 5);
        return `<button class="mobileEventBlock ${event.status === "completed" ? "done" : ""}" data-event="${event.id}" style="top:${top}px;height:${height}px;--event:${color(event.colorIndex)}"><b>${event.name}</b><span>${event.startTime}-${event.endTime}</span></button>`;
      }).join("")}
    </div>`;
}

function weekView() {
  const dates = weekDates();
  const hours = Array.from({ length: 18 }, (_, i) => 6 + i);
  return `<div class="weekScroller">
    <div class="weekBoard">
      <div class="weekHead blank"></div>
      ${dates.map((date) => `<div class="weekHead ${date === today() ? "today" : ""}"><b>${["월", "화", "수", "목", "금", "토", "일"][dates.indexOf(date)]}</b><span>${fmtMD(date)}</span></div>`).join("")}
      ${hours.map((hour) => `<div class="weekTime">${hour}시</div>${dates.map((date) => {
        const events = memory.events.filter((event) => event.date === date && Number(event.startTime.slice(0, 2)) === hour);
        return `<div class="weekCell">${events.map((event) => `<button data-event="${event.id}" style="--event:${color(event.colorIndex)}">${event.name}</button>`).join("")}</div>`;
      }).join("")}`).join("")}
    </div>
  </div>`;
}

function monthView() {
  const currentMonth = state.monthStart.slice(0, 7);
  return `<div class="monthGrid">
    ${["월", "화", "수", "목", "금", "토", "일"].map((d) => `<b class="monthDow">${d}</b>`).join("")}
    ${monthDates().map((date) => {
      const events = memory.events.filter((event) => event.date === date);
      return `<button class="monthDay ${date.slice(0, 7) !== currentMonth ? "mutedDay" : ""} ${date === today() ? "today" : ""}" data-day="${date}">
        <strong>${dateFromISO(date).getDate()}</strong>
        <span>${events.slice(0, 4).map((event) => `<i class="${importantEvent(event) ? "important" : ""}" style="background:${color(event.colorIndex)}"></i>`).join("")}</span>
        ${events.length > 4 ? `<em>+${events.length - 4}</em>` : ""}
      </button>`;
    }).join("")}
  </div>`;
}

function eventCard(event) {
  return `<article class="mEvent ${event.status === "completed" ? "done" : ""}" data-event="${event.id}">
    <i style="background:${color(event.colorIndex)}"></i>
    <div><b>${escapeHtml(event.name)}</b><span>${event.startTime}-${event.endTime} · ${escapeHtml(category(event.categoryId).name)}</span></div>
    <button data-complete="${event.id}">${event.status === "completed" ? "완료" : "체크"}</button>
  </article>`;
}

function goalMini(goal) {
  const current = Number(goal.current || 0);
  const target = Math.max(1, Number(goal.target || 1));
  const pct = clamp(Math.round((current / target) * 100), 0, 100);
  return `<article class="goalMini"><div><b>${escapeHtml(goal.name)}</b><span>${current}/${target} ${escapeHtml(goal.unit || "회")}</span></div><p><i style="width:${pct}%"></i></p><em>${pct}%</em></article>`;
}

function noteMini(note) {
  return `<article class="noteMini"><b>${escapeHtml(note.title || "메모")}</b><p>${escapeHtml(note.body || "")}</p></article>`;
}

function empty(text) {
  return `<div class="mEmpty">${text}</div>`;
}

function modal() {
  if (state.modal === "settings") return settingsModal();
  if (state.modal === "note") return noteModal();
  if (state.modal === "event") return eventModal();
  return "";
}

function eventModal() {
  const event = state.editingEvent || {};
  const date = event.date || state.date;
  return `<div class="sheetBackdrop" data-close="1"><form class="bottomSheet" data-form="event">
    <header><h3>${event.id ? "일정 수정" : "일정 추가"}</h3><button type="button" data-close="1">닫기</button></header>
    <label>일정명<input name="name" required value="${escapeAttr(event.name || "")}" placeholder="예: 운동"></label>
    <div class="two"><label>날짜<input type="date" name="date" value="${date}"></label><label>분류<select name="categoryId">${memory.categories.map((cat) => `<option value="${cat.id}" ${event.categoryId === cat.id ? "selected" : ""}>${escapeHtml(cat.name)}</option>`).join("")}</select></label></div>
    <div class="two"><label>시작<input type="time" name="startTime" value="${event.startTime || "09:00"}" step="1800"></label><label>종료<input type="time" name="endTime" value="${event.endTime || "10:00"}" step="1800"></label></div>
    <label>메모<textarea name="memo">${escapeHtml(event.memo || "")}</textarea></label>
    <button class="primary" type="submit">저장</button>
  </form></div>`;
}

function noteModal() {
  return `<div class="sheetBackdrop" data-close="1"><form class="bottomSheet" data-form="note">
    <header><h3>빠른 메모</h3><button type="button" data-close="1">닫기</button></header>
    <label>제목<input name="title" value="${timestampTitle()}"></label>
    <label>내용<textarea name="body" required placeholder="나중에 데스크탑에서 다시 볼 내용을 적어두세요."></textarea></label>
    <button class="primary" type="submit">저장</button>
  </form></div>`;
}

function settingsModal() {
  return `<div class="sheetBackdrop" data-close="1"><section class="bottomSheet">
    <header><h3>모바일 설정</h3><button type="button" data-close="1">닫기</button></header>
    <p class="muted">모바일 테마는 이 기기에만 저장됩니다. 데스크탑 테마와 동기화하지 않습니다.</p>
    <div class="themeList">${Object.entries(themes).map(([key, theme]) => `<button class="${state.theme === key ? "active" : ""}" data-mobile-theme="${key}"><span>${theme.label}</span><i>${theme.colors.map((c) => `<b style="background:${c}"></b>`).join("")}</i></button>`).join("")}</div>
    <button class="soft" data-action="enableNotifications">알림 권한 켜기</button>
    <button class="soft" data-action="syncNow">지금 동기화</button>
    <button class="ghost" data-action="logout">로그아웃</button>
  </section></div>`;
}

function toast() {
  return state.toast ? `<div class="mToast">${escapeHtml(state.toast)}</div>` : "";
}

async function saveEvent(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const now = new Date().toISOString();
  const old = state.editingEvent?.id ? await get("schedule_events", state.editingEvent.id) : null;
  if (minutes(data.endTime) <= minutes(data.startTime)) {
    showToast("종료 시간은 시작 시간보다 늦어야 합니다.");
    return;
  }
  await put("schedule_events", {
    id: old?.id || uid("evt"),
    name: data.name,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    categoryId: data.categoryId,
    colorIndex: Math.max(0, memory.categories.findIndex((cat) => cat.id === data.categoryId)),
    memo: data.memo || "",
    status: old?.status || "planned",
    repeatRuleId: old?.repeatRuleId || "",
    goalId: old?.goalId || "",
    createdAt: old?.createdAt || now,
    updatedAt: now,
    completedAt: old?.completedAt || ""
  });
  state.modal = null;
  state.editingEvent = null;
  await refresh("일정을 저장했습니다.");
}

async function saveNote(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const now = new Date().toISOString();
  await put("notes", { id: uid("not"), title: data.title || timestampTitle(), body: data.body, tag: "mobile", date: today(), createdAt: now, updatedAt: now });
  state.modal = null;
  await refresh("메모를 저장했습니다.");
}

async function refresh(message = "") {
  await load();
  if (message) state.toast = message;
  render();
  if (message) setTimeout(() => {
    state.toast = "";
    render();
  }, 2400);
}

function render() {
  applyTheme();
  $("#mobileApp").innerHTML = state.ready && (state.user || state.offlineMode) ? appView() : loginView();
}

document.addEventListener("click", async (event) => {
  if (event.target.dataset.close) {
    state.modal = null;
    state.editingEvent = null;
    render();
    return;
  }

  const target = event.target.closest("button, [data-event], [data-day]");
  if (!target) return;
  if (target.dataset.action === "login") {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      showToast("Google 로그인을 확인해주세요.");
    }
    return;
  }
  if (target.dataset.view) {
    state.view = target.dataset.view;
    render();
    return;
  }
  if (target.dataset.calendarView) {
    state.calendarView = target.dataset.calendarView;
    state.view = "calendar";
    render();
    return;
  }
  if (target.dataset.action === "prev") {
    if (state.calendarView === "day") state.date = addDays(state.date, -1);
    if (state.calendarView === "week") state.weekStart = addDays(state.weekStart, -7);
    if (state.calendarView === "month") state.monthStart = monthStart(addMonths(state.monthStart, -1));
    render();
    return;
  }
  if (target.dataset.action === "today") {
    state.date = today();
    state.weekStart = weekStart(today());
    state.monthStart = monthStart(today());
    render();
    return;
  }
  if (target.dataset.action === "next") {
    if (state.calendarView === "day") state.date = addDays(state.date, 1);
    if (state.calendarView === "week") state.weekStart = addDays(state.weekStart, 7);
    if (state.calendarView === "month") state.monthStart = monthStart(addMonths(state.monthStart, 1));
    render();
    return;
  }
  if (target.dataset.day) {
    state.date = target.dataset.day;
    state.weekStart = weekStart(state.date);
    state.view = "calendar";
    state.calendarView = "day";
    render();
    return;
  }
  if (target.dataset.action === "newEvent") {
    state.modal = "event";
    state.editingEvent = null;
    render();
    return;
  }
  if (target.dataset.newAt) {
    state.modal = "event";
    state.editingEvent = { date: state.date, startTime: target.dataset.newAt, endTime: timeFromMinutes(clamp(minutes(target.dataset.newAt) + 60, 0, 1439)) };
    render();
    return;
  }
  if (target.dataset.complete) {
    const eventValue = await get("schedule_events", target.dataset.complete);
    if (eventValue) await put("schedule_events", { ...eventValue, status: eventValue.status === "completed" ? "planned" : "completed", updatedAt: new Date().toISOString() });
    await refresh("상태를 바꿨습니다.");
    return;
  }
  if (target.dataset.event) {
    state.editingEvent = await get("schedule_events", target.dataset.event);
    state.modal = "event";
    render();
    return;
  }
  if (target.dataset.action === "quickNote") {
    state.modal = "note";
    render();
    return;
  }
  if (target.dataset.mobileTheme) {
    state.theme = target.dataset.mobileTheme;
    localStorage.setItem("planner.mobile.theme", state.theme);
    render();
    return;
  }
  if (target.dataset.action === "syncNow") {
    await flushSyncQueue();
    await refresh("동기화했습니다.");
    return;
  }
  if (target.dataset.action === "enableNotifications") {
    if (!("Notification" in window)) {
      showToast("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }
    const permission = await Notification.requestPermission();
    showToast(permission === "granted" ? "알림 권한이 켜졌습니다." : "알림 권한이 꺼져 있습니다.");
    return;
  }
  if (target.dataset.action === "logout") {
    await signOut();
    state.user = null;
    state.offlineMode = false;
    localStorage.removeItem("planner.mobile.authSeen");
    render();
    return;
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === "event") await saveEvent(form);
  if (form.dataset.form === "note") await saveNote(form);
});

async function boot() {
  applyTheme();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("Service worker registration failed:", error));
  }
  state.user = await getAuthUser();
  state.offlineMode = !navigator.onLine && localStorage.getItem("planner.mobile.authSeen") === "1";
  state.ready = true;
  onAuthStateChange(async (user) => {
    state.user = user;
    state.offlineMode = false;
    if (user) {
      localStorage.setItem("planner.mobile.authSeen", "1");
      await pullAllFromSupabase().catch(() => null);
      await flushSyncQueue();
      await refresh();
    } else {
      render();
    }
  });
  if (state.user) {
    localStorage.setItem("planner.mobile.authSeen", "1");
    await pullAllFromSupabase().catch(() => null);
    await flushSyncQueue();
    await load();
  }
  if (state.offlineMode) await load();
  render();
}

boot().catch((error) => {
  console.error(error);
  $("#mobileApp").innerHTML = `<main class="mLogin"><section class="mLoginCard"><h1>앱을 시작하지 못했습니다</h1><p>${escapeHtml(error.message)}</p></section></main>`;
});
