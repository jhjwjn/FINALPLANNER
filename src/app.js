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
  ["friends", "친구"],
  ["print", "출력"],
  ["settings", "설정"],
  ["ai", "AI"]
];

const JA_TEXT = {
  "오늘": "今日",
  "주간계획": "週間計画",
  "월간계획": "月間計画",
  "주간대시보드": "週間ダッシュボード",
  "일간": "日別",
  "할 일": "To Do",
  "습관": "習慣",
  "목표": "目標",
  "프로젝트": "プロジェクト",
  "메모": "メモ",
  "회고": "振り返り",
  "꿈/비전": "夢/ビジョン",
  "데이터": "データ",
  "친구": "友だち",
  "출력": "印刷",
  "설정": "設定",
  "오늘 실행": "今日の実行",
  "주간 계획": "週間計画",
  "월간 계획": "月間計画",
  "주간 대시보드": "週間ダッシュボード",
  "일간 대시보드": "日別ダッシュボード",
  "To Do List": "To Do List",
  "꿈 / 비전": "夢 / ビジョン",
  "데이터베이스": "データベース",
  "환경 설정": "環境設定",
  "AI 에이전트": "AIエージェント",
  "이번 주": "今週",
  "로그인": "ログイン",
  "로그아웃": "ログアウト",
  "이전주": "前週",
  "이번주": "今週",
  "다음주": "次週",
  "이전달": "前月",
  "이번달": "今月",
  "다음달": "次月",
  "일정 추가": "予定追加",
  "빠른 추가": "クイック追加",
  "빠른 메모": "クイックメモ",
  "할 일 추가": "タスク追加",
  "습관 추가": "習慣追加",
  "목표 추가": "目標追加",
  "프로젝트 추가": "プロジェクト追加",
  "다음 행동": "次の行動",
  "메모 추가": "メモ追加",
  "회고 작성": "振り返り作成",
  "비전 추가": "ビジョン追加",
  "일정사전 추가": "予定辞書追加",
  "카테고리": "カテゴリ",
  "카테고리 관리": "カテゴリ管理",
  "백업 내보내기": "バックアップ出力",
  "백업 가져오기": "バックアップ読込",
  "연결 확인": "接続確認",
  "선택 항목 출력": "選択項目を印刷",
  "프롬프트 복사": "プロンプトコピー",
  "내 주간 코드 복사": "自分の週間コードをコピー",
  "복사": "コピー",
  "테마": "テーマ",
  "데이터 안정성": "データ安定性",
  "운영 규칙": "運用ルール",
  "언어": "言語",
  "한국어": "韓国語",
  "일본어": "日本語",
  "추가": "追加",
  "수정": "編集",
  "삭제": "削除",
  "닫기": "閉じる",
  "저장": "保存",
  "출력 순서": "印刷順",
  "추가 가능한 화면": "追加可能な画面",
  "출력 예시": "印刷プレビュー",
  "빠른 프리셋": "クイックプリセット",
  "주간 출력 구성": "週間印刷構成",
  "월간 출력 구성": "月間印刷構成",
  "전체 출력 구성": "全体印刷構成",
  "위": "上",
  "아래": "下",
  "제외": "除外",
  "A4 세로 기준": "A4縦基準",
  "90도 회전": "90度回転",
  "세로 A4": "A4縦",
  "출력할 화면을 선택하세요.": "印刷する画面を選択してください。",
  "검색 결과가 없습니다.": "検索結果がありません。",
  "검색어를 입력하세요.": "検索語を入力してください。",
  "월": "月",
  "화": "火",
  "수": "水",
  "목": "木",
  "금": "金",
  "토": "土",
  "일": "日",
  "공부": "勉強",
  "운동": "運動",
  "독서": "読書",
  "생활": "生活",
  "휴식": "休憩",
  "일정, 목표, 할 일, 메모 검색": "予定、目標、To Do、メモを検索"
};

Object.assign(JA_TEXT, {
  "일정을 가볍게 정리하고, 어디서든 이어서 확인하세요.": "予定を軽く整理して、どこでも続きを確認できます。",
  "먼저 이 기기에 안전하게 저장하고, Google 로그인 후 Supabase와 자동 동기화합니다.": "まずこの端末に安全に保存し、Googleログイン後にSupabaseと自動同期します。",
  "Google로 로그인": "Googleでログイン",
  "로그인하면 PC와 모바일에서 같은 일정을 볼 수 있습니다. 오프라인 중에도 기존 로컬 데이터는 보존됩니다.": "ログインするとPCとモバイルで同じ予定を確認できます。オフライン中も既存のローカルデータは保持されます。",
  "계획은 주간계획에서": "計画は週間計画で",
  "빈 시간대를 드래그하면 일정 입력창이 열립니다. 이미 만든 일정은 클릭해서 바로 수정합니다.": "空き時間をドラッグすると予定入力画面が開きます。作成済みの予定はクリックして編集できます。",
  "오늘은 실행만": "今日は実行に集中",
  "오늘 화면은 지금 할 일, 일정, 습관만 빠르게 보는 공간입니다. 계획보다 실행에 집중하세요.": "今日画面は今やるTo Do、予定、習慣を素早く見る場所です。計画より実行に集中しましょう。",
  "목표는 +1로 기록": "目標は+1で記録",
  "목표 카드의 진행 버튼으로 한 번 운동, 한 챕터 완료 같은 작은 진척을 바로 기록할 수 있습니다.": "目標カードの進捗ボタンで、運動1回、1章完了など小さな進捗をすぐ記録できます。",
  "모바일은 확인 중심": "モバイルは確認中心",
  "밖에서는 일간/주간/월간 확인과 빠른 메모를 우선 사용하세요. 자세한 편집은 데스크탑이 더 편합니다.": "外では日別/週間/月間確認とクイックメモを優先してください。詳細編集はデスクトップが便利です。",
  "처음 쓰는 사람을 위한": "初めて使う人向け",
  "건너뛰기": "スキップ",
  "시작하기": "始める",
  "다음": "次へ",
  "일정 기록": "予定記録",
  "자주 쓰는 일정": "よく使う予定",
  "반복 일정": "繰り返し予定",
  "전체": "すべて",
  "분류": "カテゴリ",
  "데이터베이스": "データベース",
  "친구 일정": "友だちの予定",
  "친구 일정 확인": "友だちの予定確認",
  "친구가 보낸 주간 공유 코드를 붙여 넣으면 그 주의 일정만 조회합니다. 이 코드는 내 DB에 저장되지 않습니다.": "友だちから受け取った週間共有コードを貼り付けると、その週の予定だけを確認できます。このコードは自分のDBには保存されません。",
  "친구 주간 코드 붙여넣기": "友だちの週間コードを貼り付け",
  "친구 일정 보기": "友だちの予定を見る",
  "비우기": "クリア",
  "친구 주간계획": "友だちの週間計画",
  "코드를 입력하세요": "コードを入力してください",
  "친구 주간 코드를 붙여 넣으면 이곳에 일정이 표시됩니다.": "友だちの週間コードを貼り付けると、ここに予定が表示されます。",
  "친구 목표": "友だちの目標",
  "공유 코드 기준": "共有コード基準",
  "공유된 목표가 없습니다.": "共有された目標がありません。",
  "공유된 일정이 없습니다.": "共有された予定がありません。",
  "일정": "予定",
  "완료": "完了",
  "목표": "目標",
  "주간 목표": "週間目標",
  "가로형 주간 타임라인": "横型週間タイムライン",
  "목표 게이지": "目標ゲージ",
  "완료 기준": "完了基準",
  "이번 주 목표가 없습니다.": "今週の目標がありません。",
  "주간 리뷰": "週間レビュー",
  "자동 요약": "自動要約",
  "오늘 일정이 없습니다.": "今日の予定がありません。",
  "오늘 처리할 할 일이 없습니다.": "今日処理するTo Doがありません。",
  "등록된 목표가 없습니다.": "登録された目標がありません。",
  "메모 없음": "メモなし",
  "기한 없음": "期限なし",
  "없음": "なし",
  "완료됨": "完了済み",
  "진행 목표": "進行中の目標",
  "타임라인": "タイムライン",
  "오늘 할 일": "今日のTo Do",
  "최근 메모": "最近のメモ",
  "열기": "開く",
  "작성": "作成",
  "계획 피드백, 목표 추천, 회고 프롬프트 생성": "計画フィードバック、目標提案、振り返りプロンプト生成",
  "출력할 항목을 선택하세요.": "印刷する項目を選択してください。",
  "모든 화면이 선택되었습니다.": "すべての画面が選択されています。",
  "내 주간 코드 복사": "自分の週間コードをコピー",
  "친구 주간 코드를 읽지 못했습니다.": "友だちの週間コードを読み取れませんでした。",
  "이번 주 공유 코드를 복사했습니다.": "今週の共有コードをコピーしました。",
  "저장했습니다.": "保存しました。",
  "테마를 변경했습니다.": "テーマを変更しました。",
  "상태를 변경했습니다.": "状態を変更しました。",
  "목표 진행도를 반영했습니다.": "目標の進捗を反映しました。",
  "일정을 저장했습니다.": "予定を保存しました。",
  "일정을 삭제했습니다.": "予定を削除しました。",
  "할 일을 갱신했습니다.": "To Doを更新しました。",
  "습관을 기록했습니다.": "習慣を記録しました。",
  "프롬프트를 복사했습니다.": "プロンプトをコピーしました。",
  "종료 시간은 시작 시간보다 늦어야 합니다.": "終了時刻は開始時刻より後にしてください。",
  "겹치는 일정이 있습니다:": "重複する予定があります:",
  "반복일정": "繰り返し予定",
  "일정 입력": "予定入力",
  "할 일 입력": "To Do入力",
  "습관 입력": "習慣入力",
  "목표 입력": "目標入力",
  "프로젝트 입력": "プロジェクト入力",
  "메모 입력": "メモ入力",
  "비전 입력": "ビジョン入力",
  "일정사전": "予定辞書",
  "내용": "内容",
  "날짜": "日付",
  "시작": "開始",
  "종료": "終了",
  "일정명": "予定名",
  "예: 전자기학 공부": "例: 電磁気学の勉強",
  "색상은 카테고리 기준으로 자동 배정되고, 같은 카테고리 일정이 연속될 때는 구분되도록 살짝 섞입니다.": "色はカテゴリ基準で自動割り当てされ、同じカテゴリの予定が続く場合は区別できるよう少し変化します。",
  "연결 목표": "連携目標",
  "일정 삭제": "予定削除",
  "할 일 삭제": "To Do削除",
  "목표 삭제": "目標削除",
  "프로젝트 삭제": "プロジェクト削除",
  "이번 회차만 제외": "今回だけ除外",
  "반복명": "繰り返し名",
  "요일": "曜日",
  "반복 시작일": "繰り返し開始日",
  "반복 종료일": "繰り返し終了日",
  "반복 주기": "繰り返し周期",
  "매주": "毎週",
  "격주": "隔週",
  "4주마다": "4週間ごと",
  "할 일": "To Do",
  "기한": "期限",
  "우선순위": "優先度",
  "예상 소요시간": "予想所要時間",
  "캘린더에 배치": "カレンダーに配置",
  "습관명": "習慣名",
  "주기": "周期",
  "매일": "毎日",
  "주간": "週間",
  "목표명": "目標名",
  "기간": "期間",
  "진행 방식": "進行方式",
  "횟수 직접 입력": "回数を直接入力",
  "시간 직접 입력": "時間を直接入力",
  "진도 직접 입력": "進捗を直接入力",
  "할 일 완료 기준": "To Do完了基準",
  "일정 완료 기준": "予定完了基準",
  "현재": "現在",
  "단위": "単位",
  "프로젝트명": "プロジェクト名",
  "영역": "領域",
  "제목": "タイトル",
  "태그": "タグ",
  "작성일": "作成日",
  "점수": "スコア",
  "잘한 것": "良かったこと",
  "배운 것": "学んだこと",
  "설명": "説明",
  "기본 메모": "基本メモ",
  "카테고리명": "カテゴリ名",
  "Google 사용자": "Googleユーザー",
  "기타": "その他",
  "개인": "個人",
  "시간": "時間",
  "회": "回"
});

function translateText(value) {
  if (state.language !== "ja") return String(value ?? "");
  let output = String(value ?? "");
  const exact = JA_TEXT[output.trim()];
  if (exact && output.trim() === output) return exact;
  Object.entries(JA_TEXT)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([ko, ja]) => {
      output = output.split(ko).join(ja);
    });
  output = output
    .replace(/(\d{4})년\s*(\d{1,2})월/g, "$1年 $2月")
    .replace(/(\d{1,2})월\s*(\d{1,2})일/g, "$1月$2日")
    .replace(/(\d+)\s*개/g, "$1件")
    .replace(/(\d+)\s*시간/g, "$1時間")
    .replace(/(\d+)\s*분/g, "$1分")
    .replace(/월요일/g, "月曜日")
    .replace(/화요일/g, "火曜日")
    .replace(/수요일/g, "水曜日")
    .replace(/목요일/g, "木曜日")
    .replace(/금요일/g, "金曜日")
    .replace(/토요일/g, "土曜日")
    .replace(/일요일/g, "日曜日");
  return output;
}

const t = (value) => translateText(value);

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
  language: "ko",
  modal: null,
  modalData: null,
  drag: null,
  syncStatus: null,
  authUser: null,
  authReady: false,
  showTutorial: false,
  tutorialStep: 0,
  isComposing: false,
  suppressClickUntil: 0,
  remoteBootstrapped: false,
  lastEventOpen: { id: "", at: 0 },
  aiPromptType: "weekly",
  printItems: ["planner", "dashboard", "daily"],
  searchOpen: false,
  friendPlan: null,
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
    await put("settings", { id: "app", theme: "paper", language: "ko", weekStart: "월", focusMode: false, updatedAt: new Date().toISOString() });
  }
  await ensureDefaultCategories();
}

async function ensureDefaultCategories() {
  const existing = await all("categories");
  const activeNames = new Set(existing.filter((cat) => cat.isActive !== false).map((cat) => String(cat.name || "").trim().toLowerCase()));
  const now = new Date().toISOString();
  const missing = ["공부", "운동", "독서", "프로젝트", "생활", "휴식"]
    .filter((name) => !activeNames.has(name.toLowerCase()))
    .map((name, index) => ({
      id: uid("cat"),
      name,
      sortOrder: existing.length + index,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }));
  if (missing.length) await bulkPut("categories", missing);
}

async function cleanupDuplicateSeedData() {
  await ensureDefaultCategories();
  await cleanupLegacyDemoData();
  await cleanupDuplicateCategories();
  await cleanupDuplicateRecords("schedule_templates", (item) => String(item.name || "").trim().toLowerCase());
  await cleanupDuplicateRecords("schedule_events", (item) => [item.name, item.date, item.startTime, item.endTime].map((x) => String(x || "").trim().toLowerCase()).join("|"));
  await cleanupDuplicateRecords("goals", (item) => [item.name, item.period, item.startDate, item.endDate].map((x) => String(x || "").trim().toLowerCase()).join("|"));
  await cleanupDuplicateRecords("tasks", (item) => [item.name, item.dueDate, item.projectId || ""].map((x) => String(x || "").trim().toLowerCase()).join("|"));
  await cleanupDuplicateRecords("habits", (item) => String(item.name || "").trim().toLowerCase());
}

const legacyDemoNames = {
  schedule_events: ["전자기학 2장", "웨이트", "프로젝트 설계", "독서", "모의고사 복습"],
  schedule_templates: ["전자기학 공부", "웨이트", "독서", "프로젝트 설계"],
  tasks: ["전자기학 오답 정리", "주간 계획 빈 시간 확인", "프로젝트 DB 구조 메모", "오늘 화면 설계 정리", "습관 기록 UI 검토", "수면 루틴 시간 고정"],
  habits: ["기상 후 물 마시기", "운동", "독서 20분", "취침 전 회고"],
  goals: ["전자기학 핵심 개념 3개 설명 가능", "운동 4회 완료", "독서 2챕터 요약"],
  projects: ["Planner 앱 완성", "개인 루틴 안정화"],
  notes: ["일정관리 원칙", "AI에게 물어볼 것"],
  dreams: ["1년 뒤의 나", "건강한 생활"]
};

function demoNameKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function cleanupLegacyDemoData() {
  for (const [store, names] of Object.entries(legacyDemoNames)) {
    const targets = new Set(names.map(demoNameKey));
    const values = await all(store);
    for (const item of values) {
      const name = demoNameKey(item.name || item.title);
      if (targets.has(name)) await remove(store, item.id);
    }
  }
}

async function syncRemoteAndCleanup() {
  if (!state.authUser || state.remoteBootstrapped) return;
  state.remoteBootstrapped = true;
  try {
    await pullAllFromSupabase();
    await seed();
    await cleanupDuplicateSeedData();
    await flushSyncQueue();
  } catch (error) {
    console.warn("Initial Supabase cleanup skipped:", error);
  }
}

async function cleanupDuplicateCategories() {
  const categories = await all("categories");
  const seen = new Map();
  for (const cat of categories) {
    const key = String(cat.name || "").trim().toLowerCase();
    if (!key) continue;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, cat);
      continue;
    }
    const canonical = previous.id;
    await rewriteCategoryReferences(cat.id, canonical);
    await remove("categories", cat.id);
  }
}

async function rewriteCategoryReferences(fromId, toId) {
  for (const store of ["schedule_templates", "schedule_events", "repeat_rules", "goals", "tasks", "habits", "projects"]) {
    const values = await all(store);
    for (const item of values) {
      if (item.categoryId === fromId) await put(store, { ...item, categoryId: toId, updatedAt: new Date().toISOString() });
    }
  }
}

async function cleanupDuplicateRecords(store, keyFn) {
  const values = await all(store);
  const seen = new Map();
  for (const item of values) {
    const key = keyFn(item);
    if (!key || key === "|||") continue;
    if (!seen.has(key)) {
      seen.set(key, item.id);
      continue;
    }
    await remove(store, item.id);
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
  state.language = memory.settings?.language || "ko";
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
  document.documentElement.dataset.lang = state.language;
  document.documentElement.lang = state.language === "ja" ? "ja" : "ko";
}

function category(id) {
  return memory.categories.find((x) => x.id === id) || { id: "", name: "기타", sortOrder: 0 };
}
function color(index = 0) {
  return themes[state.theme].colors[index % themes[state.theme].colors.length];
}
function autoColorIndex(categoryId, date, startTime, ignoreId = "") {
  const base = Math.max(0, memory.categories.findIndex((c) => c.id === categoryId));
  const sameDaySameCategory = memory.events
    .filter((event) => event.id !== ignoreId && event.date === date && event.categoryId === categoryId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const beforeCount = sameDaySameCategory.filter((event) => event.startTime <= startTime).length;
  return (base + beforeCount) % themes[state.theme].colors.length;
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
function encodeSharePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
function decodeSharePayload(code) {
  const raw = String(code || "").trim();
  if (!raw) throw new Error("empty");
  const payload = JSON.parse(decodeURIComponent(escape(atob(raw))));
  if (payload.type !== "planner-week" || !Array.isArray(payload.events)) throw new Error("invalid");
  return payload;
}
function createWeekShareCode() {
  const start = state.weekStart;
  const end = addDays(start, 6);
  const events = weekEvents()
    .map((event) => ({
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      categoryName: category(event.categoryId).name,
      colorIndex: event.colorIndex,
      memo: event.memo || "",
      status: event.status
    }))
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const goals = memory.goals
    .filter((goal) => goal.period === "weekly" && goal.startDate <= end && goal.endDate >= start)
    .map((goal) => {
      const progress = goalProgress(goal);
      return {
        name: goal.name,
        categoryName: category(goal.categoryId).name,
        current: progress.current,
        target: goal.target,
        unit: goal.unit || "",
        pct: progress.pct
      };
    });
  return encodeSharePayload({
    type: "planner-week",
    version: 1,
    owner: state.authUser?.email || "친구",
    weekStart: start,
    weekEnd: end,
    createdAt: new Date().toISOString(),
    events,
    goals
  });
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
  setTimeout(() => { state.toast = ""; render(); }, 3200);
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
function friendlySyncError(error) {
  const message = String(error?.message || error?.details || error?.hint || error || "");
  if (message.includes("login") || message.includes("auth") || message.includes("JWT")) return "로그인이 필요합니다.";
  if (message.includes("planner_records") || message.includes("does not exist")) return "Supabase SQL을 먼저 실행해야 합니다.";
  if (message.includes("row-level security") || message.includes("policy")) return "Supabase RLS 정책을 확인해야 합니다.";
  if (message.includes("permission") || message.includes("permission denied")) return "Supabase 테이블 권한을 확인해야 합니다.";
  return message || "알 수 없는 오류";
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
  const actions = renderActions();
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brandMark"></div>
        <div>
          <h1>Life Planner</h1>
          <p>offline workspace</p>
        </div>
      </div>
      <nav>${navItems.map(([id, label]) => `<button class="navItem ${state.view === id ? "active" : ""}" data-view="${id}">${t(label)}</button>`).join("")}</nav>
      <div class="sidebarCard">
        <span>${t("이번 주")}</span>
        <strong>${fmtMD(state.weekStart)} - ${fmtMD(addDays(state.weekStart, 6))}</strong>
        <div class="swatches">${theme.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
      </div>
      ${state.authUser ? `<div class="sidebarCard"><span>${t("로그인")}</span><strong>${escapeHtml(state.authUser.email || "Google 사용자")}</strong><button class="ghost full" data-action="signOut">${t("로그아웃")}</button></div>` : ""}
    </aside>
    <main class="main ${actions ? "" : "noActions"}">
      <header class="topbar">
        <div>
          <p class="eyebrow">${theme.label}</p>
          <h2>${viewTitle()}</h2>
        </div>
        <div class="topSearch"><input class="globalSearch" value="${escapeAttr(state.query)}" placeholder="${t("일정, 목표, 할 일, 메모 검색")}"></div>
        <div class="topActions">${renderTopActions()}</div>
      </header>
      ${renderSearchOverlay()}
      ${actions ? `<section class="actionPanel">${actions}</section>` : ""}
      <section class="content">${renderView()}</section>
    </main>
    ${renderModal()}
    ${renderTutorial()}
    ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
  `;
}

function loginShell() {
  return `<main class="loginShell">
    <section class="loginCard">
      <div class="loginHero">
        <div class="brandMark"></div>
        <p class="eyebrow">Life Planner</p>
        <h1>일정을 가볍게 정리하고, 어디서든 이어서 확인하세요.</h1>
        <p class="muted">먼저 이 기기에 안전하게 저장하고, Google 로그인 후 Supabase와 자동 동기화합니다.</p>
      </div>
      <div class="loginActions">
        <button class="primary" data-action="signInGoogle">Google로 로그인</button>
        <p class="tiny">로그인하면 PC와 모바일에서 같은 일정을 볼 수 있습니다. 오프라인 중에도 기존 로컬 데이터는 보존됩니다.</p>
      </div>
    </section>
    ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
  </main>`;
}

function renderTutorial() {
  if (!state.showTutorial) return "";
  const steps = [
    ["계획은 주간계획에서", "빈 시간대를 드래그하면 일정 입력창이 열립니다. 이미 만든 일정은 클릭해서 바로 수정합니다."],
    ["오늘은 실행만", "오늘 화면은 지금 할 일, 일정, 습관만 빠르게 보는 공간입니다. 계획보다 실행에 집중하세요."],
    ["목표는 +1로 기록", "목표 카드의 진행 버튼으로 한 번 운동, 한 챕터 완료 같은 작은 진척을 바로 기록할 수 있습니다."],
    ["모바일은 확인 중심", "밖에서는 일간/주간/월간 확인과 빠른 메모를 우선 사용하세요. 자세한 편집은 데스크탑이 더 편합니다."]
  ];
  const [title, body] = steps[state.tutorialStep] || steps[0];
  return `<div class="tutorialBackdrop">
    <section class="tutorialCard">
      <p class="eyebrow">처음 쓰는 사람을 위한 ${state.tutorialStep + 1}/${steps.length}</p>
      <h3>${title}</h3>
      <p>${body}</p>
      <div class="tutorialDots">${steps.map((_, i) => `<i class="${i === state.tutorialStep ? "active" : ""}"></i>`).join("")}</div>
      <footer>
        <button class="ghost" data-action="finishTutorial">건너뛰기</button>
        <button class="primary" data-action="${state.tutorialStep >= steps.length - 1 ? "finishTutorial" : "nextTutorial"}">${state.tutorialStep >= steps.length - 1 ? "시작하기" : "다음"}</button>
      </footer>
    </section>
  </div>`;
}

function viewTitle() {
  return t(({
    today: "오늘 실행",
    planner: "주간 계획",
    monthly: "월간 계획",
    dashboard: "주간 대시보드",
    daily: "일간 대시보드",
    tasks: "To Do List",
    habits: "습관",
    goals: "목표",
    projects: "프로젝트",
    notes: "메모",
    review: "회고",
    dreams: "꿈 / 비전",
    database: "데이터베이스",
    friends: "친구 일정",
    print: "출력",
    settings: "환경 설정",
    ai: "AI 에이전트"
  })[state.view]);
}

function renderTopActions() {
  const weekNav = `<button class="ghost" data-action="prevWeek">${t("이전주")}</button><button class="ghost" data-action="thisWeek">${t("이번주")}</button><button class="ghost" data-action="nextWeek">${t("다음주")}</button>`;
  if (state.view === "today") return `<button class="primary" data-modal="quickAdd">${t("빠른 추가")}</button><button class="soft" data-modal="note">${t("빠른 메모")}</button>`;
  if (["planner", "dashboard", "daily"].includes(state.view)) return `${weekNav}<button class="primary" data-modal="event">${t("일정 추가")}</button>`;
  if (state.view === "monthly") return `<button class="ghost" data-action="prevMonth">${t("이전달")}</button><button class="ghost" data-action="thisMonth">${t("이번달")}</button><button class="ghost" data-action="nextMonth">${t("다음달")}</button><button class="primary" data-modal="event">${t("일정 추가")}</button>`;
  if (state.view === "tasks") return `<button class="primary" data-modal="task">${t("할 일 추가")}</button>`;
  if (state.view === "habits") return `<button class="primary" data-modal="habit">${t("습관 추가")}</button>`;
  if (state.view === "goals") return `<button class="primary" data-modal="goal">${t("목표 추가")}</button>`;
  if (state.view === "projects") return `<button class="primary" data-modal="project">${t("프로젝트 추가")}</button><button class="soft" data-modal="task">${t("다음 행동")}</button>`;
  if (state.view === "notes") return `<button class="primary" data-modal="note">${t("메모 추가")}</button>`;
  if (state.view === "review") return `<button class="primary" data-modal="review">${t("회고 작성")}</button>`;
  if (state.view === "dreams") return `<button class="primary" data-modal="dream">${t("비전 추가")}</button>`;
  if (state.view === "database") return `<button class="primary" data-modal="template">${t("일정사전 추가")}</button><button class="soft" data-modal="category">${t("카테고리")}</button>`;
  if (state.view === "friends") return `<button class="primary" data-action="copyShareCode">${t("내 주간 코드 복사")}</button>`;
  if (state.view === "print") return `<button class="primary" data-action="printSelected">${t("선택 항목 출력")}</button>`;
  if (state.view === "settings") return `<button class="primary" data-action="exportBackup">${t("백업 내보내기")}</button><button class="soft" data-action="importBackup">${t("백업 가져오기")}</button><button class="soft" data-action="checkSupabase">${t("연결 확인")}</button><input class="backupInput" type="file" accept="application/json,.json" hidden>`;
  if (state.view === "ai") return `<button class="primary" data-action="copyPrompt">${t("프롬프트 복사")}</button>`;
  return "";
}

function renderSearchOverlay() {
  const results = searchResults();
  if (!state.searchOpen && !state.query.trim()) return "";
  return `<section class="searchOverlay">
    <div class="searchResults">
      ${results.length ? results.map(searchResultRow).join("") : empty(state.query.trim() ? "검색 결과가 없습니다." : "검색어를 입력하세요.")}
    </div>
  </section>`;
}

function searchResults() {
  const q = state.query.trim().toLowerCase();
  if (!q) return [];
  const collect = [
    ["일정", "planner", memory.events, (item) => `${item.date} ${item.startTime}-${item.endTime} · ${category(item.categoryId).name}`],
    ["목표", "goals", memory.goals, (item) => `${item.period} · ${category(item.categoryId).name} · ${goalProgress(item).pct}%`],
    ["할 일", "tasks", memory.tasks, (item) => `${item.dueDate || "기한 없음"} · ${item.status} · ${category(item.categoryId).name}`],
    ["습관", "habits", memory.habits, (item) => `${item.rhythm} · ${category(item.categoryId).name}`],
    ["프로젝트", "projects", memory.projects, (item) => `${item.area} · ${item.status} · ${category(item.categoryId).name}`],
    ["메모", "notes", memory.notes, (item) => item.tag || "메모"],
    ["꿈/비전", "dreams", memory.dreams, (item) => `${item.area} · ${item.horizon || ""}`],
    ["일정사전", "database", memory.templates, (item) => `${category(item.categoryId).name} · ${item.defaultMemo || ""}`]
  ];
  return collect.flatMap(([type, view, items, meta]) => items.map((item) => ({ type, view, item, meta: meta(item) })))
    .filter(({ item, meta }) => [
      item.name,
      item.title,
      item.body,
      item.memo,
      item.defaultMemo,
      item.area,
      item.status,
      meta
    ].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 24);
}

function searchResultRow(result) {
  const title = result.item.name || result.item.title || "이름 없음";
  const colorIndex = viewColorIndex(result.view);
  return `<button class="searchResult" data-search-view="${result.view}" data-search-id="${result.item.id || ""}">
    <span style="--search-color:${color(colorIndex)}">${result.type}</span>
    <b>${escapeHtml(title)}</b>
    <em>${escapeHtml(result.meta || "")}</em>
  </button>`;
}

function viewColorIndex(view) {
  const order = ["today", "planner", "monthly", "dashboard", "daily", "tasks", "habits", "goals", "projects", "notes", "review", "dreams", "database", "friends", "settings", "ai"];
  return Math.max(0, order.indexOf(view)) % themes[state.theme].colors.length;
}

function renderActions() {
  if (state.view === "database") return [
    ["events", "일정 기록"],
    ["templates", "자주 쓰는 일정"],
    ["categories", "분류"],
    ["repeats", "반복 일정"]
  ].map(([id, label]) => `<button class="pill ${state.dataTab === id ? "active" : ""}" data-data-tab="${id}">${label}</button>`).join("") + (state.dataTab === "categories" ? "" : categorySelect());
  if (state.view === "tasks") return categoryPills();
  if (state.view === "habits") return `<span class="panelHint">습관 칸을 누르면 해당 날짜의 체크 상태가 바뀝니다.</span>`;
  if (state.view === "projects") return `<span class="panelHint">프로젝트는 다음 행동 완료율로 진행률을 계산합니다.</span>`;
  if (state.view === "notes") return `<span class="panelHint">계획 원칙, AI 질문, 장기 아이디어를 한 곳에 보관합니다.</span>`;
  if (state.view === "review") return `<span class="panelHint">완료 일정, 습관, 할 일을 기준으로 실행 점수를 계산합니다.</span>`;
  if (state.view === "dreams") return `<span class="panelHint">꿈과 비전은 목표보다 긴 기간의 방향성을 기록하는 공간입니다.</span>`;
  if (state.view === "settings") return `<span class="panelHint">테마, 백업, 오프라인 저장 상태를 관리합니다.</span>`;
  if (state.view === "ai") return "";
  return "";
}

function categoryPills() {
  return [`<button class="pill ${state.selectedCategory === "all" ? "active" : ""}" data-filter-cat="all">전체</button>`]
    .concat(uniqueCategories().map((cat) => `<button class="pill ${state.selectedCategory === cat.id ? "active" : ""}" data-filter-cat="${cat.id}">${cat.name}</button>`))
    .join("");
}

function uniqueCategories() {
  const seen = new Set();
  return memory.categories.filter((cat) => {
    const key = String(cat.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function categorySelect() {
  return `<label class="filterSelect"><span>카테고리</span><select data-filter-cat-select>
    <option value="all" ${state.selectedCategory === "all" ? "selected" : ""}>전체</option>
    ${uniqueCategories().map((cat) => `<option value="${cat.id}" ${state.selectedCategory === cat.id ? "selected" : ""}>${cat.name}</option>`).join("")}
  </select></label>`;
}

function filtered(items) {
  const byCategory = state.selectedCategory === "all" ? items : items.filter((item) => item.categoryId === state.selectedCategory);
  return queryFiltered(byCategory);
}

function queryFiltered(items) {
  const q = state.query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => [
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
  if (state.view === "friends") return renderFriends();
  if (state.view === "print") return renderPrint();
  if (state.view === "settings") return renderSettings();
  if (state.view === "ai") return renderAI();
  return "";
}
function renderMonthly() {
  const dates = monthCalendarDates();
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const events = queryFiltered(monthEvents());
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
  const goals = visibleActiveGoalsForDate(today());
  const focus = nextFocusItem(events, tasks);
  const notes = memory.notes.slice(-3).reverse();
  const dreams = memory.dreams.slice(0, 2);
  const projects = memory.projects.filter((project) => project.status !== "done").slice(0, 3);
  const weeklyEvents = weekEvents();
  const monthlyEvents = monthEvents();
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
      <section class="card hubCard" data-view="planner">
        <div class="cardHead"><h3>주간계획</h3><button data-view="planner">열기</button></div>
        <p>${fmtMD(state.weekStart)}-${fmtMD(addDays(state.weekStart, 6))} · 일정 ${weeklyEvents.length}개</p>
      </section>
      <section class="card hubCard" data-view="monthly">
        <div class="cardHead"><h3>월간계획</h3><button data-view="monthly">열기</button></div>
        <p>${monthLabel(state.monthStart)} · 일정 ${monthlyEvents.length}개</p>
      </section>
      <section class="card hubCard" data-view="tasks">
        <div class="cardHead"><h3>To Do List</h3><button data-view="tasks">열기</button></div>
        <p>남은 할 일 ${activeTasks().length}개</p>
      </section>
      <section class="card hubCard" data-view="habits">
        <div class="cardHead"><h3>습관</h3><button data-view="habits">열기</button></div>
        <p>이번 주 체크 ${memory.habits.reduce((sum, habit) => sum + weekDates().filter((date) => habitDone(habit.id, date)).length, 0)}회</p>
      </section>
      <section class="card hubCard" data-view="projects">
        <div class="cardHead"><h3>프로젝트</h3><button data-view="projects">열기</button></div>
        <div class="miniList">${projects.map((p) => `<span>${escapeHtml(p.name)}</span>`).join("") || "<span>진행 프로젝트 없음</span>"}</div>
      </section>
      <section class="card hubCard" data-view="notes">
        <div class="cardHead"><h3>메모</h3><button data-view="notes">열기</button></div>
        <div class="miniList">${notes.map((n) => `<span>${escapeHtml(n.title)}</span>`).join("") || "<span>메모 없음</span>"}</div>
      </section>
      <section class="card hubCard" data-view="dreams">
        <div class="cardHead"><h3>꿈 / 비전</h3><button data-view="dreams">열기</button></div>
        <div class="miniList">${dreams.map((d) => `<span>${escapeHtml(d.title)}</span>`).join("") || "<span>비전 없음</span>"}</div>
      </section>
      <section class="card hubCard" data-view="review">
        <div class="cardHead"><h3>회고</h3><button data-view="review">열기</button></div>
        <p>완료 일정 ${completedEvents().filter((e) => e.date >= state.weekStart && e.date <= addDays(state.weekStart, 6)).length}개 기준</p>
      </section>
      <section class="card hubCard" data-view="ai">
        <div class="cardHead"><h3>AI 에이전트</h3><button data-view="ai">열기</button></div>
        <p>계획 피드백, 목표 추천, 회고 프롬프트 생성</p>
      </section>
    </div>
  `;
}

function visibleActiveGoalsForDate(date) {
  return memory.goals.filter((goal) => goal.status !== "done" && goal.startDate <= date && goal.endDate >= date);
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
  const slots = daySlots();
  const events = queryFiltered(memory.events);
  return `
    <div class="plannerGrid" style="grid-template-columns: 58px repeat(7, 1fr)">
      <div class="corner"></div>
      ${dates.map((date, index) => `<div class="dayHead"><b>${["월", "화", "수", "목", "금", "토", "일"][index]}</b><span>${fmtMD(date)}</span></div>`).join("")}
      ${slots.map(({ hour, minute }) => `
        <div class="timeCell ${minute ? "half" : "hour"}">${minute ? `${pad(hour)}:30` : `${pad(hour)}:00`}</div>
        ${dates.map((date) => {
          const time = slotTime(hour, minute);
          const inSlot = events.filter((event) => event.date === date && event.startTime === time);
          return `<div class="slot ${minute ? "half" : "hour"}" data-date="${date}" data-hour="${hour}" data-minute="${minute}"${slotInlineStyle(inSlot)}>${inSlot.map(eventChip).join("")}</div>`;
        }).join("")}
      `).join("")}
    </div>
  `;
}

function renderDashboard() {
  const events = weekEvents();
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
        <div class="cardHead"><h3>가로형 주간 타임라인</h3><span>${fmtMD(state.weekStart)} - ${fmtMD(addDays(state.weekStart, 6))}</span></div>
        ${renderWeeklyTimeline(events)}
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

function renderFriends() {
  const plan = state.friendPlan;
  return `<div class="friendGrid">
    <section class="card">
      <div class="cardHead"><h3>친구 일정 확인</h3><button data-action="loadFriendCode">확인</button></div>
      <p class="muted">친구가 보낸 주간 공유 코드를 붙여 넣으면 그 주의 일정만 조회합니다. 이 코드는 내 DB에 저장되지 않습니다.</p>
      <textarea id="friendCode" class="shareCodeInput" placeholder="친구 주간 코드 붙여넣기"></textarea>
      <div class="inlineActions">
        <button class="primary" data-action="loadFriendCode">친구 일정 보기</button>
        <button class="soft" data-action="copyShareCode">내 주간 코드 복사</button>
        <button class="ghost" data-action="clearFriendPlan">비우기</button>
      </div>
    </section>
    <section class="card wide2">
      <div class="cardHead"><h3>${plan ? `${escapeHtml(plan.owner || "친구")} 주간계획` : "친구 주간계획"}</h3><span>${plan ? `${fmtMD(plan.weekStart)} - ${fmtMD(plan.weekEnd)}` : "코드를 입력하세요"}</span></div>
      ${plan ? renderFriendTimeline(plan) : empty("친구 주간 코드를 붙여 넣으면 이곳에 일정이 표시됩니다.")}
    </section>
    <section class="card wide">
      <div class="cardHead"><h3>친구 목표</h3><span>공유 코드 기준</span></div>
      <div class="goalBars">${plan?.goals?.length ? plan.goals.map((goal) => `<div class="goalBar" style="--goal:${goal.pct || 0}%"><div><b>${escapeHtml(goal.name)}</b><span>${goal.current || 0}/${goal.target || 1}${escapeHtml(goal.unit || "")}</span></div><p><i style="width:${goal.pct || 0}%"></i></p><em>${goal.pct || 0}%</em></div>`).join("") : empty("공유된 목표가 없습니다.")}</div>
    </section>
  </div>`;
}

function renderFriendTimeline(plan) {
  const currentWeek = state.weekStart;
  state.weekStart = plan.weekStart;
  const events = plan.events.map((event, index) => ({
    ...event,
    id: `friend_${index}`,
    categoryId: "",
    colorIndex: Number(event.colorIndex || index)
  }));
  const html = renderWeeklyTimeline(events, { readonly: true });
  state.weekStart = currentWeek;
  return html;
}

function renderWeeklyTimeline(events, options = {}) {
  const dates = weekDates();
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const startMinute = 7 * 60;
  const endMinute = 25 * 60 + 30;
  const slots = Math.ceil((endMinute - startMinute) / 30);
  const hours = Array.from({ length: Math.ceil(slots / 2) }, (_, index) => (7 + index) % 24);
  const hourLabels = hours.map((hour, index) => {
    const span = index === hours.length - 1 && slots % 2 ? 1 : 2;
    return `<div class="timelineHour" style="grid-column: span ${span}">${pad(hour)}:00</div>`;
  }).join("");
  return `<div class="weekTimeline" style="grid-template-columns: 42px repeat(${slots}, minmax(18px, 1fr)); --slots:${slots}">
    <div class="timelineCorner"></div>${hourLabels}
    ${dates.map((date, index) => {
      const dayEventsValue = events.filter((event) => event.date === date);
      return `<div class="timelineDayLabel">${days[index]}<span>${fmtMD(date)}</span></div>
        <div class="timelineRow" style="grid-column: span ${slots}; --slots:${slots}">
          ${Array.from({ length: slots }, (_, i) => `<i class="${i % 2 === 0 ? "hour" : "half"}"></i>`).join("")}
          ${dayEventsValue.map((event) => {
            const rawStart = minutes(event.startTime);
            const rawEnd = minutes(event.endTime) <= rawStart ? minutes(event.endTime) + 1440 : minutes(event.endTime);
            const clippedStart = clamp(rawStart < startMinute ? rawStart + 1440 : rawStart, startMinute, endMinute);
            const clippedEnd = clamp(rawEnd < startMinute ? rawEnd + 1440 : rawEnd, startMinute, endMinute);
            if (clippedEnd <= startMinute || clippedStart >= endMinute) return "";
            const left = ((clippedStart - startMinute) / (endMinute - startMinute)) * 100;
            const width = Math.max(2.4, ((clippedEnd - clippedStart) / (endMinute - startMinute)) * 100);
            return `<button class="timelineEvent" style="--event:${color(event.colorIndex)}; left:${left}%; width:${width}%" ${options.readonly ? "" : `data-event="${event.id}"`}>
              <b>${escapeHtml(event.name)}</b><span>${event.startTime}-${event.endTime}</span>
            </button>`;
          }).join("")}
        </div>`;
    }).join("")}
  </div>`;
}

function renderDaily() {
  const dates = weekDates();
  const events = dayEvents(state.selectedDate);
  const slots = daySlots();
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

function daySlots() {
  return Array.from({ length: 48 }, (_, i) => ({ hour: Math.floor(i / 2), minute: i % 2 ? 30 : 0 }));
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
  const goals = queryFiltered(memory.goals);
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
    </article>`).join("") || empty("등록된 목표가 없습니다.")}</div>`;
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

function printOptions() {
  return [
    ["today", "오늘", "오늘 실행, 타임라인, 목표 요약"],
    ["planner", "주간계획", "세로형 주간 캘린더"],
    ["dashboard", "주간대시보드", "가로형 주간 타임라인과 목표 게이지"],
    ["daily", "일간", "선택 날짜 일간 계획표"],
    ["monthly", "월간계획", "월간 캘린더"],
    ["tasks", "To Do List", "할 일 칸반"],
    ["habits", "습관", "습관 체크 표"],
    ["goals", "목표", "목표 카드와 진행률"],
    ["projects", "프로젝트", "프로젝트 진행"],
    ["notes", "메모", "메모 목록"],
    ["review", "회고", "회고 요약"],
    ["dreams", "꿈/비전", "장기 방향"],
    ["database", "데이터", "일정 기록/사전"]
  ];
}

function renderPrint() {
  const selected = new Set(state.printItems);
  const ordered = state.printItems.map((id) => printOptions().find(([value]) => value === id)).filter(Boolean);
  const rest = printOptions().filter(([id]) => !selected.has(id));
  return `<div class="printGrid">
    <section class="card">
      <div class="cardHead"><h3>추가 가능한 화면</h3><span>${rest.length}개</span></div>
      <div class="printPresets">
        <button class="soft" data-print-preset="week">주간 출력 구성</button>
        <button class="soft" data-print-preset="month">월간 출력 구성</button>
        <button class="soft" data-print-preset="all">전체 출력 구성</button>
      </div>
      <div class="printAddList">
        ${rest.map(([id, label, desc]) => `<button data-print-toggle="${id}"><b>${label}</b><span>${desc}</span></button>`).join("") || empty("모든 화면이 선택되었습니다.")}
      </div>
    </section>
    <section class="card">
      <div class="cardHead"><h3>출력 순서</h3><button data-action="printSelected">출력</button></div>
      <div class="printOrder">
        ${ordered.map(([id, label], index) => `<article>
          <b>${label}</b>
          <button data-print-move="${id}" data-dir="-1" ${index === 0 ? "disabled" : ""}>위</button>
          <button data-print-move="${id}" data-dir="1" ${index === ordered.length - 1 ? "disabled" : ""}>아래</button>
          <button class="dangerText" data-print-toggle="${id}">제외</button>
        </article>`).join("") || empty("출력할 항목을 선택하세요.")}
      </div>
    </section>
    <section class="card">
      <div class="cardHead"><h3>출력 예시</h3><span>A4 세로 기준</span></div>
      <div class="printPreview">${renderPrintPreview(ordered)}</div>
    </section>
  </div>`;
}

function renderPrintPreview(items) {
  if (!items.length) return empty("출력할 화면을 선택하세요.");
  return items.map(([id, label], index) => `<article class="previewPage ${id === "dashboard" ? "rotated" : ""}">
    <span>${index + 1}</span>
    <b>${label}</b>
    <em>${id === "dashboard" ? "90도 회전" : "세로 A4"}</em>
  </article>`).join("");
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
      <div class="cardHead"><h3>${t("언어")}</h3><span>Language</span></div>
      <div class="languageToggle">
        <button class="${state.language === "ko" ? "active" : ""}" data-language="ko">한국어</button>
        <button class="${state.language === "ja" ? "active" : ""}" data-language="ja">日本語</button>
      </div>
      <p class="tiny">언어 설정은 이 계정의 설정 데이터에 저장됩니다.</p>
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
        <button class="ghost" data-action="signOut">로그아웃</button>
      </div>
      <p class="tiny">Supabase 확인: Table Editor의 <b>planner_records</b> 또는 SQL Editor에서 <code>select store, id, updated_at from planner_records order by updated_at desc;</code></p>
    </section>
    <section class="card wide">
      <div class="cardHead"><h3>운영 규칙</h3><span>개인용 기본값</span></div>
      <div class="settingRows twoCols">
        <article><b>시간 단위</b><span>30분 고정</span></article>
        <article><b>주 시작</b><span>월요일</span></article>
        <article><b>목표 계산</b><span>완료된 일정/할 일 기준</span></article>
        <article><b>AI 연결</b><span>프롬프트 생성 후 복사</span></article>
      </div>
      <div class="inlineActions"><button class="soft" data-action="restartTutorial">튜토리얼 다시 보기</button></div>
    </section>
    <section class="card wide">
      <div class="cardHead"><h3>카테고리 관리</h3><button data-modal="category">추가</button></div>
      <div class="categoryManage">
        ${uniqueCategories().map((cat, index) => `<article>
          <i style="background:${color(index)}"></i>
          <b>${escapeHtml(cat.name)}</b>
          <span>${memory.events.filter((event) => event.categoryId === cat.id).length}개 일정</span>
          <button data-edit-category="${cat.id}">수정</button>
          <button class="dangerText" data-delete-category="${cat.id}">삭제</button>
        </article>`).join("")}
      </div>
    </section>
  </div>`;
}

function renderAI() {
  const types = [
    ["weekly", "주간 계획 피드백", "이번 주 일정의 과밀, 우선순위, 목표 달성 가능성을 점검합니다."],
    ["overload", "과부하 검사", "하루/시간대별로 무리한 배치와 회복 구간 부족을 찾습니다."],
    ["goal", "목표 추천", "기존 목표, 일정사전, 완료 기록을 바탕으로 다음 목표 후보를 만듭니다."],
    ["habit", "습관 실패 원인", "습관 로그와 일정 흐름을 보고 실패 원인을 추정합니다."],
    ["taskPlan", "할 일 배치 전략", "할 일을 일정으로 옮길 순서와 적정 시간대를 추천합니다."],
    ["review", "회고 초안", "완료/미완료 데이터를 바탕으로 주간 회고 초안을 만듭니다."],
    ["monthly", "월간 방향 점검", "이번 달 일정/목표가 장기 방향과 맞는지 점검합니다."],
    ["dream", "꿈/비전 연결", "비전과 실제 일정 사이의 간극을 줄이는 액션을 제안합니다."]
  ];
  return `<div class="aiPage">
    <section class="aiHero">
      <p class="eyebrow">Prompt Studio</p>
      <h3>데이터를 그냥 던지지 않고, 바로 질문 가능한 형태로 정리합니다.</h3>
      <p>일정, 목표, 습관, 할 일, 프로젝트, 메모를 목적별로 골라서 AI에게 줄 프롬프트를 만듭니다.</p>
    </section>
    <section class="aiChoiceGrid">${types.map(([id, title, desc]) => `
      <button class="aiPromptCard ${state.aiPromptType === id ? "active" : ""}" data-ai="${id}">
        <b>${title}</b><span>${desc}</span>
      </button>`).join("")}</section>
    <section class="card aiOutput">
      <div class="cardHead"><h3>복사용 프롬프트</h3><button data-action="copyPrompt">복사</button></div>
      <textarea id="aiPrompt">${buildPrompt(state.aiPromptType)}</textarea>
    </section>
  </div>`;
}

function openPrintDocument(items = state.printItems) {
  const sections = printSections(items);
  const label = "Planner 출력";
  const win = window.open("", "_blank", "width=1400,height=900");
  if (!win) {
    showToast("팝업 차단을 해제해야 출력창을 열 수 있습니다.");
    return;
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${label}</title><link rel="stylesheet" href="src/styles.css"><style>
    body{background:#fff;padding:0;color:#111;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .printDoc{display:grid;gap:22px}
    .printPage{break-after:page;width:190mm;height:277mm;padding:8mm;box-sizing:border-box;overflow:hidden;position:relative;background:#fff;display:grid;align-content:center;justify-items:center}
    .printPage h1{margin:0 0 10px;font-size:20px}
    .printBody{width:100%;height:calc(100% - 36px);overflow:hidden;display:grid;align-content:center}
    .printPage.dashboardPrint .printBody{position:absolute;left:8mm;top:8mm;width:174mm;height:261mm}
    .printPage.dashboardPrint .rotateWrap{position:absolute;left:174mm;top:0;width:261mm;height:174mm;transform:rotate(90deg);transform-origin:top left;overflow:hidden}
    .printPage.dashboardPrint h1{position:absolute;left:8mm;top:8mm;z-index:2;background:#fff;padding-right:8px}
    .content{height:auto;overflow:visible;padding:0}
    .sidebar,.topbar,.actionPanel,.modalBackdrop,.searchOverlay,.toast,input,textarea,select,.cardHead button,.miniActions,.goalStepper{display:none!important}
    button{display:block!important}
    .main{display:block!important;border:0!important;box-shadow:none!important;background:#fff!important}
    .plannerGrid,.monthlyGrid,.dailyBoard,.weekTimeline{min-width:0!important;width:100%!important;overflow:hidden!important}
    .dashboardGrid{display:block!important}
    .printDashboardOnly{width:100%;display:grid;place-items:center}
    .printDailyOnly{width:100%;display:grid;gap:10px}
    .printDailyTitle{text-align:center;font-size:20px;font-weight:950;margin-bottom:8px}
    .printDailyOnly .dailyWrap{grid-template-columns:1fr!important}
    .printDailyOnly .dayPicker{display:none!important}
    .card,.heroCard,.metric,.lane,.goalCard,.projectCard,.dreamCard{box-shadow:none!important;break-inside:avoid}
    @page{size:A4 portrait;margin:0}
  </style></head><body><main class="printDoc">${sections.map((section) => `<section class="printPage ${section.id === "dashboard" ? "dashboardPrint" : ""}"><h1>${section.title}</h1><div class="printBody">${section.id === "dashboard" ? `<div class="rotateWrap">${section.html}</div>` : section.html}</div></section>`).join("")}</main><script>setTimeout(()=>window.print(),350)</script></body></html>`);
  win.document.close();
}

function printSections(items = state.printItems) {
  const titles = Object.fromEntries(printOptions().map(([id, label]) => [id, label]));
  const renderers = {
    today: renderToday,
    planner: renderPlanner,
    dashboard: renderDashboardPrint,
    monthly: renderMonthly,
    tasks: renderTasks,
    habits: renderHabits,
    goals: renderGoals,
    projects: renderProjects,
    notes: renderNotes,
    review: renderReview,
    dreams: renderDreams,
    database: renderDatabase
  };
  return items.filter((id) => renderers[id] || id === "daily").flatMap((id) => {
    if (id === "daily") {
      const currentDate = state.selectedDate;
      return weekDates().map((date, index) => {
        state.selectedDate = date;
        const title = `${fmtMD(date)} ${["월", "화", "수", "목", "금", "토", "일"][index]}요일 일정 대시보드`;
        const html = `<div class="printDailyOnly"><div class="printDailyTitle">${title}</div>${renderDaily()}</div>`;
        state.selectedDate = currentDate;
        return { id: "daily", title, html };
      });
    }
    return [{ id, title: titles[id] || id, html: renderers[id]() }];
  });
}

function renderDashboardPrint() {
  return `<div class="printDashboardOnly">${renderWeeklyTimeline(weekEvents(), { readonly: true })}</div>`;
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
  return `<div class="goalBar" style="--goal:${progress.pct}%"><div><b>${goal.name}</b><span>${progress.current}/${goal.target}</span></div><p><i style="width:${progress.pct}%"></i></p><em>${progress.pct}%</em></div>`;
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
    category: "카테고리",
    print: "출력 모드"
  };
  const noSubmit = state.modal === "print";
  return `<div class="modalBackdrop" data-close="1"><form class="modal" data-form="${state.modal}">
    <header><h3>${titles[state.modal]}</h3><button type="button" data-close="1">닫기</button></header>
    ${modalBody(state.modal)}
    ${noSubmit ? "" : `<footer><button class="primary" type="submit">저장</button></footer>`}
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
  if (type === "print") return `<div class="printChoices">
    <button type="button" data-print-mode="week"><b>주간 출력</b><span>주간계획, 주간대시보드, 일간계획 중심</span></button>
    <button type="button" data-print-mode="month"><b>월간 출력</b><span>월간계획까지 포함한 계획 출력</span></button>
    <button type="button" data-print-mode="all"><b>전체 출력</b><span>현재 앱의 모든 주요 화면을 인쇄/PDF 저장</span></button>
  </div><p class="tiny">브라우저 인쇄창에서 대상 항목을 PDF로 저장으로 선택하면 파일로 저장할 수 있습니다.</p>`;
  if (type === "quickAdd") return `<label>내용<input name="name" placeholder="일정 또는 할 일"></label><div class="two"><label>날짜<input type="date" name="date" value="${today()}"></label><label>종류<select name="kind"><option value="event">일정</option><option value="task">할 일</option></select></label></div>`;
  if (type === "event") {
    const eventValue = state.modalData || {};
    return `<label>일정명<input name="name" list="templateSuggestions" autocomplete="off" required placeholder="예: 전자기학 공부" value="${escapeAttr(eventValue.name || "")}"></label>${templateDatalist()}<div class="two"><label>날짜<input type="date" name="date" value="${eventValue.date || state.selectedDate}"></label><label>카테고리<select name="categoryId">${categoryOptions(eventValue.categoryId)}</select></label></div><div class="two"><label>시작<input type="time" name="startTime" value="${eventValue.startTime || "09:00"}" step="1800"></label><label>종료<input type="time" name="endTime" value="${eventValue.endTime || "10:00"}" step="1800"></label></div><p class="tiny">색상은 카테고리 기준으로 자동 배정되고, 같은 카테고리 일정이 연속될 때는 구분되도록 살짝 섞입니다.</p><label>연결 목표<select name="goalId">${goalOptions(eventValue.goalId || "")}</select></label><label>메모<textarea name="memo">${escapeHtml(eventValue.memo || "")}</textarea></label>${eventValue.id ? `${eventValue.repeatRuleId ? `<button class="dangerInline" type="button" data-skip-repeat-event="${eventValue.id}">이번 회차만 제외</button>` : ""}<button class="dangerInline" type="button" data-delete-event="${eventValue.id}">일정 삭제</button>` : ""}`;
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
  if (type === "category") {
    const cat = state.modalData || {};
    return `<label>카테고리명<input name="name" required value="${escapeAttr(cat.name || "")}"></label>`;
  }
  return "";
}

function buildPrompt(type) {
  const week = weekEvents();
  const doneEvents = week.filter((event) => event.status === "completed");
  const pendingEvents = week.filter((event) => event.status !== "completed");
  const events = week.map((e) => `- ${e.date} ${e.startTime}-${e.endTime} ${e.name} [${category(e.categoryId).name}] ${e.status}${e.memo ? ` · ${e.memo}` : ""}`).join("\n");
  const byDay = weekDates().map((date) => {
    const day = week.filter((e) => e.date === date);
    const total = day.reduce((sum, e) => sum + duration(e.startTime, e.endTime), 0);
    return `- ${date}: ${day.length}개, ${Math.round(total / 60 * 10) / 10}시간`;
  }).join("\n");
  const byCategory = uniqueCategories().map((cat) => {
    const items = week.filter((e) => e.categoryId === cat.id);
    const total = items.reduce((sum, e) => sum + duration(e.startTime, e.endTime), 0);
    return `- ${cat.name}: ${items.length}개, ${Math.round(total / 60 * 10) / 10}시간`;
  }).join("\n");
  const goals = memory.goals.map((g) => {
    const p = goalProgress(g);
    return `- ${g.name}: ${p.current}/${g.target}${g.unit || ""} (${p.pct}%, ${g.period}, ${category(g.categoryId).name})`;
  }).join("\n");
  const habits = memory.habits.map((h) => `- ${h.name}: 이번 주 ${weekDates().filter((d) => habitDone(h.id, d)).length}/7`).join("\n");
  const tasks = memory.tasks.map((t) => `- ${t.name}: ${t.status}, 기한 ${t.dueDate || "없음"}, ${t.estimatedMinutes || 60}분, ${category(t.categoryId).name}`).join("\n");
  const templates = memory.templates.map((t) => `- ${t.name} [${category(t.categoryId).name}] ${t.defaultMemo || ""}`).join("\n");
  const projects = memory.projects.map((p) => `- ${p.name}: ${p.status}, ${p.area}, ${category(p.categoryId).name}`).join("\n");
  const notes = memory.notes.slice(-6).map((n) => `- ${n.title}: ${n.body}`).join("\n");
  const dreams = memory.dreams.map((d) => `- ${d.title}: ${d.area}, ${d.body}`).join("\n");
  const intro = "너는 개인 일정/습관/목표를 분석하는 플래너 코치다. 뻔한 조언 말고, 내 데이터에서 근거를 뽑아 실행 순서까지 제안해라.";
  if (type === "overload") return `${intro}\n\n[이번 주 요약]\n${byDay}\n\n[이번 주 일정 원본]\n${events || "없음"}\n\n요청: 과부하 진단을 해라.\n1. 하루별/시간대별로 무리한 구간을 찾아라.\n2. 일정 사이 회복 시간이 부족한 곳을 찾아라.\n3. 미루거나 줄여야 할 일정을 3개까지 골라라.\n4. 바꾼 뒤의 권장 일정 배치를 구체적인 시간으로 제안해라.`;
  if (type === "goal") return `${intro}\n\n[현재 목표]\n${goals || "없음"}\n\n[일정사전]\n${templates || "없음"}\n\n[최근 프로젝트]\n${projects || "없음"}\n\n요청: 다음 주에 세울 만한 목표를 추천해라.\n1. 내 반복 패턴과 일정사전에서 후보를 뽑아라.\n2. 목표는 횟수/시간/진도 중 무엇으로 측정할지 정해라.\n3. 너무 쉬운 목표, 너무 무리한 목표를 구분해라.\n4. 최종 추천 목표 5개와 그 이유를 써라.`;
  if (type === "habit") return `${intro}\n\n[습관]\n${habits || "없음"}\n\n[이번 주 요약]\n${byDay}\n\n[방해 가능 일정]\n${events || "없음"}\n\n요청: 습관 실패 원인을 찾아라.\n1. 어떤 습관이 일정 구조상 실패하기 쉬운지 분석해라.\n2. 실패 원인을 의지 문제가 아니라 시간/환경/트리거 문제로 설명해라.\n3. 각 습관별로 가장 작은 대체 행동을 제안해라.\n4. 내 일정에 맞는 실행 시간대를 추천해라.`;
  if (type === "taskPlan") return `${intro}\n\n[할 일]\n${tasks || "없음"}\n\n[기존 일정]\n${events || "없음"}\n\n요청: 할 일을 캘린더에 배치하는 전략을 세워라.\n1. 오늘/이번 주 안에 처리해야 할 것을 우선순위로 정렬해라.\n2. 각 할 일에 필요한 집중도와 적정 시간대를 추정해라.\n3. 기존 일정과 충돌하지 않는 배치안을 만들어라.\n4. 버려도 되는 할 일과 반드시 해야 하는 할 일을 나눠라.`;
  if (type === "review") return `${intro}\n\n[완료 일정]\n${doneEvents.map((e) => `- ${e.date} ${e.name}`).join("\n") || "없음"}\n\n[미완료 일정]\n${pendingEvents.map((e) => `- ${e.date} ${e.name}`).join("\n") || "없음"}\n\n[목표]\n${goals || "없음"}\n\n요청: 주간 회고 초안을 만들어라.\n1. 잘한 점 3개, 병목 3개를 데이터 근거와 함께 써라.\n2. 다음 주에 유지할 것/버릴 것/실험할 것을 나눠라.\n3. 회고 문장으로 바로 복사할 수 있게 작성해라.`;
  if (type === "monthly") return `${intro}\n\n[카테고리 분포]\n${byCategory || "없음"}\n\n[목표]\n${goals || "없음"}\n\n[프로젝트]\n${projects || "없음"}\n\n요청: 월간 방향 점검을 해라.\n1. 이번 주 계획이 월간 방향에 도움이 되는지 평가해라.\n2. 비중이 과한 카테고리와 부족한 카테고리를 말해라.\n3. 다음 4주 동안 가져갈 루틴/목표/프로젝트 우선순위를 제안해라.`;
  if (type === "dream") return `${intro}\n\n[꿈/비전]\n${dreams || "없음"}\n\n[최근 메모]\n${notes || "없음"}\n\n[프로젝트]\n${projects || "없음"}\n\n요청: 장기 비전과 이번 주 실행 사이의 간극을 분석해라.\n1. 비전과 연결되는 현재 행동을 찾아라.\n2. 비전과 무관하게 시간을 쓰는 영역을 찾아라.\n3. 이번 주 안에 할 수 있는 작은 액션 5개를 제안해라.`;
  return `${intro}\n\n[이번 주 요약]\n${byDay}\n\n[카테고리 분포]\n${byCategory || "없음"}\n\n[이번 주 일정 원본]\n${events || "없음"}\n\n[목표]\n${goals || "없음"}\n\n요청: 이번 주 계획 피드백을 해라.\n1. 현실성, 과밀 시간대, 목표 달성 가능성을 각각 점수화해라.\n2. 일정의 순서가 이상한 부분을 찾아라.\n3. 지금 상태에서 가장 효과가 큰 수정 5개를 제안해라.\n4. 수정 후 예상되는 하루 흐름을 간단히 예시로 보여줘라.`;
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
      const defaultCategory = memory.categories[0]?.id || "";
      const quickEvent = eventSeed(data.name, data.date, "09:00", "10:00", defaultCategory, autoColorIndex(defaultCategory, data.date, "09:00"), "");
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
      colorIndex: autoColorIndex(data.categoryId, data.date, data.startTime, old?.id || ""),
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
      colorIndex: autoColorIndex(data.categoryId, data.startDate || state.weekStart, data.startTime, old?.id || ""),
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
  if (state.modal === "category") {
    const old = state.modalData?.id ? await get("categories", state.modalData.id) : null;
    const categoryName = String(data.name || "").trim();
    const duplicate = memory.categories.find((cat) => cat.id !== old?.id && cat.name.trim().toLowerCase() === categoryName.toLowerCase());
    if (duplicate) {
      showToast("이미 있는 카테고리입니다.");
      return;
    }
    await put("categories", { id: old?.id || uid("cat"), name: categoryName, sortOrder: old?.sortOrder ?? memory.categories.length, isActive: true, createdAt: old?.createdAt || now, updatedAt: now });
  }
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
  if (toast) setTimeout(() => { state.toast = ""; render(); }, 3200);
}

function applyLanguage() {
  if (state.language !== "ja") return;
  const root = $("#app");
  if (!root) return;
  const excludedSelector = "input, textarea, .eventChip, .eventPill, .eventRow, .taskRow, .goalCard, .projectCard, .dreamCard, .noteItem, .searchResult";
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue.trim();
      if (!value || translateText(value) === value) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest(excludedSelector)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const value = node.nodeValue.trim();
    node.nodeValue = node.nodeValue.replace(value, translateText(value));
  });
  $$("[placeholder]").forEach((element) => {
    const value = element.getAttribute("placeholder");
    const translated = translateText(value);
    if (translated !== value) element.setAttribute("placeholder", translated);
  });
}

function render(focusSearch = false) {
  $("#app").innerHTML = appShell();
  applyLanguage();
  if (focusSearch) {
    const input = $(".searchLarge") || $(".globalSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function syncSearchInputs() {
  $$(".globalSearch").forEach((input) => {
    if (document.activeElement !== input) input.value = state.query;
  });
}

function renderSearchResultsOnly() {
  const overlay = $(".searchOverlay");
  if (!overlay) {
    render(true);
    return;
  }
  const results = overlay.querySelector(".searchResults");
  if (results) {
    const values = searchResults();
    results.innerHTML = values.length
      ? values.map(searchResultRow).join("")
      : empty(state.query.trim() ? "검색 결과가 없습니다." : "검색어를 입력하세요.");
  }
}

function openEventModal(data = {}) {
  if (data.id) {
    const now = Date.now();
    if (state.lastEventOpen.id === data.id && now - state.lastEventOpen.at < 450) return;
    state.lastEventOpen = { id: data.id, at: now };
  } else {
    state.lastEventOpen = { id: "", at: 0 };
  }
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
  $$(".slot.selecting, .slot.selectStart, .slot.selectMiddle, .slot.selectEnd, .slot.dropTarget, .slot.dropStart, .slot.dropMiddle, .slot.dropEnd, .monthSlot.dropTarget").forEach((slot) => slot.classList.remove("selecting", "selectStart", "selectMiddle", "selectEnd", "dropTarget", "dropStart", "dropMiddle", "dropEnd"));
  $$(".eventChip.dragging, .eventPill.dragging").forEach((chip) => chip.classList.remove("dragging"));
}

function paintPlannerSelection() {
  clearPlannerDragClasses();
  if (!state.drag || state.drag.type !== "select") return;
  const start = Math.min(state.drag.startMinute, state.drag.endMinute);
  const end = Math.max(state.drag.startMinute, state.drag.endMinute);
  const selected = $$(`.slot[data-date="${state.drag.date}"]`).filter((slot) => {
    const minute = Number(slot.dataset.hour) * 60 + Number(slot.dataset.minute || 0);
    return minute >= start && minute <= end;
  });
  selected.forEach((slot, index) => {
    slot.classList.add("selecting");
    if (index === 0) slot.classList.add("selectStart");
    if (index === selected.length - 1) slot.classList.add("selectEnd");
    if (index > 0 && index < selected.length - 1) slot.classList.add("selectMiddle");
  });
}

function paintMoveTarget(slot) {
  $$(".slot.dropTarget, .slot.dropStart, .slot.dropMiddle, .slot.dropEnd, .monthSlot.dropTarget").forEach((item) => item.classList.remove("dropTarget", "dropStart", "dropMiddle", "dropEnd"));
  if (!slot) return;
  if (state.drag?.type === "move") {
    const eventValue = memory.events.find((item) => item.id === state.drag.eventId);
    const span = eventValue ? eventSpanSlots(eventValue) : 1;
    const startMinute = Number(slot.dataset.hour) * 60 + Number(slot.dataset.minute || 0);
    const targets = $$(`.slot[data-date="${slot.dataset.date}"]`).filter((item) => {
      const minute = Number(item.dataset.hour) * 60 + Number(item.dataset.minute || 0);
      return minute >= startMinute && minute < startMinute + span * 30;
    });
    targets.forEach((item, index) => {
      item.classList.add("dropTarget");
      if (index === 0) item.classList.add("dropStart");
      if (index === targets.length - 1) item.classList.add("dropEnd");
      if (index > 0 && index < targets.length - 1) item.classList.add("dropMiddle");
    });
    return;
  }
  slot.classList.add("dropTarget");
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
  if (Date.now() < state.suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (state.searchOpen && !event.target.closest(".topSearch, .searchOverlay")) {
    state.searchOpen = false;
    if (!event.target.closest("button, [data-view], [data-event], [data-goal], [data-task], [data-project]")) {
      render();
      return;
    }
  }
  if (event.target.dataset.close) {
    state.modal = null;
    state.modalData = null;
    render();
    return;
  }
  const viewElement = event.target.closest("[data-view]");
  const target = event.target.closest("button");
  if (target?.dataset.action === "nextTutorial") {
    state.tutorialStep += 1;
    render();
    return;
  }
  if (target?.dataset.action === "finishTutorial") {
    state.showTutorial = false;
    state.tutorialStep = 0;
    await put("settings", { ...memory.settings, id: "app", tutorialDone: true, updatedAt: new Date().toISOString() });
    await refresh();
    return;
  }
  if (target?.dataset.action === "restartTutorial") {
    state.showTutorial = true;
    state.tutorialStep = 0;
    render();
    return;
  }
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
  if (!target && viewElement?.dataset.view) {
    state.view = viewElement.dataset.view;
    state.searchOpen = false;
    render();
    return;
  }
  if (!target) return;
  if (target.dataset.view) {
    state.view = target.dataset.view;
    state.searchOpen = false;
    state.selectedCategory = "all";
    render();
    return;
  }
  if (target.dataset.searchView) {
    state.view = target.dataset.searchView;
    state.searchOpen = false;
    state.query = "";
    if (target.dataset.searchView === "database") state.dataTab = "events";
    render();
    return;
  }
  if (target.dataset.action === "closeSearch") {
    state.searchOpen = false;
    state.query = "";
    render();
    return;
  }
  if (target.dataset.modal) {
    state.modal = target.dataset.modal;
    state.modalData = null;
    render();
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
  if (target.dataset.event) {
    if (state.modal === "event" && state.modalData?.id === target.dataset.event) return;
    const eventValue = await get("schedule_events", target.dataset.event);
    if (eventValue) openEventModal(eventValue);
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
    state.aiPromptType = target.dataset.ai;
    render();
    return;
  }
  if (target.dataset.theme) {
    state.theme = target.dataset.theme;
    await put("settings", { ...memory.settings, id: "app", theme: state.theme, updatedAt: new Date().toISOString() });
    await refresh("테마를 변경했습니다.");
    return;
  }
  if (target.dataset.language) {
    state.language = target.dataset.language;
    await put("settings", { ...memory.settings, id: "app", language: state.language, updatedAt: new Date().toISOString() });
    await refresh(state.language === "ja" ? "言語を変更しました。" : "언어를 변경했습니다.");
    return;
  }
  if (target.dataset.editCategory) {
    const cat = await get("categories", target.dataset.editCategory);
    if (cat) {
      state.modal = "category";
      state.modalData = cat;
      render();
    }
    return;
  }
  if (target.dataset.deleteCategory) {
    const cat = await get("categories", target.dataset.deleteCategory);
    if (!cat || !askDelete("카테고리")) return;
    await put("categories", { ...cat, isActive: false, updatedAt: new Date().toISOString() });
    if (state.selectedCategory === cat.id) state.selectedCategory = "all";
    await refresh("카테고리를 삭제했습니다.");
    return;
  }
  if (target.dataset.action === "printSelected") {
    openPrintDocument(state.printItems);
    return;
  }
  if (target.dataset.action === "copyShareCode") {
    await navigator.clipboard.writeText(createWeekShareCode());
    await refresh("이번 주 공유 코드를 복사했습니다.");
    return;
  }
  if (target.dataset.action === "loadFriendCode") {
    try {
      state.friendPlan = decodeSharePayload($("#friendCode")?.value || "");
      render();
    } catch (error) {
      showToast("친구 주간 코드를 읽지 못했습니다.");
    }
    return;
  }
  if (target.dataset.action === "clearFriendPlan") {
    state.friendPlan = null;
    render();
    return;
  }
  if (target.dataset.printPreset) {
    state.printItems = target.dataset.printPreset === "week"
      ? ["planner", "dashboard", "daily"]
      : target.dataset.printPreset === "month"
        ? ["planner", "dashboard", "daily", "monthly"]
        : printOptions().map(([id]) => id);
    render();
    return;
  }
  if (target.dataset.printToggle) {
    const id = target.dataset.printToggle;
    state.printItems = state.printItems.includes(id)
      ? state.printItems.filter((item) => item !== id)
      : [...state.printItems, id];
    render();
    return;
  }
  if (target.dataset.printMove) {
    const id = target.dataset.printMove;
    const dir = Number(target.dataset.dir || 0);
    const index = state.printItems.indexOf(id);
    const nextIndex = index + dir;
    if (index >= 0 && nextIndex >= 0 && nextIndex < state.printItems.length) {
      const next = [...state.printItems];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      state.printItems = next;
      render();
    }
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
      const result = await syncAllToSupabase();
      state.syncStatus = await dbHealthCheck();
      await refresh(`Supabase 업로드 완료 · 로컬 ${result.pushed}건 · 원격 ${result.remoteCount}건`);
    } catch (error) {
      console.error(error);
      await refresh(`Supabase 업로드 실패: ${friendlySyncError(error)}`);
    }
    return;
  }
  if (target.dataset.action === "syncPull") {
    if (!confirmDanger("Supabase 데이터를 현재 브라우저 로컬 저장소에 병합합니다. 계속할까요?")) return;
    try {
      await pullAllFromSupabase();
      await seed();
      await cleanupDuplicateSeedData();
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

document.addEventListener("submit", async (event) => {
  if (!event.target.matches("[data-form]")) return;
  await handleSubmit(event);
});

document.addEventListener("input", (event) => {
  if (event.target.matches(".globalSearch")) {
    if (state.isComposing || event.isComposing) return;
    state.query = event.target.value;
    state.searchOpen = !!state.query.trim();
    syncSearchInputs();
    if (state.searchOpen) renderSearchResultsOnly();
    else render();
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

document.addEventListener("compositionstart", (event) => {
  if (event.target.matches(".globalSearch")) state.isComposing = true;
});

document.addEventListener("compositionend", (event) => {
  if (!event.target.matches(".globalSearch")) return;
  state.isComposing = false;
  state.query = event.target.value;
  state.searchOpen = !!state.query.trim();
  syncSearchInputs();
  if (state.searchOpen) renderSearchResultsOnly();
  else render();
});

document.addEventListener("focusin", (event) => {
  if (!event.target.matches(".globalSearch")) return;
  state.searchOpen = true;
  if (!$(".searchOverlay")) render(true);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.searchOpen) return;
  state.searchOpen = false;
  state.query = "";
  render();
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-filter-cat-select]")) {
    state.selectedCategory = event.target.value;
    render();
    return;
  }
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

document.addEventListener("mouseup", async (event) => {
  if (!state.drag) return;

  const drag = state.drag;
  state.drag = null;
  clearPlannerDragClasses();

  if (drag.type === "move") {
    if (drag.moved && drag.targetSlot) {
      state.suppressClickUntil = Date.now() + 900;
      await moveEventToSlot(drag.eventId, drag.targetSlot);
    }
    return;
  }

  if (drag.type === "monthMove") {
    if (drag.moved && drag.targetSlot) {
      state.suppressClickUntil = Date.now() + 900;
      await moveEventToMonthDay(drag.eventId, drag.targetSlot);
    }
    return;
  }

  if (drag.type === "select") {
    if (drag.startMinute === drag.endMinute) return;
    const start = Math.min(drag.startMinute, drag.endMinute);
    const end = Math.max(drag.startMinute, drag.endMinute) + 30;
    const startTime = timeFromMinutes(start);
    const endTime = timeFromMinutes(end);

    state.suppressClickUntil = Date.now() + 900;
    event.preventDefault();
    event.stopPropagation();
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
      state.remoteBootstrapped = false;
      await syncRemoteAndCleanup();
      await flushSyncQueue();
      state.syncStatus = await dbHealthCheck();
      await load();
    }
    render();
  });
  if (state.authUser) await syncRemoteAndCleanup();
  await seed();
  await cleanupDuplicateSeedData();
  if (state.authUser) await flushSyncQueue();
  await load();
  state.showTutorial = !memory.settings?.tutorialDone && !(isSupabaseConfigured() && isSupabaseReady() && navigator.onLine && !state.authUser);
  await refresh();
}

boot().catch((error) => {
  console.error(error);
  const app = document.querySelector("#app");
  if (app) app.innerHTML = `<div class="empty">앱을 시작하지 못했습니다. 콘솔을 확인해 주세요.</div>`;
});
