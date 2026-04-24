const state = {
  userId: "girlfriend",
  adminUser: "",
  role: "user",
  progress: {
    points: 0,
    completed_count: 0,
    claimed_count: 0,
    completed_quest_ids: [],
    claimed_reward_ids: [],
    claimed_category_bonuses: [],
    quest_states: {},
  },
  quests: [],
  rewards: [],
  claims: [],
  playerClaims: [],
  submissions: [],
  giftboxMails: [],
  giftboxHistory: [],
  userPointsSummary: [],
  announcements: [],
  questTemplates: [],
  deletedQuests: [],
  selectedDeletedIds: {},
  refreshSettings: { daily_count: 5, weekly_count: 10 },
  dailyJournal: {
    log_date: "",
    visited_place: "",
    note: "",
    completed_quest_ids: [],
  },
  completedQuestsByDate: [],
  selectedQuestIds: {},
  questSortBy: "published_date",
  questSortOrder: "desc",
  questFilterDifficulty: "all",
  activeQuestCategory: "all",
  activeAdminQuestTab: "list",
  activeEventAdminTab: "create",
  activeMallTab: "shop",
  gachaPity: { bronze: 0, silver: 0, gold: 0 },
  gachaPityLimits: { bronze: 10, silver: 20, gold: 30 },
  gachaOverview: {},
  eventSchedules: [],
  importedEventQuests: [],
  wishes: [],
  collapsedQuestIds: {},
  expandedSubmissionIds: {},
  editingQuestId: null,
  editingRewardId: null,
};

const USER_PASSPHRASE = "咕咕嘎嘎";
const ADMIN_PASSPHRASE = "tim0403";
const SESSION_KEY = "love_quest_admin_session";
const DEFAULT_USER_ID = "郭芸甄";
const DEFAULT_ADMIN_ID = "admin";
const GACHA_CHESTS = {
  bronze: {
    label: "銅寶箱",
    icon: "🥉",
    image: "/img/bronze_chest_nobg.png",
    cost: 200,
    pool: [
      { rank: "SSS", points: 1500, rate: 5 },
      { rank: "S", points: 120, rate: 15 },
      { rank: "A", points: 40, rate: 30 },
      { rank: "B", points: 10, rate: 50 },
    ],
  },
  silver: {
    label: "銀寶箱",
    icon: "🥈",
    image: "/img/silver_chest_nobg.png",
    cost: 500,
    pool: [
      { rank: "SSS", points: 5000, rate: 3 },
      { rank: "S", points: 350, rate: 12 },
      { rank: "A", points: 120, rate: 25 },
      { rank: "B", points: 20, rate: 60 },
    ],
  },
  gold: {
    label: "金寶箱",
    icon: "🥇",
    image: "/img/gold_chest_nobg.png",
    cost: 1000,
    pool: [
      { rank: "SSS", points: 12000, rate: 1 },
      { rank: "S", points: 900, rate: 9 },
      { rank: "A", points: 250, rate: 20 },
      { rank: "B", points: 30, rate: 70 },
    ],
  },
};
let globalLoadingCount = 0;

const $ = (selector) => document.querySelector(selector);

let _multiplierTimerHandle = null;

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getActiveMultiplierEvents() {
  const today = todayIso();
  return (state.eventSchedules || []).filter((ev) => {
    const m = parseFloat(ev.point_multiplier || 1);
    if (m <= 1) return false;
    return (!ev.start_date || ev.start_date <= today) && (!ev.end_date || ev.end_date >= today);
  });
}

function renderMultiplierBanner() {
  const banner = $("#point-multiplier-banner");
  if (!banner) return;
  if (_multiplierTimerHandle) {
    clearInterval(_multiplierTimerHandle);
    _multiplierTimerHandle = null;
  }

  const events = getActiveMultiplierEvents();
  if (!events.length) {
    banner.innerHTML = "";
    return;
  }

  function buildHTML() {
    return events
      .map((ev) => {
        const m = parseFloat(ev.point_multiplier || 1);
        const label = Number.isFinite(m) ? (Number.isInteger(m) ? `${m}` : m.toFixed(1)) : "1.0";
        const endStr = ev.end_date ? `${ev.end_date}T23:59:59` : null;
        const endMs = endStr ? new Date(endStr).getTime() : null;
        let countdownHtml = "";

        if (Number.isFinite(endMs)) {
          const diff = endMs - Date.now();
          if (diff > 0) {
            const totalSec = Math.floor(diff / 1000);
            const d = Math.floor(totalSec / 86400);
            const h = Math.floor((totalSec % 86400) / 3600);
            const min = Math.floor((totalSec % 3600) / 60);
            const sec = totalSec % 60;
            const timeStr =
              d > 0
                ? `${d}天 ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
                : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
            countdownHtml = `<span class="multiplier-countdown">⏳ 剩餘 ${timeStr}</span>`;
          } else {
            countdownHtml = `<span class="multiplier-countdown">活動已結束</span>`;
          }
        }

        return `<div class="multiplier-banner-item">
        <span class="multiplier-badge">✨ 點數 × ${label}</span>
        <span class="multiplier-title">${ev.title || "點數加倍活動"}</span>
        ${countdownHtml}
      </div>`;
      })
      .join("");
  }

  banner.innerHTML = `<div class="multiplier-banner">${buildHTML()}</div>`;
  _multiplierTimerHandle = setInterval(() => {
    const inner = banner.querySelector(".multiplier-banner");
    if (!inner) {
      clearInterval(_multiplierTimerHandle);
      _multiplierTimerHandle = null;
      return;
    }
    inner.innerHTML = buildHTML();
  }, 1000);
}

function api(path, options = {}) {
  return fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json.detail?.message || json.message || "發生錯誤";
      throw new Error(detail);
    }
    return json;
  });
}

function apiForm(path, formData) {
  return fetch(path, {
    method: "POST",
    body: formData,
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json.detail?.message || json.message || "發生錯誤";
      throw new Error(detail);
    }
    return json;
  });
}

function showGlobalLoading(text = "資料載入中，請稍後...") {
  const mask = $("#global-loading");
  const textEl = $("#global-loading-text");
  globalLoadingCount += 1;
  if (textEl) textEl.textContent = text;
  mask?.classList.remove("is-hidden");
}

function hideGlobalLoading() {
  const mask = $("#global-loading");
  globalLoadingCount = Math.max(0, globalLoadingCount - 1);
  if (globalLoadingCount === 0) {
    mask?.classList.add("is-hidden");
  }
}

function setMessage(text, isError = false) {
  const el = $("#message");
  el.textContent = text;
  el.className = "status-msg " + (isError ? "bad" : "good");
}

function setAuthMessage(text, isError = false) {
  const el = $("#auth-message");
  if (!el) return;
  el.textContent = text;
  el.className = "auth-message " + (isError ? "bad" : "good");
}

function renderPlayerName() {
  const el = $("#user-id-label");
  if (!el) return;
  el.textContent = state.userId;
}

function applyRoleUI() {
  const adminFormPanels = document.querySelectorAll(".admin-form-panel");
  const adminClaimsBoard = $("#admin-claims-board");
  const adminReviewBoard = $("#admin-review-board");
  const playerHistoryBoard = $("#player-claim-history-board");

  if (state.role === "admin") {
    adminFormPanels.forEach((p) => p.classList.remove("is-hidden"));
    adminClaimsBoard?.classList.remove("is-hidden");
    adminReviewBoard?.classList.remove("is-hidden");
    playerHistoryBoard?.classList.add("is-hidden");
  } else {
    adminFormPanels.forEach((p) => p.classList.add("is-hidden"));
    adminClaimsBoard?.classList.add("is-hidden");
    adminReviewBoard?.classList.add("is-hidden");
    playerHistoryBoard?.classList.remove("is-hidden");
    state.activeAdminQuestTab = "list";
  }

  renderAdminQuestNav();
  applyAdminQuestTabVisibility();
  renderMallNav();
}

function renderAdminQuestNav() {
  const nav = $("#admin-quest-nav");
  if (!nav) return;

  const tabs = nav.querySelectorAll("[data-admin-quest-tab]");
  const adminTabs = nav.querySelectorAll(".admin-only-quest-tab");
  adminTabs.forEach((btn) => btn.classList.toggle("is-hidden", state.role !== "admin"));

  const allowedTabs = state.role === "admin"
    ? new Set(["list", "journal", "create", "review", "database", "event-schedule", "deleted", "points"])
    : new Set(["list", "journal"]);
  if (!allowedTabs.has(state.activeAdminQuestTab)) {
    state.activeAdminQuestTab = "list";
  }

  tabs.forEach((btn) => {
    const tab = btn.getAttribute("data-admin-quest-tab");
    btn.classList.toggle("active", state.activeAdminQuestTab === tab);
  });
}

function applyAdminQuestTabVisibility() {
  const nav = $("#admin-quest-nav");
  const topRow = $("#admin-quest-top-row");
  const formPanel = $("#admin-quest-form-panel");
  const reviewBoard = $("#admin-review-board");
  const listBoard = $("#quest-list-board");
  const listHeader = listBoard?.querySelector(":scope > .sign-header");
  const adminTools = $("#admin-quest-tools");
  const categoryNav = $("#quest-category-nav");
  const toolbar = listBoard?.querySelector(":scope .quest-toolbar");
  const questList = $("#quest-list");
  const dailyJournalBoard = $("#daily-journal-board");
  const templateBoard = $("#admin-template-board");
  const deletedBoard = $("#admin-deleted-quests-board");
  const pointsBoard = $("#admin-user-points-board");
  const eventScheduleBoard = $("#admin-event-schedule-board");
  if (!nav || !topRow || !formPanel || !reviewBoard || !listBoard) return;

  // Always hide event schedule board by default; only show for its tab
  eventScheduleBoard?.classList.add("is-hidden");

  const setListMode = (mode) => {
    const isListMode = mode === "list";
    const isJournalMode = mode === "journal";
    const isDatabaseMode = mode === "database";
    const isDeletedMode = mode === "deleted";
    const isPointsMode = mode === "points";
    if (listHeader) listHeader.classList.toggle("is-hidden", !isListMode && !isDatabaseMode);
    adminTools?.classList.toggle("is-hidden", !isListMode || state.role !== "admin");
    categoryNav?.classList.toggle("is-hidden", !isListMode && !isDatabaseMode);
    toolbar?.classList.toggle("is-hidden", !isListMode && !isDatabaseMode);
    questList?.classList.toggle("is-hidden", !isListMode && !isDatabaseMode);
    dailyJournalBoard?.classList.toggle("is-hidden", !isJournalMode);
    templateBoard?.classList.toggle("is-hidden", !isDatabaseMode);
    deletedBoard?.classList.toggle("is-hidden", !isDeletedMode);
    pointsBoard?.classList.toggle("is-hidden", !isPointsMode);
  };

  if (state.role !== "admin") {
    nav.classList.remove("is-hidden");
    topRow.classList.add("is-hidden");
    listBoard.classList.remove("is-hidden");
    setListMode(state.activeAdminQuestTab === "journal" ? "journal" : "list");
    return;
  }

  nav.classList.remove("is-hidden");

  if (state.activeAdminQuestTab === "create") {
    topRow.classList.remove("is-hidden");
    formPanel.classList.remove("is-hidden");
    reviewBoard.classList.add("is-hidden");
    listBoard.classList.add("is-hidden");
    setListMode("list");
    return;
  }

  if (state.activeAdminQuestTab === "review") {
    topRow.classList.remove("is-hidden");
    formPanel.classList.add("is-hidden");
    reviewBoard.classList.remove("is-hidden");
    listBoard.classList.add("is-hidden");
    setListMode("list");
    return;
  }

  if (state.activeAdminQuestTab === "database") {
    topRow.classList.add("is-hidden");
    listBoard.classList.remove("is-hidden");
    setListMode("database");
    return;
  }

  if (state.activeAdminQuestTab === "journal") {
    topRow.classList.add("is-hidden");
    listBoard.classList.remove("is-hidden");
    setListMode("journal");
    return;
  }

  if (state.activeAdminQuestTab === "event-schedule") {
    topRow.classList.add("is-hidden");
    listBoard.classList.add("is-hidden");
    eventScheduleBoard?.classList.remove("is-hidden");
    renderEventAdminNav();
    applyEventAdminTabVisibility();
    return;
  }

  if (state.activeAdminQuestTab === "deleted") {
    topRow.classList.add("is-hidden");
    listBoard.classList.remove("is-hidden");
    setListMode("deleted");
    renderDeletedQuests();
    return;
  }

  if (state.activeAdminQuestTab === "points") {
    topRow.classList.add("is-hidden");
    listBoard.classList.remove("is-hidden");
    setListMode("points");
    renderAdminUserPoints();
    return;
  }

  topRow.classList.add("is-hidden");
  formPanel.classList.remove("is-hidden");
  reviewBoard.classList.remove("is-hidden");
  listBoard.classList.remove("is-hidden");
  setListMode("list");
}

function unlockAdmin(user, role) {
  state.adminUser = user;
  state.role = role;
  state.userId = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user, role }));
  $("#auth-gate").classList.add("is-hidden");
  $("#app-shell").classList.remove("is-hidden");
  renderPlayerName();
  applyRoleUI();
}

async function doLogin(pass) {
  let role = "";
  if (pass === ADMIN_PASSPHRASE) {
    role = "admin";
  } else if (pass === USER_PASSPHRASE) {
    role = "user";
  } else {
    throw new Error("通關密語錯誤");
  }

  const loginUser = role === "admin" ? DEFAULT_ADMIN_ID : DEFAULT_USER_ID;
  unlockAdmin(loginUser, role);
  await refreshAll();
  setMessage(role === "admin" ? "管理員中心已解鎖" : "");
}

async function onLogin(event) {
  event.preventDefault();
  const pass = $("#login-pass").value.trim();

  try {
    await doLogin(pass);
  } catch (err) {
    setAuthMessage(err.message, true);
    return;
  }

  $("#login-form").reset();
}

async function onQuickUserLogin() {
  try {
    await doLogin(USER_PASSPHRASE);
  } catch (err) {
    setAuthMessage(err.message, true);
  }
}

async function onQuickAdminLogin() {
  try {
    await doLogin(ADMIN_PASSPHRASE);
  } catch (err) {
    setAuthMessage(err.message, true);
  }
}

function onLogout() {
  localStorage.removeItem(SESSION_KEY);
  state.role = "user";
  state.adminUser = "";
  state.activeAdminQuestTab = "list";
  state.submissions = [];
  state.claims = [];
  state.playerClaims = [];
  state.giftboxMails = [];
  state.giftboxHistory = [];
  state.questTemplates = [];
  state.deletedQuests = [];
  state.selectedDeletedIds = {};
  state.selectedQuestIds = {};
  state.importedEventQuests = [];
  state.expandedSubmissionIds = {};
  state.editingQuestId = null;
  state.editingRewardId = null;
  $("#app-shell").classList.add("is-hidden");
  $("#auth-gate").classList.remove("is-hidden");
  $("#login-form").reset();
  setMessage("");
  setAuthMessage("已登出");
}

function showView(view) {
  const announceView = $("#view-announce");
  const questsView = $("#view-quests");
  const mallView = $("#view-mall");
  const wishView = $("#view-wish");
  const navAnnounceBtn = $("#nav-announce-btn");
  const navQuestsBtn = $("#nav-quests-btn");
  const mallBtn = $("#open-mall-btn");
  const navWishBtn = $("#nav-wish-btn");

  [announceView, questsView, mallView, wishView].forEach((v) => v?.classList.add("is-hidden"));
  [navAnnounceBtn, navQuestsBtn, mallBtn, navWishBtn].forEach((b) => b?.classList.remove("nav-active"));

  if (view === "announce") {
    announceView?.classList.remove("is-hidden");
    navAnnounceBtn?.classList.add("nav-active");
  } else if (view === "mall") {
    mallView?.classList.remove("is-hidden");
    mallBtn?.classList.add("nav-active");
  } else if (view === "wish") {
    wishView?.classList.remove("is-hidden");
    navWishBtn?.classList.add("nav-active");
    // update board header visibility based on role
    wishView?.querySelectorAll(".admin-only").forEach((el) =>
      el.classList.toggle("is-hidden", state.role !== "admin")
    );
    wishView?.querySelectorAll(".user-only").forEach((el) =>
      el.classList.toggle("is-hidden", state.role === "admin")
    );
  } else {
    questsView?.classList.remove("is-hidden");
    navQuestsBtn?.classList.add("nav-active");
  }
}

function openRewardMall() {
  showView("mall");
}

function closeRewardMall() {
  showView("quests");
}

function applyMallTabVisibility() {
  const rewardFormPanel = $("#admin-reward-form-panel");
  const giftDispatchPanel = $("#admin-gift-dispatch-panel");
  const rewardBoard = $("#mall-reward-board");
  const gachaBoard = $("#mall-gacha-board");
  const adminClaimsBoard = $("#admin-claims-board");
  const adminGiftHistoryBoard = $("#admin-gift-history-board");
  const historyBoard = $("#player-claim-history-board");
  const isAdmin = state.role === "admin";

  if (!isAdmin) {
    const showHistory = state.activeMallTab === "history";
    const showGacha = state.activeMallTab === "gacha";
    rewardFormPanel?.classList.add("is-hidden");
    giftDispatchPanel?.classList.add("is-hidden");
    adminClaimsBoard?.classList.add("is-hidden");
    adminGiftHistoryBoard?.classList.add("is-hidden");
    rewardBoard?.classList.toggle("is-hidden", showHistory || showGacha);
    historyBoard?.classList.toggle("is-hidden", !showHistory);
    gachaBoard?.classList.toggle("is-hidden", !showGacha);
    return;
  }

  const validAdminTabs = new Set(["shop", "create", "dispatch", "claims", "gift-history", "gacha"]);
  if (!validAdminTabs.has(state.activeMallTab)) {
    state.activeMallTab = "shop";
  }

  rewardFormPanel?.classList.toggle("is-hidden", state.activeMallTab !== "create");
  giftDispatchPanel?.classList.toggle("is-hidden", state.activeMallTab !== "dispatch");
  rewardBoard?.classList.toggle("is-hidden", state.activeMallTab !== "shop");
  gachaBoard?.classList.toggle("is-hidden", state.activeMallTab !== "gacha");
  adminClaimsBoard?.classList.toggle("is-hidden", state.activeMallTab !== "claims");
  adminGiftHistoryBoard?.classList.toggle("is-hidden", state.activeMallTab !== "gift-history");
  historyBoard?.classList.add("is-hidden");
}

function renderMallNav() {
  const nav = $("#mall-nav");
  if (!nav) return;

  nav.innerHTML = "";
  const isAdmin = state.role === "admin";
  const tabs = isAdmin
    ? [
        { key: "shop", label: "獎勵商城", icon: "🎁", count: state.rewards.length },
        { key: "gacha", label: "寶箱抽獎", icon: "🎲" },
        { key: "create", label: "新增獎勵", icon: "🛠️" },
        { key: "dispatch", label: "派發點數", icon: "💰" },
        { key: "claims", label: "兌換管理", icon: "📦", count: state.claims.length },
        { key: "gift-history", label: "送禮歷史", icon: "🧾", count: state.giftboxHistory.length },
      ]
    : [
        { key: "shop", label: "獎勵商城", icon: "🎁", count: state.rewards.length },
        { key: "gacha", label: "寶箱抽獎", icon: "🎲" },
        { key: "history", label: "兌換歷史", icon: "🧾", count: state.playerClaims.length },
      ];

  const validTabKeys = new Set(tabs.map((tab) => tab.key));
  if (!validTabKeys.has(state.activeMallTab)) {
    state.activeMallTab = "shop";
  }

  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `quest-cat-tab${state.activeMallTab === tab.key ? " active" : ""}`;
    btn.setAttribute("data-mall-tab", tab.key);
    const badgeHtml = Number.isFinite(tab.count)
      ? `<span class="tab-remain">${tab.count}</span>`
      : "";
    btn.innerHTML = `
      <span class="tab-icon">${tab.icon}</span>
      <span class="tab-label">${tab.label}</span>
      ${badgeHtml}
    `;
    nav.appendChild(btn);
  });

  applyMallTabVisibility();
}

function openGiftboxModal() {
  $("#giftbox-modal")?.classList.remove("is-hidden");
}

function closeGiftboxModal() {
  $("#giftbox-modal")?.classList.add("is-hidden");
}

function openDailyJournalModal(entry) {
  const modal = $("#journal-detail-modal");
  if (!modal || !entry) return;

  const dateEl = $("#journal-detail-date");
  const placeWrap = $("#journal-detail-place-wrap");
  const placeEl = $("#journal-detail-place");
  const noteEl = $("#journal-detail-note");
  const questsTitleEl = $("#journal-detail-quests-title");
  const questsListEl = $("#journal-detail-quests");

  if (!dateEl || !placeWrap || !placeEl || !noteEl || !questsTitleEl || !questsListEl) return;

  const completedQuests = Array.isArray(entry.completed_quests) ? entry.completed_quests : [];
  const completedCount = entry.completed_quest_count ?? completedQuests.length;

  dateEl.textContent = entry.log_date || todayIso();
  if (entry.visited_place) {
    placeWrap.classList.remove("is-hidden");
    placeEl.textContent = entry.visited_place;
  } else {
    placeWrap.classList.add("is-hidden");
    placeEl.textContent = "";
  }

  noteEl.textContent = entry.note || "這天沒有留下文字紀錄。";
  questsTitleEl.textContent = `✅ 完成任務（${completedCount}）`;

  questsListEl.innerHTML = "";
  if (!completedQuests.length) {
    const empty = document.createElement("li");
    empty.className = "journal-modal-empty";
    empty.textContent = "這天沒有勾選完成任務。";
    questsListEl.appendChild(empty);
  } else {
    completedQuests.forEach((quest) => {
      const li = document.createElement("li");
      li.className = "journal-modal-quest-item";

      const title = document.createElement("span");
      title.textContent = quest?.title || "未命名任務";

      const points = Number(quest?.points_awarded ?? quest?.points ?? 0);
      const pts = document.createElement("span");
      pts.className = "journal-modal-quest-points";
      pts.textContent = `+${points} 點`;

      li.appendChild(title);
      li.appendChild(pts);
      questsListEl.appendChild(li);
    });
  }

  modal.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
}

function closeDailyJournalModal() {
  $("#journal-detail-modal")?.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
}

function showConfirmModal(message) {
  const modal = $("#confirm-modal");
  const messageEl = $("#confirm-message");
  const okBtn = $("#confirm-ok-btn");
  const cancelBtn = $("#confirm-cancel-btn");
  if (!modal || !messageEl || !okBtn || !cancelBtn) {
    return Promise.resolve(window.confirm(message));
  }

  messageEl.textContent = message || "確定要繼續嗎？";
  modal.classList.remove("is-hidden");

  return new Promise((resolve) => {
    const cleanup = () => {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      modal.classList.add("is-hidden");
    };
    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const onBackdrop = (event) => {
      if (event.target.id === "confirm-modal") {
        cleanup();
        resolve(false);
      }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
  });
}

function renderGiftboxBadge() {
  const badge = $("#giftbox-badge");
  if (!badge) return;
  const count = state.giftboxMails.filter(
    (m) => !m.is_read || (Number(m.points || 0) > 0 && !m.points_claimed)
  ).length;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove("is-hidden");
  } else {
    badge.textContent = "0";
    badge.classList.add("is-hidden");
  }
}

function renderGiftbox() {
  const list = $("#giftbox-list");
  if (!list) return;

  list.innerHTML = "";
  if (!state.giftboxMails.length) {
    list.innerHTML = '<div class="muted">目前禮物盒是空的。</div>';
    return;
  }

  state.giftboxMails.forEach((mail) => {
    const pts = Number(mail.points || 0);
    const claimed = !!mail.points_claimed;
    const isRead = !!mail.is_read;
    const row = document.createElement("article");
    row.className = `item giftbox-item${isRead ? " is-read" : ""}`;
    row.innerHTML = `
      <div class="giftbox-row-main">
        <div class="giftbox-row-title">${mail.title || "未命名信件"}</div>
        <div class="giftbox-row-right">
          ${pts > 0 ? `<span class="giftbox-attachment-icon" title="含點數">💰${claimed ? "✓" : ""}</span>` : ""}
          ${!isRead ? '<span class="pill">未讀</span>' : '<span class="pill">已讀</span>'}
        </div>
      </div>
      <div class="muted">${mail.content || ""}</div>
      ${pts > 0 ? `<div class="muted">點數：+${pts} 點</div>` : ""}
      <div class="giftbox-row-actions">
        ${pts > 0
          ? `<button class="btn-wood btn-sm btn-accent" data-mail-claim="${mail.id}" ${claimed ? "disabled" : ""}>${claimed ? "已領取" : `領取 +${pts} 點`}</button>`
          : ""}
      </div>
    `;
    list.appendChild(row);
  });
}

function renderGiftHistory() {
  const list = $("#gift-history-list");
  if (!list) return;
  list.innerHTML = "";
  if (state.role !== "admin") return;
  if (!state.giftboxHistory.length) {
    list.innerHTML = '<div class="muted">目前沒有送禮歷史。</div>';
    return;
  }
  state.giftboxHistory.forEach((h) => {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <strong>${h.title || "未命名信件"}</strong>
        <span class="pill">${h.points > 0 ? `+${h.points} 點` : "純訊息"}</span>
      </div>
      <div class="muted">收件人：${h.user_id || "-"}</div>
      <div class="muted">內容：${h.content || ""}</div>
    `;
    list.appendChild(item);
  });
}

function renderDeletedQuests() {
  const list = $("#deleted-quest-list");
  if (!list) return;
  list.innerHTML = "";
  if (state.role !== "admin") return;
  if (!state.deletedQuests.length) {
    list.innerHTML = '<div class="muted">目前沒有最近刪除紀錄。</div>';
    return;
  }
  state.deletedQuests.forEach((q) => {
    const isChecked = !!state.selectedDeletedIds[q.id];
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <label class="quest-select-wrap"><input type="checkbox" data-select-deleted="${q.id}" ${isChecked ? "checked" : ""}> 勾選</label>
        <strong>${q.title || "未命名任務"}</strong>
        <span class="pill">${q.reason || "manual"}</span>
      </div>
      <div class="muted">點數：${q.points || 0} ｜ 難度：${difficultyLabel(q.difficulty)}</div>
      <div class="review-actions">
        <button class="btn-wood btn-sm btn-accent" data-restore-deleted="${q.id}" type="button">回復</button>
        <button class="btn-wood btn-sm btn-brand" data-perm-delete-deleted="${q.id}" type="button">永久刪除</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderAdminUserPoints() {
  const list = $("#admin-user-points-list");
  if (!list) return;
  list.innerHTML = "";

  if (state.role !== "admin") {
    return;
  }

  if (!state.userPointsSummary.length) {
    list.innerHTML = '<div class="muted">目前沒有可顯示的玩家資料。</div>';
    return;
  }

  state.userPointsSummary.forEach((row) => {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <strong>${row.user_id}</strong>
        <span class="pill">${row.points} 點</span>
      </div>
      <div class="muted">完成任務：${row.completed_count || 0} ｜ 已兌換：${row.claimed_count || 0}</div>
    `;
    list.appendChild(item);
  });
}

function renderDailyJournal() {
  const dateInput = $("#journal-date");
  const placeInput = $("#journal-visited-place");
  const noteInput = $("#journal-note");
  const completedList = $("#journal-completed-quests");
  if (!dateInput || !placeInput || !noteInput || !completedList) return;

  const logDate = state.dailyJournal.log_date || dateInput.value || todayIso();
  dateInput.value = logDate;
  placeInput.value = state.dailyJournal.visited_place || "";
  noteInput.value = state.dailyJournal.note || "";

  const selectedIds = new Set(state.dailyJournal.completed_quest_ids || []);
  completedList.innerHTML = "";

  if (!state.completedQuestsByDate.length) {
    completedList.innerHTML = '<div class="muted">這一天目前沒有已完成任務。</div>';
    return;
  }

  state.completedQuestsByDate.forEach((quest) => {
    const row = document.createElement("label");
    row.className = "journal-quest-row";
    row.innerHTML = `
      <input type="checkbox" data-journal-quest-id="${quest.quest_id}" ${selectedIds.has(quest.quest_id) ? "checked" : ""} />
      <span>${quest.title || "未命名任務"}</span>
      <span class="pill">+${quest.points_awarded || 0} 點</span>
    `;
    completedList.appendChild(row);
  });
}

async function loadDailyJournalByDate(logDate) {
  const safeDate = logDate || todayIso();
  const user = encodeURIComponent(state.userId || DEFAULT_USER_ID);
  const dateParam = encodeURIComponent(safeDate);
  const [completed, journal] = await Promise.all([
    api(`/api/completed-quests/${user}?date=${dateParam}`),
    api(`/api/daily-journal/${user}?date=${dateParam}`),
  ]);
  state.completedQuestsByDate = Array.isArray(completed) ? completed : [];
  state.dailyJournal = {
    log_date: journal.log_date || safeDate,
    visited_place: journal.visited_place || "",
    note: journal.note || "",
    completed_quest_ids: journal.completed_quest_ids || [],
  };
  renderDailyJournal();
}

async function loadJournalHistory() {
  const list = $("#journal-history-list");
  if (!list) return;
  list.innerHTML = '<div class="muted">載入中…</div>';
  try {
    const user = encodeURIComponent(state.userId || DEFAULT_USER_ID);
    const entries = await api(`/api/daily-journals/${user}`);
    renderJournalHistory(Array.isArray(entries) ? entries : []);
  } catch {
    list.innerHTML = '<div class="muted">無法載入歷史日誌。</div>';
  }
}

function renderJournalHistory(entries) {
  const list = $("#journal-history-list");
  if (!list) return;
  list.innerHTML = "";
  if (!entries.length) {
    list.innerHTML = '<div class="muted">還沒有任何日誌記錄。</div>';
    return;
  }
  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "journal-history-card item";
    const completedCount = entry.completed_quest_count ?? (entry.completed_quests?.length ?? 0);
    const place = entry.visited_place ? `<span class="journal-hist-place">📍 ${entry.visited_place}</span>` : "";
    const noteText = entry.note ? `<p class="journal-hist-note">${entry.note}</p>` : "";
    const questBadge = completedCount > 0 ? `<span class="pill">完成 ${completedCount} 個任務</span>` : "";
    card.innerHTML = `
      <div class="item-head">
        <strong class="journal-hist-date">${entry.log_date || ""}</strong>
        ${questBadge}
      </div>
      ${place}
      ${noteText}
    `;
    card.addEventListener("click", () => {
      openDailyJournalModal(entry);
      loadDailyJournalByDate(entry.log_date);
    });
    list.appendChild(card);
  });
}

async function saveDailyJournal(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const logDate = $("#journal-date")?.value || todayIso();
    const selectedIds = Array.from(document.querySelectorAll('[data-journal-quest-id]:checked')).map(
      (el) => el.getAttribute("data-journal-quest-id")
    ).filter(Boolean);

    const payload = {
      log_date: logDate,
      visited_place: $("#journal-visited-place")?.value.trim() || "",
      note: $("#journal-note")?.value.trim() || "",
      completed_quest_ids: selectedIds,
    };
    const result = await api(`/api/daily-journal/${encodeURIComponent(state.userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.dailyJournal = {
      log_date: result.log_date || logDate,
      visited_place: result.visited_place || payload.visited_place,
      note: result.note || payload.note,
      completed_quest_ids: result.completed_quest_ids || selectedIds,
    };
    renderDailyJournal();
    setMessage(result.message || "每日日誌已儲存");
    loadJournalHistory();
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
  }
}

function getFilteredTemplates() {
  const keyword = ($("#template-search")?.value || "").trim().toLowerCase();
  if (!keyword) return state.questTemplates;
  return state.questTemplates.filter((t) =>
    String(t.title || "").toLowerCase().includes(keyword) ||
    String(t.description || "").toLowerCase().includes(keyword)
  );
}

function renderTemplateList() {
  const list = $("#template-list");
  if (!list) return;
  list.innerHTML = "";
  if (state.role !== "admin") return;

  const templates = getFilteredTemplates();
  if (!templates.length) {
    list.innerHTML = '<div class="muted">任務資料庫目前沒有資料。</div>';
    return;
  }

  templates.forEach((t) => {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <strong>${t.title || "未命名任務"}</strong>
        <span class="pill">${t.category || "other"}</span>
      </div>
      <div class="muted">${t.description || ""}</div>
      <div class="muted">+${t.points || 0} 點 ｜ ${difficultyLabel(t.difficulty)} ｜ 截止天數 ${t.due_days ?? 7}</div>
      <div class="review-actions">
        <button class="btn-wood btn-sm btn-accent" type="button" data-template-spawn="${t.id}">指派到任務清單</button>
        <button class="btn-wood btn-sm btn-brand" type="button" data-template-delete="${t.id}">刪除資料庫任務</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderStats() {
  $("#stat-points").textContent = state.progress.points;
  const completedEl = $("#stat-completed");
  if (completedEl) completedEl.textContent = state.progress.completed_count;
}

function difficultyLabel(value) {
  const map = { easy: "簡單", medium: "普通", hard: "困難" };
  return map[value] || "未設定";
}

const CATEGORY_CONFIG = {
  daily:  { label: "每日任務", icon: "☀️" },
  weekly: { label: "每周任務", icon: "📅" },
  event:  { label: "活動任務", icon: "🎉" },
  other:  { label: "其他任務", icon: "⚔️" },
};

const CATEGORY_ORDER = ["event", "daily", "weekly", "other"];

function getQuestCategory(quest) {
  if (quest.category && quest.category !== "other") return quest.category;
  const title = quest.title || "";
  if (title.startsWith("每日")) return "daily";
  if (title.startsWith("每週") || title.startsWith("每周")) return "weekly";
  if (title.startsWith("活動")) return "event";
  return "other";
}

function calcCategoryBonus(categoryQuests) {
  const totalPoints = categoryQuests.reduce((sum, q) => sum + Number(q.points || 0), 0);
  const dates = categoryQuests.map((q) => q.published_date).filter(Boolean).sort();
  const earliest = dates.length ? new Date(dates[0]) : new Date();
  const today = new Date();
  const daysDiff = Math.max(0, Math.floor((today - earliest) / (1000 * 60 * 60 * 24)));
  let multiplier;
  if (daysDiff <= 1)      multiplier = 3.0;
  else if (daysDiff <= 3) multiplier = 2.0;
  else if (daysDiff <= 7) multiplier = 1.5;
  else                    multiplier = 1.0;
  const baseBonus = Math.max(1, Math.ceil(totalPoints * 0.1));
  const finalBonus = Math.round(baseBonus * multiplier);
  return { baseBonus, multiplier, finalBonus };
}

function getDeadlineText(dueDate) {
  if (!dueDate) return "未設定截止";
  const deadline = new Date(`${dueDate}T23:59:59`);
  if (Number.isNaN(deadline.getTime())) return "截止時間格式錯誤";

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return "已截止";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}天 ${hours}小時 ${minutes}分`;
  if (hours > 0) return `${hours}小時 ${minutes}分`;
  return `${minutes}分`;
}

function getVisibleQuests() {
  let quests = [...state.quests];

  if (state.questFilterDifficulty !== "all") {
    quests = quests.filter((q) => (q.difficulty || "easy") === state.questFilterDifficulty);
  }

  const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
  const dir = state.questSortOrder === "asc" ? 1 : -1;

  // Primary sort: sort_order desc (promoted quests come first), secondary: user-selected sort
  quests.sort((a, b) => {
    // sort_order tiebreak first (higher = top); ignore when user sorts by something else
    const so = (Number(b.sort_order ?? 0) - Number(a.sort_order ?? 0));
    if (state.questSortBy === "points") {
      const pts = (Number(a.points || 0) - Number(b.points || 0)) * dir;
      return pts !== 0 ? pts : so;
    }
    if (state.questSortBy === "difficulty") {
      const diff = ((difficultyOrder[a.difficulty || "easy"] || 0) - (difficultyOrder[b.difficulty || "easy"] || 0)) * dir;
      return diff !== 0 ? diff : so;
    }
    // default: sort_order desc first, then published_date
    if (so !== 0) return so;
    const da = String(a.published_date || "");
    const db = String(b.published_date || "");
    return da.localeCompare(db) * dir;
  });

  // For non-admin users (and admin in list tab), cap visible daily/weekly by refreshSettings.
  const applyVisibilityCap = state.role !== "admin" || state.activeAdminQuestTab === "list";
  if (applyVisibilityCap) {
    const questStates = state.progress.quest_states || {};
    const completedIds = new Set(state.progress.completed_quest_ids || []);
    const inProgress = (q) => {
      const s = questStates[q.id] || "";
      return completedIds.has(q.id) || s === "accepted" || s === "submitted" || s === "approved" || s === "rejected";
    };

    const dailyLimit = Number(state.refreshSettings.daily_count ?? 5);
    const weeklyLimit = Number(state.refreshSettings.weekly_count ?? 10);
    let dailyShown = 0;
    let weeklyShown = 0;

    quests = quests.filter((q) => {
      // quests with sort_order < 0 are explicitly hidden
      if (Number(q.sort_order ?? 0) < 0) return false;
      const cat = getQuestCategory(q);
      if (inProgress(q)) return true;
      if (cat === "daily") {
        if (dailyShown < dailyLimit) { dailyShown++; return true; }
        return false;
      }
      if (cat === "weekly") {
        if (weeklyShown < weeklyLimit) { weeklyShown++; return true; }
        return false;
      }
      return true; // event / other: show all
    });
  }

  return quests;
}

function renderQuests() {
  const list = $("#quest-list");
  const nav = $("#quest-category-nav");
  if (!list) return;
  list.innerHTML = "";
  if (nav) nav.innerHTML = "";
  renderMultiplierBanner();

  const quests = getVisibleQuests();
  const questStates = state.progress.quest_states || {};
  const completedIds = state.progress.completed_quest_ids || [];
  const claimedBonuses = state.progress.claimed_category_bonuses || [];

  // In database tab, show all quests (including hidden ones) for admin operations.
  const isAdminDatabaseMode = state.role === "admin" && state.activeAdminQuestTab === "database";
  const displayQuests = isAdminDatabaseMode
    ? (() => {
        const all = [...state.quests];
        all.sort((a, b) => {
          const so = Number(b.sort_order ?? 0) - Number(a.sort_order ?? 0);
          return so !== 0 ? so : String(b.published_date || "").localeCompare(String(a.published_date || ""));
        });
        return all;
      })()
    : quests;

  const grouped = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  displayQuests.forEach((q) => grouped[getQuestCategory(q)].push(q));

  const allForNav = ["all", ...CATEGORY_ORDER];
  const categoryLabel = {
    all: "全部",
    event: CATEGORY_CONFIG.event.label,
    daily: CATEGORY_CONFIG.daily.label,
    weekly: CATEGORY_CONFIG.weekly.label,
    other: CATEGORY_CONFIG.other.label,
  };
  const categoryIcon = {
    all: "📚",
    event: CATEGORY_CONFIG.event.icon,
    daily: CATEGORY_CONFIG.daily.icon,
    weekly: CATEGORY_CONFIG.weekly.icon,
    other: CATEGORY_CONFIG.other.icon,
  };

  const isUnfinished = (q) => !(completedIds.includes(q.id) || questStates[q.id] === "approved");

  if (!allForNav.includes(state.activeQuestCategory)) {
    state.activeQuestCategory = "all";
  }

  if (nav) {
    allForNav.forEach((cat) => {
      const source = cat === "all" ? displayQuests : grouped[cat];
      const remaining = source.filter(isUnfinished).length;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `quest-cat-tab${state.activeQuestCategory === cat ? " active" : ""}`;
      tab.setAttribute("data-cat-tab", cat);
      tab.innerHTML = `
        <span class="tab-icon">${categoryIcon[cat]}</span>
        <span class="tab-label">${categoryLabel[cat]}</span>
        <span class="tab-remain">${remaining}</span>
      `;
      nav.appendChild(tab);
    });
  }

  const activeCategory = state.activeQuestCategory || "all";
  const activeQuests = activeCategory === "all" ? displayQuests : grouped[activeCategory] || [];

  if (!activeQuests.length) {
    list.innerHTML = '<div class="muted">此分類目前沒有任務。</div>';
    return;
  }

  // Compute which quest IDs are visible in the user-facing capped pool.
  const userVisibleIds = new Set();
  if (state.role === "admin") {
    const dailyLimit = Number(state.refreshSettings.daily_count ?? 5);
    const weeklyLimit = Number(state.refreshSettings.weekly_count ?? 10);
    let dc = 0;
    let wc = 0;
    for (const q of quests) {
      if (Number(q.sort_order ?? 0) < 0) continue;
      const cat = getQuestCategory(q);
      if (cat === "daily") {
        if (dc < dailyLimit) {
          userVisibleIds.add(q.id);
          dc++;
        }
      } else if (cat === "weekly") {
        if (wc < weeklyLimit) {
          userVisibleIds.add(q.id);
          wc++;
        }
      } else {
        userVisibleIds.add(q.id);
      }
    }
  }

  activeQuests.forEach((q) => {
    const questState = questStates[q.id] || "";
    const completed = completedIds.includes(q.id) || questState === "approved";
    const dueDate = q.due_date || q.published_date || "";
    const deadlineText = getDeadlineText(dueDate);
    const cat = getQuestCategory(q);
    const catLabel = CATEGORY_CONFIG[cat]?.label || "其他任務";
    const questStatusText = { accepted: "已承接", submitted: "待審核", approved: "已完成", rejected: "已退回" };

    let actions = "";
    let selectHtml = "";
    let visibleBadge = "";
    if (state.role === "admin") {
      selectHtml = `<label class="quest-select-wrap"><input type="checkbox" data-select-quest="${q.id}" ${state.selectedQuestIds[q.id] ? "checked" : ""}> 勾選</label>`;
      if (isAdminDatabaseMode) {
        const isVisible = userVisibleIds.has(q.id);
        const promoteBtn = !isVisible
          ? `<button class="btn-wood btn-sm btn-accent" data-promote-quest="${q.id}" type="button">⬆ 加入清單</button>`
          : `<button class="btn-wood btn-sm" data-demote-quest="${q.id}" type="button">⬇ 移出清單</button>`;
        actions = `
          <div class="review-actions">
            ${promoteBtn}
            <button class="btn-wood btn-sm btn-accent" data-edit-quest="${q.id}" type="button">編輯</button>
            <button class="btn-wood btn-sm btn-brand" data-delete-quest="${q.id}" type="button">刪除</button>
          </div>
        `;
      } else {
        actions = `
          <div class="review-actions">
            <button class="btn-wood btn-sm btn-accent" data-edit-quest="${q.id}" type="button">編輯</button>
            <button class="btn-wood btn-sm btn-brand" data-delete-quest="${q.id}" type="button">刪除</button>
          </div>
        `;
      }
      visibleBadge = userVisibleIds.has(q.id)
        ? '<span class="pill pill-visible">👁 用戶可見</span>'
        : '<span class="pill pill-hidden">🙈 用戶不可見</span>';
    } else if (completed) {
      actions = '<button class="btn-ghost" disabled>已完成</button>';
    } else if (questState === "submitted") {
      actions = '<button class="btn-ghost" disabled>待審核中</button>';
    } else if (questState === "accepted" || questState === "rejected") {
      actions = `
        <div class="review-actions">
          <input type="file" data-proof-file="${q.id}" accept="image/*" />
          <button class="btn-wood btn-sm btn-accent" data-submit-proof="${q.id}" type="button">提交照片審核</button>
          <button class="btn-wood btn-sm btn-ghost" data-abandon="${q.id}" type="button">放棄任務</button>
        </div>
      `;
    } else {
      actions = `<button class="btn-round-accept" data-accept="${q.id}">⚔ 承接任務</button>`;
    }

    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <div class="item-head-main">
          <strong>${q.title}</strong>
          <span class="pill">+${q.points} 點</span>
          <span class="pill">${catLabel}</span>
          ${visibleBadge}
        </div>
      </div>
      <div class="quest-item-body">
        <div class="muted">${q.description}</div>
        <div class="muted">難度：${difficultyLabel(q.difficulty)} ｜ 發布：${q.published_date || "-"} ｜ 截止：${dueDate || "-"}</div>
        <div class="deadline-left ${deadlineText === "已截止" ? "is-overdue" : ""}">距離截止還有：${deadlineText}</div>
        ${selectHtml}
        ${questState ? `<div class="muted">狀態：<span class="pill quest-status ${questState}">${questStatusText[questState] || questState}</span></div>` : ""}
        <div>${actions}</div>
      </div>
    `;
    list.appendChild(item);
  });

  if (activeCategory !== "all") {
    const catQuests = grouped[activeCategory] || [];
    const allDone = catQuests.length > 0 && catQuests.every((q) => !isUnfinished(q));
    const bonusClaimed = claimedBonuses.includes(activeCategory);
    if (allDone) {
      const { multiplier, finalBonus } = calcCategoryBonus(catQuests);
      const banner = document.createElement("div");
      banner.className = "category-bonus-banner";
      if (bonusClaimed) {
        banner.innerHTML = `
          <div class="bonus-text">🎊 區塊全部完成！獎勵金已領取 ✓</div>
          <button class="btn-round-bonus" disabled>✓</button>
        `;
      } else {
        const questIds = catQuests.map((q) => q.id).join(",");
        banner.innerHTML = `
          <div class="bonus-text">🎊 全部完成！可領取 <strong>+${finalBonus} 獎勵金</strong>（${multiplier}x 加成）</div>
          <button class="btn-round-bonus"
            data-claim-category="${activeCategory}"
            data-bonus="${finalBonus}"
            data-quest-ids="${questIds}">領取</button>
        `;
      }
      list.appendChild(banner);
    }
  }
}

function renderRewards() {
  const list = $("#reward-list");
  list.innerHTML = "";

  if (!state.rewards.length) {
    list.innerHTML = '<div class="muted">目前還沒有獎勵，先新增一個吧。</div>';
    return;
  }

  state.rewards.forEach((r) => {
    const isAdmin = state.role === "admin";
    const claimed = state.progress.claimed_reward_ids.includes(r.id);
    const canClaim = state.progress.points >= r.cost_points;

    const card = document.createElement("article");
    card.className = `reward-card${claimed ? " is-claimed" : ""}${!canClaim && !claimed ? " no-points" : ""}`;
    const actionHtml = isAdmin
      ? `
        <div class="review-actions">
          <button class="btn-wood btn-sm btn-accent" type="button" data-edit-reward="${r.id}">編輯</button>
          <button class="btn-wood btn-sm btn-brand" type="button" data-delete-reward="${r.id}">刪除</button>
        </div>
      `
      : `
        <button class="reward-card-btn${claimed ? " btn-ghost" : canClaim ? " btn-accent" : " btn-ghost"}"
          data-claim="${r.id}" ${claimed || !canClaim ? "disabled" : ""}>
          ${claimed ? "✓ 已兌換" : canClaim ? "兌換" : "點數不足"}
        </button>
      `;
    card.innerHTML = `
      <div class="reward-card-img-wrap">
        ${r.image_path
          ? `<img class="reward-card-img" src="${r.image_path}" alt="${r.title}">`
          : `<div class="reward-card-img-placeholder">🎁</div>`}
        <span class="reward-card-cost">${r.cost_points} 點</span>
      </div>
      <div class="reward-card-body">
        <div class="reward-card-title">${r.title}</div>
        <div class="reward-card-desc">${r.description}</div>
        ${actionHtml}
      </div>
    `;
    list.appendChild(card);
  });
}

function openGachaModal(title, html) {
  const modal = $("#gacha-modal");
  const titleEl = $("#gacha-modal-title");
  const bodyEl = $("#gacha-modal-body");
  if (!modal || !titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = html;
  modal.classList.remove("is-hidden");
}

function closeGachaModal() {
  $("#gacha-modal")?.classList.add("is-hidden");
}

function getGachaChestViewData(chestKey) {
  const base = GACHA_CHESTS[chestKey];
  if (!base) return null;
  const overviewChest = state.gachaOverview?.[chestKey] || {};
  const overviewPoolByRank = {};
  (overviewChest.pool || []).forEach((item) => {
    overviewPoolByRank[String(item.rank || "")] = item;
  });
  const pool = base.pool.map((item) => {
    const ext = overviewPoolByRank[item.rank] || {};
    return {
      ...item,
      rate: Number.isFinite(Number(ext.rate)) ? Number(ext.rate) * 100 : item.rate,
      remaining: Number.isFinite(Number(ext.remaining)) ? Number(ext.remaining) : null,
    };
  });
  return {
    ...base,
    cost: Number.isFinite(Number(overviewChest.cost)) ? Number(overviewChest.cost) : base.cost,
    totalItems: Number(overviewChest.total_items || 0),
    remainingItems: Number(overviewChest.remaining_items || 0),
    configuredRtp: Number(overviewChest.configured_rtp_percent || 0),
    configuredHouseEdge: Number(overviewChest.configured_house_edge_percent || 0),
    inventoryRtp: Number(overviewChest.inventory_rtp_percent || 0),
    inventoryHouseEdge: Number(overviewChest.inventory_house_edge_percent || 0),
    pool,
  };
}

function renderGachaBoard() {
  const list = $("#gacha-list");
  if (!list) return;
  list.innerHTML = "";

  Object.keys(GACHA_CHESTS).forEach((key) => {
    const chest = getGachaChestViewData(key);
    if (!chest) return;
    const pity = Number(state.gachaPity?.[key] || 0);
    const pityLimit = Number(state.gachaPityLimits?.[key] || 10);
    const remain = Math.max(0, pityLimit - pity);
    const chestImg = chest.image || "";
    const card = document.createElement("article");
    card.className = `gacha-card gacha-${key}`;
    card.setAttribute("data-gacha-card", key);
    card.innerHTML = `
      <div class="gacha-card-visual">${chestImg ? `<img src="${chestImg}" alt="${chest.label}" class="gacha-chest-img" />` : chest.icon}</div>
      <div class="gacha-card-head">
        <strong>${chest.icon} ${chest.label}</strong>
        <span class="pill gacha-cost-pill">${chest.cost} 點</span>
      </div>
      <div class="muted">保底進度：${pity}/${pityLimit}（保底剩餘 ${remain} 抽）</div>
      <div class="review-actions">
        <button class="btn-wood btn-sm" type="button" data-gacha-prob="${key}">查看機率</button>
        <button class="btn-wood btn-sm btn-accent" type="button" data-gacha-draw="${key}">開箱抽獎</button>
        <button class="btn-wood btn-sm btn-ghost" type="button" data-gacha-reset="${key}">重製保底</button>
      </div>
    `;
    list.appendChild(card);
  });
}

async function onGachaListClick(event) {
  const probType = event.target.getAttribute("data-gacha-prob");
  const drawType = event.target.getAttribute("data-gacha-draw");
  const resetType = event.target.getAttribute("data-gacha-reset");
  if (!probType && !drawType && !resetType) return;

  if (probType) {
    const chest = getGachaChestViewData(probType);
    if (!chest) return;
    const rows = chest.pool
      .map((item) => {
        const rem = item.remaining == null ? "--" : item.remaining;
        return `<tr><td>${item.rank}</td><td>${item.points}</td><td>${item.rate}%</td><td>${rem}</td></tr>`;
      })
      .join("");
    openGachaModal(
      `${chest.label} 機率表`,
      `<div class="muted" style="margin-bottom:8px">註：每輪固定內容物數量為 銅20／銀100／金100；「剩餘數量」顯示的是該箱本輪獎池剩餘。</div><table class="gacha-prob-table"><thead><tr><th>等級</th><th>點數</th><th>機率</th><th>剩餘數量</th></tr></thead><tbody>${rows}</tbody></table>`
    );
    return;
  }

  if (resetType) {
    const ok = window.confirm("確定重製這個寶箱的保底次數嗎？");
    if (!ok) return;
    const btn = event.target.closest("button") || event.target;
    btnLoading(btn);
    try {
      const result = await api(`/api/gacha/pity/reset/${encodeURIComponent(state.userId)}`, {
        method: "POST",
        body: JSON.stringify({ chest_type: resetType }),
      });
      state.gachaPity = {
        ...state.gachaPity,
        [resetType]: Number(result.pity_after || 0),
      };
      if (result.inventory && state.gachaOverview?.[resetType]) {
        const updatedPool = (state.gachaOverview[resetType].pool || []).map((item) => ({
          ...item,
          remaining: Number(result.inventory[String(item.rank || "")] ?? item.remaining ?? 0),
        }));
        const totalItems = updatedPool.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
        state.gachaOverview[resetType] = {
          ...state.gachaOverview[resetType],
          pool: updatedPool,
          remaining_items: totalItems,
          total_items: totalItems,
        };
      }
      renderGachaBoard();
      setMessage(`${getGachaChestViewData(resetType)?.label || "寶箱"}保底與本輪獎池已重製`);
    } catch (err) {
      setMessage(err.message, true);
    } finally {
      btnRestore(btn);
    }
    return;
  }

  if (drawType) {
    const btn = event.target.closest("button") || event.target;
    const card = event.target.closest("[data-gacha-card]");
    btnLoading(btn);
    card?.classList.add("is-opening");
    try {
      openGachaModal("寶箱開啟中...", `<div class="gacha-opening"><div class="gacha-opening-stars"></div><div class="gacha-opening-text">${getGachaChestViewData(drawType)?.label || "寶箱"} 正在解鎖中</div></div>`);
      const result = await api(`/api/gacha/draw/${encodeURIComponent(state.userId)}`, {
        method: "POST",
        body: JSON.stringify({ chest_type: drawType }),
      });
      await new Promise((resolve) => setTimeout(resolve, 700));
      state.progress.points = Number(result.points || state.progress.points || 0);
      state.gachaPity = {
        ...state.gachaPity,
        [drawType]: Number(result.pity_after || 0),
      };
      state.gachaPityLimits = {
        ...state.gachaPityLimits,
        [drawType]: Number(result.pity_limit || state.gachaPityLimits?.[drawType] || 10),
      };
      if (result.inventory && state.gachaOverview?.[drawType]) {
        const updatedPool = (state.gachaOverview[drawType].pool || []).map((item) => ({
          ...item,
          remaining: Number(result.inventory[String(item.rank || "")] ?? item.remaining ?? 0),
        }));
        state.gachaOverview[drawType] = {
          ...state.gachaOverview[drawType],
          pool: updatedPool,
          inventory_rtp_percent: state.gachaOverview[drawType].inventory_rtp_percent,
        };
      }
      renderStats();
      renderGachaBoard();
      const reward = result.reward || { rank: "B", points: 0 };
      const guaranteedHtml = result.guaranteed ? '<div class="gacha-result-guaranteed">保底觸發！</div>' : "";
      openGachaModal(
        `${GACHA_CHESTS[drawType]?.label || "寶箱"} 抽獎結果`,
        `<div class="gacha-result-wrap"><div class="gacha-result-rank">${reward.rank}</div><div class="gacha-result-points">獲得 ${reward.points} 點</div>${guaranteedHtml}<div class="muted">目前保底：${result.pity_after || 0}/${state.gachaPityLimits?.[drawType] || result.pity_limit || 10}</div><div class="muted">本次後該箱剩餘獎池已更新</div></div>`
      );
      setMessage(`抽獎成功！獲得 ${reward.rank}（+${reward.points} 點）`);
    } catch (err) {
      closeGachaModal();
      setMessage(err.message, true);
    } finally {
      card?.classList.remove("is-opening");
      btnRestore(btn);
    }
  }
}

function renderAnnouncements() {
  const board = $("#announcements-board");
  const list = $("#announcement-list");
  if (!board || !list) return;

  list.innerHTML = "";
  if (!state.announcements.length) {
    list.innerHTML = '<div class="muted">目前還沒有公告。</div>';
    return;
  }

  state.announcements.forEach((ann) => {
    const item = document.createElement("div");
    item.className = `announcement-item ${ann.ann_type || "system"}`;
    const delBtn = state.role === "admin"
      ? `<button class="ann-delete-btn" data-delete-announcement="${ann.id}" type="button" aria-label="刪除公告">✖</button>`
      : "";
    item.innerHTML = `
      <div class="ann-head">
        <span class="ann-type-badge ${ann.ann_type || "system"}">${ann.ann_type === "event" ? "🎉 活動" : "📢 系統"}</span>
        <strong class="ann-title">${ann.title}</strong>
        ${delBtn}
      </div>
      <div class="ann-content">${ann.content}</div>
      ${ann.event_time ? `<div class="ann-event-time">⏰ ${ann.event_time}</div>` : ""}
    `;
    list.appendChild(item);
  });
}

async function createAnnouncement(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const payload = {
      title: $("#ann-title").value.trim(),
      content: $("#ann-content").value.trim(),
      ann_type: $("#ann-type").value,
      event_time: $("#ann-event-time").value.trim(),
    };
    await api("/api/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    event.target.reset();
    setMessage("公告發布成功");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    throw err;
  }
}

async function createGiftboxMail(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const payload = {
      user_id: $("#g-user-id").value.trim(),
      title: $("#g-title").value.trim(),
      content: $("#g-content").value.trim(),
      points: Number($("#g-points").value) || 0,
    };
    await api("/api/giftbox/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    event.target.reset();
    $("#g-user-id").value = DEFAULT_USER_ID;
    setMessage("點數信件發送成功");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    throw err;
  }
}

async function onGiftboxListClick(event) {
  const mailId = event.target.getAttribute("data-mail-claim");
  if (!mailId) return;

  const btn = event.target.closest("button") || event.target;
  btnLoading(btn);
  try {
    await api(`/api/giftbox/${encodeURIComponent(state.userId)}/${mailId}/claim`, { method: "POST" });
    setMessage("點數領取成功");
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
    return;
  }
  await refreshAll();
}

async function onGiftboxToolbarClick(event) {
  const claimAllBtn = event.target.closest("#giftbox-claim-all-btn");
  const readAllBtn = event.target.closest("#giftbox-read-all-btn");
  const deleteReadBtn = event.target.closest("#giftbox-delete-read-btn");

  if (claimAllBtn) {
    btnLoading(claimAllBtn);
    try {
      const result = await api(`/api/giftbox/${encodeURIComponent(state.userId)}/claim-all`, { method: "POST" });
      setMessage(result.message || "點數已全部領取");
    } catch (err) {
      btnRestore(claimAllBtn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
    return;
  }

  if (readAllBtn) {
    btnLoading(readAllBtn);
    try {
      const result = await api(`/api/giftbox/${encodeURIComponent(state.userId)}/mark-all-read`, { method: "POST" });
      setMessage(result.message || "已全部標示已讀");
    } catch (err) {
      btnRestore(readAllBtn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
    return;
  }

  if (deleteReadBtn) {
    btnLoading(deleteReadBtn);
    try {
      let result = await api(`/api/giftbox/${encodeURIComponent(state.userId)}/delete-read`, {
        method: "POST",
        body: JSON.stringify({ force: false }),
      });
      if (result.ok === false && result.needs_confirm) {
        const confirmed = await showConfirmModal(result.message || "尚有附件未領取，確定刪除？");
        if (!confirmed) {
          btnRestore(deleteReadBtn);
          return;
        }
        result = await api(`/api/giftbox/${encodeURIComponent(state.userId)}/delete-read`, {
          method: "POST",
          body: JSON.stringify({ force: true }),
        });
      }
      setMessage(result.message || "已刪除已讀信件");
    } catch (err) {
      btnRestore(deleteReadBtn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
  }
}

function renderClaims() {
  const list = $("#claim-list");
  if (!list) return;

  list.innerHTML = "";
  if (state.role !== "admin") {
    return;
  }

  if (!state.claims.length) {
    list.innerHTML = '<div class="muted">目前還沒有任何兌換紀錄。</div>';
    return;
  }

  const statusText = {
    claimed: "待送出",
    delivered: "已送達",
    completed: "完成",
  };

  state.claims.forEach((claim) => {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <strong>${claim.title || "未命名獎勵"}</strong>
        <span class="pill claim-status ${claim.status || "claimed"}">${statusText[claim.status] || "待送出"}</span>
      </div>
      <div class="muted">使用者：${claim.user_id || "unknown"}</div>
      <div class="muted">消耗點數：${claim.cost_points || 0}</div>
      ${claim.image_path ? `<img class="reward-preview" src="${claim.image_path}" alt="${claim.title || "reward"}">` : ""}
      <div class="claim-actions">
        <button class="btn-wood btn-sm btn-accent" data-claim-status="delivered" data-user-id="${claim.user_id}" data-reward-id="${claim.reward_id}" ${claim.status === "delivered" || claim.status === "completed" ? "disabled" : ""}>標記已送達</button>
        <button class="btn-wood btn-sm btn-brand" data-claim-status="completed" data-user-id="${claim.user_id}" data-reward-id="${claim.reward_id}" ${claim.status === "completed" ? "disabled" : ""}>標記完成</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderPlayerClaimHistory() {
  const list = $("#player-claim-history-list");
  if (!list) return;

  list.innerHTML = "";
  if (!state.playerClaims.length) {
    list.innerHTML = '<div class="muted">目前還沒有兌換紀錄。</div>';
    return;
  }

  const statusText = {
    claimed: "已兌換",
    delivered: "已送達",
    completed: "已送達",
  };

  state.playerClaims.forEach((claim) => {
    const status = claim.status || "claimed";
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <strong>${claim.title || "未命名獎勵"}</strong>
        <span class="pill claim-status ${status}">${statusText[status] || "已兌換"}</span>
      </div>
      <div class="claim-progress-track">
        <span class="claim-progress-step ${status === "claimed" || status === "delivered" || status === "completed" ? "done" : ""}">已兌換</span>
        <span class="claim-progress-step ${status === "claimed" ? "active" : status === "delivered" || status === "completed" ? "done" : ""}">準備中</span>
        <span class="claim-progress-step ${status === "delivered" || status === "completed" ? "done" : ""}">已送達</span>
      </div>
      <div class="muted">消耗點數：${claim.cost_points || 0}</div>
      ${claim.image_path ? `<img class="reward-preview" src="${claim.image_path}" alt="${claim.title || "reward"}">` : ""}
    `;
    list.appendChild(item);
  });
}

function renderSubmissions() {
  const list = $("#submission-list");
  const pendingCountEl = $("#submission-pending-count");
  if (!list) return;

  list.innerHTML = "";
  if (state.role !== "admin") {
    if (pendingCountEl) pendingCountEl.textContent = "0";
    return;
  }

  const pendingCount = state.submissions.filter((s) => (s.status || "submitted") === "submitted").length;
  if (pendingCountEl) pendingCountEl.textContent = String(pendingCount);

  if (!state.submissions.length) {
    list.innerHTML = '<div class="muted">目前沒有待審核任務。</div>';
    return;
  }

  const statusText = {
    submitted: "待審核",
    rejected: "已退回",
    approved: "已通過",
  };

  state.submissions.forEach((s) => {
    const expanded = !!state.expandedSubmissionIds[s.id];
    const item = document.createElement("article");
    item.className = "item";
    const proofHtml = s.proof_image_path
      ? `<div class="proof-img-wrap">
           <img class="proof-thumb" src="${s.proof_image_path}" alt="proof" data-lightbox="${s.proof_image_path}">
           <div class="proof-img-actions">
             <button class="btn-wood btn-sm" type="button" data-lightbox="${s.proof_image_path}">🔍 放大</button>
             <a class="btn-wood btn-sm btn-accent proof-dl" href="${s.proof_image_path}" download>⬇ 下載</a>
           </div>
         </div>`
      : "";
    item.innerHTML = `
      <button class="item-head submission-row-head" type="button" data-toggle-submission="${s.id}" aria-expanded="${expanded}">
        <strong>${s.title || "未命名任務"}</strong>
        <span class="pill quest-status ${s.status || "submitted"}">${statusText[s.status] || "待審核"}</span>
        <span class="cat-toggle-arrow">${expanded ? "▾" : "▸"}</span>
      </button>
      <div class="submission-row-body ${expanded ? "" : "is-hidden"}">
        <div class="muted">使用者：${s.user_id || "unknown"}</div>
        <div class="muted">可得點數：${s.points || 0}</div>
        ${proofHtml}
        <div class="review-actions">
          <button class="btn-wood btn-sm btn-accent" data-review="approve" data-user-id="${s.user_id}" data-quest-id="${s.quest_id}" ${s.status !== "submitted" ? "disabled" : ""}>審核通過</button>
          <button class="btn-wood btn-sm btn-brand" data-review="reject" data-user-id="${s.user_id}" data-quest-id="${s.quest_id}" ${s.status !== "submitted" ? "disabled" : ""}>退回重拍</button>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

async function refreshAll() {
  showGlobalLoading("資料載入中，請稍後...");
  try {
    state.userId = state.userId || DEFAULT_USER_ID;
    const activeJournalDate = $("#journal-date")?.value || state.dailyJournal.log_date || todayIso();

    const questsPath = state.role === "admin" ? "/api/quests?include_future=true" : "/api/quests";
    const [progress, quests, rewards, announcements, giftboxMails, playerClaims, gachaOverview] = await Promise.all([
      api(`/api/progress/${encodeURIComponent(state.userId)}`),
      api(questsPath),
      api("/api/rewards"),
      api("/api/announcements"),
      api(`/api/giftbox/${encodeURIComponent(state.userId)}`),
      api(`/api/claims/${encodeURIComponent(state.userId)}`),
      api(`/api/gacha/overview/${encodeURIComponent(state.userId)}`),
    ]);

    state.progress = progress;
    state.quests = quests;
    state.rewards = rewards;
    state.announcements = announcements;
    state.giftboxMails = giftboxMails;
    state.playerClaims = playerClaims;
    state.gachaPity = {
      bronze: Number(gachaOverview?.pity?.bronze || 0),
      silver: Number(gachaOverview?.pity?.silver || 0),
      gold: Number(gachaOverview?.pity?.gold || 0),
    };
    state.gachaPityLimits = {
      bronze: Number(gachaOverview?.pity_limits?.bronze || 10),
      silver: Number(gachaOverview?.pity_limits?.silver || 20),
      gold: Number(gachaOverview?.pity_limits?.gold || 30),
    };
    state.gachaOverview = gachaOverview?.chests || {};

    if (state.role === "admin") {
      const [claims, submissions, templates, settings, deleted, giftHistory, eventSchedules] = await Promise.all([
        api("/api/claims"),
        api("/api/quest-submissions"),
        api("/api/quest-templates"),
        api("/api/quest-refresh-settings"),
        api("/api/quests/deleted-recent"),
        api("/api/giftbox-history"),
        api("/api/event-schedules"),
      ]);
      state.claims = claims;
      state.submissions = submissions;
      state.questTemplates = templates;
      state.refreshSettings = settings;
      state.deletedQuests = deleted;
      state.giftboxHistory = giftHistory;
      state.eventSchedules = Array.isArray(eventSchedules) ? eventSchedules : [];

      // admin fetches all wishes
      const allWishes = await api("/api/wishes");
      state.wishes = Array.isArray(allWishes) ? allWishes : [];

      const userIds = new Set();
      userIds.add(DEFAULT_USER_ID);
      claims.forEach((c) => c?.user_id && userIds.add(String(c.user_id)));
      submissions.forEach((s) => s?.user_id && userIds.add(String(s.user_id)));
      giftHistory.forEach((h) => h?.user_id && userIds.add(String(h.user_id)));

      const pointsRows = await Promise.all(
        Array.from(userIds).map(async (userId) => {
          const progressItem = await api(`/api/progress/${encodeURIComponent(userId)}`);
          return {
            user_id: userId,
            points: Number(progressItem.points || 0),
            completed_count: Number(progressItem.completed_count || 0),
            claimed_count: Number(progressItem.claimed_count || 0),
          };
        })
      );
      pointsRows.sort((a, b) => b.points - a.points || a.user_id.localeCompare(b.user_id));
      state.userPointsSummary = pointsRows;

      if ($("#refresh-daily-count")) $("#refresh-daily-count").value = String(settings.daily_count ?? 5);
      if ($("#refresh-weekly-count")) $("#refresh-weekly-count").value = String(settings.weekly_count ?? 10);
    } else {
      state.claims = [];
      state.submissions = [];
      state.questTemplates = [];
      state.deletedQuests = [];
      state.giftboxHistory = [];
      state.userPointsSummary = [];
    state.eventSchedules = [];
    state.wishes = [];
      state.wishes = [];
      // user fetches own wishes
      try {
        const myWishes = await api(`/api/wishes?user_id=${encodeURIComponent(state.userId)}`);
        state.wishes = Array.isArray(myWishes) ? myWishes : [];
      } catch { state.wishes = []; }
    }

    renderStats();
    renderQuests();
    renderRewards();
    renderGachaBoard();
    renderClaims();
    renderPlayerClaimHistory();
    renderMallNav();
    renderSubmissions();
    renderAnnouncements();
    renderGiftbox();
    renderGiftboxBadge();
    renderTemplateList();
    renderDeletedQuests();
    renderGiftHistory();
    renderAdminUserPoints();
    renderEventSchedules();
    renderWishes();
    renderAdminQuestNav();
    applyAdminQuestTabVisibility();
    await loadDailyJournalByDate(activeJournalDate);
    await loadJournalHistory();
  } finally {
    restoreAllLoadingButtons();
    hideGlobalLoading();
  }
}

function onMallNavClick(event) {
  const tab = event.target.closest("[data-mall-tab]")?.getAttribute("data-mall-tab");
  if (!tab) return;
  state.activeMallTab = tab;
  renderMallNav();
}

function onAdminQuestNavClick(event) {
  const tabBtn = event.target?.closest ? event.target.closest("[data-admin-quest-tab]") : null;
  const tab = tabBtn?.getAttribute("data-admin-quest-tab");
  if (!tab) return;
  event.preventDefault?.();
  state.activeAdminQuestTab = tab;
  renderAdminQuestNav();
  applyAdminQuestTabVisibility();

  if (tab === "journal") {
    const journalDate = $("#journal-date")?.value || todayIso();
    loadDailyJournalByDate(journalDate);
    loadJournalHistory();
  }

  const targetId = tab === "create"
    ? "admin-quest-form-panel"
    : tab === "review"
      ? "admin-review-board"
      : tab === "journal"
        ? "daily-journal-board"
      : tab === "database"
        ? "admin-template-board"
        : "quest-list-board";
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetQuestForm() {
  $("#quest-form").reset();
  if ($("#q-due-date")) $("#q-due-date").value = "";
  if ($("#q-category")) $("#q-category").value = "daily";
  onQuestCategoryChange();
  state.editingQuestId = null;
  const submitBtn = $("#quest-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = "＋ 建立任務";
    submitBtn.classList.remove("btn-accent");
    submitBtn.classList.add("btn-brand");
  }
}

async function createQuest(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const payload = {
      title: $("#q-title").value.trim(),
      description: $("#q-description").value.trim(),
      points: Number($("#q-points").value),
      difficulty: $("#q-difficulty").value,
      category: $("#q-category").value,
      published_date: $("#q-published-date").value,
      due_date: $("#q-due-date").value,
    };

    if (state.editingQuestId) {
      await api(`/api/quests/${state.editingQuestId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMessage("任務更新成功");
    } else {
      await api("/api/quests", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage("任務新增成功");
    }

    resetQuestForm();
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    throw err;
  }
}

async function createReward(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    let imagePath = "";
    if (state.editingRewardId) {
      const current = state.rewards.find((r) => r.id === state.editingRewardId);
      imagePath = current?.image_path || "";
    }
    const imageFile = $("#r-image-file").files?.[0];
    if (imageFile) {
      const formData = new FormData();
      formData.append("file", imageFile);
      const uploaded = await apiForm("/api/uploads/reward-image", formData);
      imagePath = uploaded.image_path;
    }

    const payload = {
      title: $("#r-title").value.trim(),
      description: $("#r-description").value.trim(),
      cost_points: Number($("#r-cost").value),
      image_path: imagePath,
    };

    if (state.editingRewardId) {
      await api(`/api/rewards/${state.editingRewardId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMessage("獎勵更新成功");
    } else {
      await api("/api/rewards", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage("獎勵新增成功");
    }

    resetRewardForm();
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    throw err;
  }
}

function resetRewardForm() {
  const form = $("#reward-form");
  form?.reset();
  state.editingRewardId = null;
  const submitBtn = form?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = "＋ 建立獎勵";
    submitBtn.classList.remove("btn-brand");
    submitBtn.classList.add("btn-accent");
  }
}

function btnLoading(btn) {
  if (!btn) return;
  btn.dataset.origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span>';
}

function btnRestore(btn) {
  if (!btn || !btn.dataset.origText) return;
  btn.innerHTML = btn.dataset.origText;
  btn.disabled = false;
  delete btn.dataset.origText;
}

function restoreAllLoadingButtons() {
  document.querySelectorAll("button[data-orig-text]").forEach((btn) => {
    btnRestore(btn);
  });
}

async function onListClick(event) {
  const tabBtn = event.target.closest("[data-cat-tab]");
  if (tabBtn) {
    const cat = tabBtn.getAttribute("data-cat-tab") || "all";
    state.activeQuestCategory = cat;
    renderQuests();
    return;
  }

  const acceptId = event.target.getAttribute("data-accept");
  const selectQuestId = event.target.getAttribute("data-select-quest");
  const abandonId = event.target.getAttribute("data-abandon");
  const submitProofId = event.target.getAttribute("data-submit-proof");
  const claimId = event.target.getAttribute("data-claim");
  const editRewardId = event.target.getAttribute("data-edit-reward");
  const deleteRewardId = event.target.getAttribute("data-delete-reward");
  const editQuestId = event.target.getAttribute("data-edit-quest");
  const deleteQuestId = event.target.getAttribute("data-delete-quest");
  const claimCategoryBtn = event.target.closest("[data-claim-category]");

  if (selectQuestId) {
    state.selectedQuestIds[selectQuestId] = !!event.target.checked;
    return;
  }

  try {
    if (claimCategoryBtn) {
      const category = claimCategoryBtn.getAttribute("data-claim-category");
      const bonusPoints = Number(claimCategoryBtn.getAttribute("data-bonus"));
      const questIds = claimCategoryBtn.getAttribute("data-quest-ids").split(",").filter(Boolean);
      btnLoading(claimCategoryBtn);
      await api(`/api/category-bonus/${encodeURIComponent(category)}/${encodeURIComponent(state.userId)}`, {
        method: "POST",
        body: JSON.stringify({ quest_ids: questIds, bonus_points: bonusPoints }),
      });
      setMessage(`🎊 區塊獎勵領取成功！獲得 +${bonusPoints} 點`);
      await refreshAll();
      return;
    }
  } catch (err) {
    btnRestore(claimCategoryBtn);
    setMessage(err.message, true);
    return;
  }

  const btn = event.target.closest("button") || event.target;

  if (acceptId) {
    btnLoading(btn);
    try {
      await api(`/api/quests/${acceptId}/accept/${encodeURIComponent(state.userId)}`, { method: "POST" });
      setMessage("任務承接成功");
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
  }

  if (abandonId) {
    btnLoading(btn);
    try {
      await api(`/api/quests/${abandonId}/abandon/${encodeURIComponent(state.userId)}`, { method: "POST" });
      setMessage("已放棄任務");
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
  }

  if (submitProofId) {
    const fileInput = event.target.closest(".item")?.querySelector(`input[data-proof-file="${submitProofId}"]`);
    const imageFile = fileInput?.files?.[0];
    if (!imageFile) {
      setMessage("請先選擇完成照片", true);
      return;
    }
    btnLoading(btn);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const uploaded = await apiForm("/api/uploads/proof-image", formData);
      await api(`/api/quests/${submitProofId}/submit/${encodeURIComponent(state.userId)}`, {
        method: "POST",
        body: JSON.stringify({ image_path: uploaded.image_path }),
      });
      setMessage("任務已送審，等待管理員審核");
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
  }

  if (editQuestId) {
    const quest = state.quests.find((q) => q.id === editQuestId);
    if (!quest) return;
    // Switch to create tab so the form is visible
    state.activeAdminQuestTab = "create";
    applyAdminQuestTabVisibility();
    state.editingQuestId = quest.id;
    $("#q-title").value = quest.title || "";
    $("#q-description").value = quest.description || "";
    $("#q-points").value = quest.points || "";
    $("#q-difficulty").value = quest.difficulty || "easy";
    if ($("#q-category")) {
      $("#q-category").value = quest.category || "other";
      onQuestCategoryChange();
    }
    $("#q-published-date").value = quest.published_date || "";
    $("#q-due-date").value = quest.due_date || "";
    const submitBtn = $("#quest-submit-btn");
    if (submitBtn) {
      submitBtn.textContent = "✔ 更新任務";
      submitBtn.classList.remove("btn-brand");
      submitBtn.classList.add("btn-accent");
    }
    $("#q-title").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (deleteQuestId) {
    const ok = window.confirm("確定要刪除這個任務嗎？");
    if (!ok) return;
    btnLoading(btn);
    try {
      await api(`/api/quests/${deleteQuestId}`, { method: "DELETE" });
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    if (state.editingQuestId === deleteQuestId) resetQuestForm();
    setMessage("任務已刪除");
    await refreshAll();
  }

  const promoteQuestId = event.target.getAttribute("data-promote-quest");
  if (promoteQuestId) {
    btnLoading(btn);
    try {
      const result = await api(`/api/quests/${promoteQuestId}/promote`, { method: "POST" });
      setMessage(result.message || "已加入清單");
      await refreshAll();
    } catch (err) { btnRestore(btn); setMessage(err.message, true); }
    return;
  }

  const demoteQuestId = event.target.getAttribute("data-demote-quest");
  if (demoteQuestId) {
    btnLoading(btn);
    try {
      const result = await api(`/api/quests/${demoteQuestId}/demote`, { method: "POST" });
      setMessage(result.message || "已從清單移除");
      await refreshAll();
    } catch (err) { btnRestore(btn); setMessage(err.message, true); }
    return;
  }

  const selectDeletedId = event.target.getAttribute("data-select-deleted");
  if (selectDeletedId) {
    if (event.target.checked) {
      state.selectedDeletedIds[selectDeletedId] = true;
    } else {
      delete state.selectedDeletedIds[selectDeletedId];
    }
    return;
  }

  const restoreDeletedId = event.target.getAttribute("data-restore-deleted");
  if (restoreDeletedId) {
    btnLoading(btn);
    try {
      const result = await api(`/api/quests/deleted-recent/${restoreDeletedId}/restore`, { method: "POST" });
      setMessage(result.message || "已回復");
      delete state.selectedDeletedIds[restoreDeletedId];
      state.deletedQuests = await api("/api/quests/deleted-recent");
      renderDeletedQuests();
      await refreshAll();
    } catch (err) { btnRestore(btn); setMessage(err.message, true); }
    return;
  }

  const permDeleteDeletedId = event.target.getAttribute("data-perm-delete-deleted");
  if (permDeleteDeletedId) {
    if (!window.confirm("確定要永久刪除這筆紀錄？")) return;
    btnLoading(btn);
    try {
      await api(`/api/quests/deleted-recent/${permDeleteDeletedId}`, { method: "DELETE" });
      setMessage("已永久刪除");
      delete state.selectedDeletedIds[permDeleteDeletedId];
      state.deletedQuests = await api("/api/quests/deleted-recent");
      renderDeletedQuests();
      btnRestore(btn);
    } catch (err) { btnRestore(btn); setMessage(err.message, true); }
    return;
  }

  if (claimId) {
    btnLoading(btn);
    try {
      await api(`/api/rewards/${claimId}/claim/${encodeURIComponent(state.userId)}`, { method: "POST" });
      setMessage("獎勵兌換成功");
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
  }

  if (editRewardId) {
    const reward = state.rewards.find((r) => r.id === editRewardId);
    if (!reward) return;
    state.editingRewardId = reward.id;
    $("#r-title").value = reward.title || "";
    $("#r-description").value = reward.description || "";
    $("#r-cost").value = reward.cost_points || "";
    const submitBtn = $("#reward-form")?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = "✔ 更新獎勵";
      submitBtn.classList.remove("btn-accent");
      submitBtn.classList.add("btn-brand");
    }
    $("#r-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (deleteRewardId) {
    const ok = window.confirm("確定要刪除這個獎勵嗎？");
    if (!ok) return;
    btnLoading(btn);
    try {
      await api(`/api/rewards/${deleteRewardId}`, { method: "DELETE" });
      if (state.editingRewardId === deleteRewardId) {
        resetRewardForm();
      }
      setMessage("獎勵已刪除");
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    await refreshAll();
  }
}

async function createTemplate(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const payload = {
      title: $("#t-title").value.trim(),
      description: $("#t-description").value.trim(),
      points: Number($("#t-points").value),
      difficulty: $("#t-difficulty").value,
      category: $("#t-category").value,
      due_days: Number($("#t-due-days").value || 7),
    };
    await api("/api/quest-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    event.target.reset();
    $("#t-due-days").value = "7";
    setMessage("任務資料庫新增成功");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
  }
}

async function onTemplateListClick(event) {
  const spawnId = event.target.getAttribute("data-template-spawn");
  const deleteId = event.target.getAttribute("data-template-delete");
  if (!spawnId && !deleteId) return;

  const btn = event.target.closest("button") || event.target;
  btnLoading(btn);

  if (spawnId) {
    try {
      await api(`/api/quest-templates/${spawnId}/spawn`, { method: "POST" });
      setMessage("任務已從資料庫指派到清單");
      await refreshAll();
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
    }
    return;
  }

  if (deleteId) {
    const confirmed = await showConfirmModal("刪除任務資料庫資料後，玩家清單中同來源任務也會移除，確定嗎？");
    if (!confirmed) {
      btnRestore(btn);
      return;
    }
    try {
      const result = await api(`/api/quest-templates/${deleteId}`, { method: "DELETE" });
      setMessage(result.message || "任務資料已刪除");
      await refreshAll();
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
    }
  }
}

async function onQuestAdminAction(event) {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.id === "delete-selected-quests-btn") {
    const ids = Object.keys(state.selectedQuestIds).filter((id) => state.selectedQuestIds[id]);
    if (!ids.length) {
      setMessage("請先勾選要刪除的任務", true);
      return;
    }
    const confirmed = await showConfirmModal(`確定刪除勾選的 ${ids.length} 筆任務嗎？`);
    if (!confirmed) return;
    btnLoading(target);
    try {
      const result = await api("/api/quests/batch-delete", {
        method: "POST",
        body: JSON.stringify({ quest_ids: ids }),
      });
      state.selectedQuestIds = {};
      setMessage(result.message || "批次刪除完成");
      await refreshAll();
    } catch (err) {
      btnRestore(target);
      setMessage(err.message, true);
    }
    return;
  }

  if (target.id === "delete-all-quests-btn") {
    const confirmed = await showConfirmModal("確定刪除目前所有任務嗎？");
    if (!confirmed) return;
    btnLoading(target);
    try {
      const result = await api("/api/quests/delete-all", { method: "POST" });
      state.selectedQuestIds = {};
      setMessage(result.message || "全部任務已刪除");
      await refreshAll();
    } catch (err) {
      btnRestore(target);
      setMessage(err.message, true);
    }
    return;
  }

  if (target.id === "save-refresh-settings-btn") {
    const daily = Number($("#refresh-daily-count").value || 0);
    const weekly = Number($("#refresh-weekly-count").value || 0);
    btnLoading(target);
    try {
      const result = await api("/api/quest-refresh-settings", {
        method: "POST",
        body: JSON.stringify({ daily_count: daily, weekly_count: weekly }),
      });
      state.refreshSettings = { daily_count: daily, weekly_count: weekly };
      setMessage(result.message || "刷新設定已更新");
      btnRestore(target);
    } catch (err) {
      btnRestore(target);
      setMessage(err.message, true);
    }
    return;
  }

  if (target.id === "refresh-from-db-btn") {
    btnLoading(target);
    try {
      const result = await api("/api/quests/refresh-from-db", { method: "POST" });
      state.selectedQuestIds = {};
      setMessage(result.message || "已刷新任務");
      await refreshAll();
    } catch (err) {
      btnRestore(target);
      setMessage(err.message, true);
    }
  }
}

async function onSubmissionListClick(event) {
  const toggleId = event.target.closest("[data-toggle-submission]")?.getAttribute("data-toggle-submission");
  if (toggleId && !event.target.closest("[data-review]")) {
    state.expandedSubmissionIds[toggleId] = !state.expandedSubmissionIds[toggleId];
    renderSubmissions();
    return;
  }

  const action = event.target.getAttribute("data-review");
  const userId = event.target.getAttribute("data-user-id");
  const questId = event.target.getAttribute("data-quest-id");
  if (!action || !userId || !questId) {
    return;
  }

  const btn = event.target.closest("button") || event.target;
  btnLoading(btn);
  try {
    const approved = action === "approve";
    await api(`/api/quest-submissions/${encodeURIComponent(userId)}/${questId}/review`, {
      method: "POST",
      body: JSON.stringify({ approved, review_note: approved ? "" : "請重新拍攝更清楚的完成照片" }),
    });
    setMessage(approved ? "審核通過，已發放獎勵金" : "已退回任務，等待使用者重新提交");
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
    return;
  }
  await refreshAll();
}

async function onClaimListClick(event) {
  const status = event.target.getAttribute("data-claim-status");
  const userId = event.target.getAttribute("data-user-id");
  const rewardId = event.target.getAttribute("data-reward-id");
  if (!status || !userId || !rewardId) {
    return;
  }

  const btn = event.target.closest("button") || event.target;
  btnLoading(btn);
  try {
    await api(`/api/claims/${encodeURIComponent(userId)}/${rewardId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    setMessage(status === "completed" ? "禮物狀態已標記為完成" : "禮物狀態已標記為已送達");
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
    return;
  }
  await refreshAll();
}

function bindQuestToolbar() {
  $("#quest-sort-by").addEventListener("change", (event) => {
    state.questSortBy = event.target.value;
    renderQuests();
  });
  $("#quest-sort-order").addEventListener("change", (event) => {
    state.questSortOrder = event.target.value;
    renderQuests();
  });
  $("#quest-filter-difficulty").addEventListener("change", (event) => {
    state.questFilterDifficulty = event.target.value;
    renderQuests();
  });
}

function onQuestCategoryChange() {
  const cat = $("#q-category")?.value;
  const dateFields = $("#q-date-fields");
  if (!dateFields) return;
  const showDates = cat === "event" || cat === "other";
  dateFields.classList.toggle("is-hidden", !showDates);
  if (!showDates) {
    if ($("#q-published-date")) $("#q-published-date").value = "";
    if ($("#q-due-date")) $("#q-due-date").value = "";
  }
}

function renderEventAdminNav() {
  const nav = $("#event-admin-nav");
  if (!nav) return;
  const tabs = nav.querySelectorAll("[data-event-admin-tab]");
  const allowed = new Set(["create", "preview", "list"]);
  if (!allowed.has(state.activeEventAdminTab)) {
    state.activeEventAdminTab = "create";
  }
  tabs.forEach((btn) => {
    const tab = btn.getAttribute("data-event-admin-tab");
    btn.classList.toggle("active", tab === state.activeEventAdminTab);
  });
}

function applyEventAdminTabVisibility() {
  const createBoard = $("#event-create-board");
  const previewBoard = $("#event-preview-board");
  const listBoard = $("#event-list-board");
  if (!createBoard || !previewBoard || !listBoard) return;

  createBoard.classList.toggle("is-hidden", state.activeEventAdminTab !== "create");
  previewBoard.classList.toggle("is-hidden", state.activeEventAdminTab !== "preview");
  listBoard.classList.toggle("is-hidden", state.activeEventAdminTab !== "list");
}

function onEventAdminNavClick(event) {
  const tab = event.target.closest("[data-event-admin-tab]")?.getAttribute("data-event-admin-tab");
  if (!tab) return;
  state.activeEventAdminTab = tab;
  renderEventAdminNav();
  applyEventAdminTabVisibility();
}

async function onQuestXlsxUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const statusEl = $("#quest-xlsx-status");
  if (statusEl) statusEl.textContent = "匯入中...";
  const formData = new FormData();
  formData.append("file", file);
  try {
    const result = await fetch("/api/quests/import-xlsx", { method: "POST", body: formData })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail?.message || "匯入失敗");
        return json;
      });
    if (statusEl) statusEl.textContent = result.message || "匯入完成";
    setMessage(result.message || "匯入完成");
    if (result.errors?.length) setMessage(result.message, true);
    await refreshAll();
  } catch (err) {
    if (statusEl) statusEl.textContent = "匯入失敗";
    setMessage(err.message, true);
  }
  event.target.value = "";
}

async function onEventXlsxUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const statusEl = $("#event-xlsx-status");
  if (statusEl) statusEl.textContent = "匯入中...";
  const formData = new FormData();
  formData.append("file", file);
  try {
    const result = await fetch("/api/event-schedules/import-xlsx", { method: "POST", body: formData })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail?.message || "匯入失敗");
        return json;
      });
    state.importedEventQuests = Array.isArray(result.imported_quests) ? result.imported_quests : [];
    renderImportedEventQuestPreview();
    state.activeEventAdminTab = "preview";
    renderEventAdminNav();
    applyEventAdminTabVisibility();
    const msg = result.message || `活動任務已匯入：${result.quests_created || 0} 筆（不會自動發布活動）`;
    if (statusEl) statusEl.textContent = msg;
    if (result.errors?.length && statusEl) {
      const sample = result.errors.slice(0, 2).join("；");
      statusEl.textContent = `${msg} ｜ ${sample}${result.errors.length > 2 ? " …" : ""}`;
    }
    setMessage(msg, !!(result.errors?.length));
    await refreshAll();
  } catch (err) {
    if (statusEl) statusEl.textContent = "匯入失敗";
    setMessage(err.message, true);
  }
  event.target.value = "";
}

function renderImportedEventQuestPreview() {
  const list = $("#event-import-preview-list");
  const countEl = $("#event-import-preview-count");
  if (!list) return;

  const tasks = state.importedEventQuests || [];
  if (countEl) countEl.textContent = String(tasks.length);
  list.innerHTML = "";
  if (!tasks.length) {
    list.innerHTML = '<div class="muted">目前沒有本次匯入任務，請先於「新增活動排程」頁匯入 xlsx。</div>';
    return;
  }

  tasks.forEach((q) => {
    const row = document.createElement("article");
    row.className = "item";
    row.setAttribute("data-imported-event-quest-id", q.id || "");
    row.innerHTML = `
      <div class="item-head">
        <strong>任務 ID：${q.id || "-"}</strong>
        <span class="pill">活動任務</span>
      </div>
      <div class="quest-toolbar">
        <label class="field-label">任務名稱
          <input data-event-import-field="title" value="${q.title || ""}" maxlength="80" />
        </label>
        <label class="field-label">點數
          <input data-event-import-field="points" type="number" min="1" max="999" value="${Number(q.points || 1)}" />
        </label>
        <label class="field-label">難度
          <select data-event-import-field="difficulty">
            <option value="easy" ${q.difficulty === "easy" ? "selected" : ""}>簡單</option>
            <option value="medium" ${q.difficulty === "medium" ? "selected" : ""}>普通</option>
            <option value="hard" ${q.difficulty === "hard" ? "selected" : ""}>困難</option>
          </select>
        </label>
      </div>
      <label class="field-label">任務描述
        <textarea data-event-import-field="description" maxlength="240">${q.description || ""}</textarea>
      </label>
      <div class="quest-toolbar">
        <label class="field-label">發布日期（可空）
          <input data-event-import-field="published_date" type="date" value="${q.published_date || ""}" />
        </label>
        <label class="field-label">截止日期（可空）
          <input data-event-import-field="due_date" type="date" value="${q.due_date || ""}" />
        </label>
      </div>
      <div class="review-actions">
        <button class="btn-wood btn-sm btn-accent" type="button" data-save-imported-event-quest="${q.id}">💾 儲存這筆</button>
        <button class="btn-wood btn-sm btn-brand" type="button" data-delete-imported-event-quest="${q.id}">🗑 刪除這筆</button>
      </div>
    `;
    list.appendChild(row);
  });
}

async function onImportedEventPreviewClick(event) {
  const saveId = event.target.getAttribute("data-save-imported-event-quest");
  const deleteId = event.target.getAttribute("data-delete-imported-event-quest");
  if (!saveId && !deleteId) return;

  const btn = event.target.closest("button") || event.target;
  const row = event.target.closest("[data-imported-event-quest-id]");
  if (!row) return;

  if (saveId) {
    const title = row.querySelector('[data-event-import-field="title"]')?.value?.trim() || "";
    const description = row.querySelector('[data-event-import-field="description"]')?.value?.trim() || "";
    const points = Number(row.querySelector('[data-event-import-field="points"]')?.value || 0);
    const difficulty = row.querySelector('[data-event-import-field="difficulty"]')?.value || "easy";
    const published_date = row.querySelector('[data-event-import-field="published_date"]')?.value || "";
    const due_date = row.querySelector('[data-event-import-field="due_date"]')?.value || "";

    if (!title) {
      setMessage("任務名稱不可為空", true);
      return;
    }
    if (!description) {
      setMessage("任務描述不可為空", true);
      return;
    }
    if (!(points >= 1 && points <= 999)) {
      setMessage("點數需在 1 到 999 之間", true);
      return;
    }

    btnLoading(btn);
    try {
      await api(`/api/quests/${saveId}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          description,
          points,
          difficulty,
          category: "event",
          published_date,
          due_date,
        }),
      });
      state.importedEventQuests = state.importedEventQuests.map((q) =>
        q.id === saveId
          ? { ...q, title, description, points, difficulty, published_date, due_date, category: "event" }
          : q
      );
      setMessage("匯入任務已更新");
      btnRestore(btn);
      await refreshAll();
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
    }
    return;
  }

  if (deleteId) {
    const confirmed = await showConfirmModal("確定刪除這筆匯入任務？");
    if (!confirmed) return;
    btnLoading(btn);
    try {
      await api(`/api/quests/${deleteId}`, { method: "DELETE" });
      state.importedEventQuests = state.importedEventQuests.filter((q) => q.id !== deleteId);
      renderImportedEventQuestPreview();
      setMessage("匯入任務已刪除");
      btnRestore(btn);
      await refreshAll();
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
    }
  }
}

function renderEventSchedules() {
  const list = $("#event-schedule-list");
  if (!list) return;
  list.innerHTML = "";
  if (!state.eventSchedules.length) {
    list.innerHTML = '<div class="muted">目前沒有活動排程。</div>';
    return;
  }
  state.eventSchedules.forEach((ev) => {
    const item = document.createElement("article");
    item.className = "item";
    const mult = Number(ev.point_multiplier || 1);
    const multHtml = mult > 1 ? `<span class="pill">點數 x${mult}</span>` : "";
    item.innerHTML = `
      <div class="item-head">
        <strong>${ev.title || "未命名活動"}</strong>
        <span class="pill">${ev.start_date || "-"} ～ ${ev.end_date || "-"}</span>
        ${multHtml}
      </div>
      <div class="muted">${ev.description || ""}</div>
      <div class="review-actions">
        <button class="btn-wood btn-sm btn-brand" type="button" data-delete-event="${ev.id}">刪除活動</button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function createEventSchedule(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const payload = {
      title: $("#ev-title").value.trim(),
      description: $("#ev-description").value.trim(),
      start_date: $("#ev-start-date").value,
      end_date: $("#ev-end-date").value,
      point_multiplier: Number($("#ev-multiplier").value) || 1.0,
      announcement_title: $("#ev-ann-title").value.trim(),
      announcement_content: $("#ev-ann-content").value.trim(),
      announcement_event_time: $("#ev-ann-time").value.trim(),
      auto_announce: $("#ev-auto-announce").checked,
    };
    const result = await api("/api/event-schedules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    event.target.reset();
    $("#ev-multiplier").value = "1";
    $("#ev-auto-announce").checked = true;
    state.importedEventQuests = [];
    renderImportedEventQuestPreview();
    state.activeEventAdminTab = "list";
    renderEventAdminNav();
    applyEventAdminTabVisibility();
    setMessage(result.message || "活動排程已建立");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
  }
}

async function onEventScheduleListClick(event) {
  const deleteId = event.target.getAttribute("data-delete-event");
  if (!deleteId) return;
  const btn = event.target.closest("button") || event.target;
  const confirmed = await showConfirmModal("確定刪除此活動排程嗎？");
  if (!confirmed) return;
  btnLoading(btn);
  try {
    const result = await api(`/api/event-schedules/${deleteId}`, { method: "DELETE" });
    setMessage(result.message || "活動已刪除");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
  }
}

function renderWishes() {
  const list = $("#wish-list");
  if (!list) return;
  list.innerHTML = "";
  if (!state.wishes.length) {
    list.innerHTML = '<div class="muted">還沒有許願，先投入吧！</div>';
    return;
  }
  const isAdmin = state.role === "admin";
  state.wishes.forEach((wish) => {
    const item = document.createElement("article");
    item.className = "item" + (wish.is_fulfilled ? " wish-fulfilled" : "");
    const fromHtml = isAdmin ? `<span class="pill">👤 ${wish.user_id || ""}</span>` : "";
    const statusHtml = wish.is_fulfilled
      ? '<span class="pill pill-success">✨ 已達成</span>'
      : '<span class="pill pill-dim">⌛ 待達成</span>';
    const adminActions = isAdmin
      ? `<div class="review-actions">${
          wish.is_fulfilled
            ? ""
            : `<button class="btn-wood btn-sm btn-accent" type="button" data-fulfill-wish="${wish.id}">✨ 標記達成</button>`
        }<button class="btn-wood btn-sm btn-brand" type="button" data-delete-wish="${wish.id}">🗑 刪除</button></div>`
      : "";
    const safeName = wish.item_name ? `<strong>${wish.item_name}</strong> &mdash; ` : "";
    const safeNote = wish.note ? `<div class="muted">${wish.note}</div>` : "";
    item.innerHTML = `
      <div class="item-head">
        ${fromHtml}
        ${statusHtml}
        ${safeName}<a href="${wish.url}" target="_blank" rel="noopener noreferrer" class="wish-link">🔗 查看連結</a>
      </div>
      ${safeNote}
      ${adminActions}
    `;
    list.appendChild(item);
  });
}

async function submitWish(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btnLoading(btn);
  try {
    const payload = {
      url: $("#w-url").value.trim(),
      item_name: $("#w-item-name").value.trim(),
      note: $("#w-note").value.trim(),
    };
    const result = await api(`/api/wishes?user_id=${encodeURIComponent(state.userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    event.target.reset();
    setMessage(result.message || "許願成功！");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    setMessage(err.message, true);
  }
}

async function onWishListClick(event) {
  const btn = event.target.closest("button") || event.target;
  const fulfillId = event.target.getAttribute("data-fulfill-wish");
  const deleteId = event.target.getAttribute("data-delete-wish");
  if (fulfillId) {
    const confirmed = await showConfirmModal("標記此願望為「已達成」？");
    if (!confirmed) return;
    btnLoading(btn);
    try {
      const result = await api(`/api/wishes/${fulfillId}/fulfill`, { method: "PATCH" });
      setMessage(result.message || "已標記達成");
      await refreshAll();
    } catch (err) { btnRestore(btn); setMessage(err.message, true); }
  } else if (deleteId) {
    const confirmed = await showConfirmModal("確定刪除此願望？");
    if (!confirmed) return;
    btnLoading(btn);
    try {
      const result = await api(`/api/wishes/${deleteId}`, { method: "DELETE" });
      setMessage(result.message || "已刪除");
      await refreshAll();
    } catch (err) { btnRestore(btn); setMessage(err.message, true); }
  }
}

async function boot() {
  state.userId = DEFAULT_USER_ID;
  renderPlayerName();
  if ($("#journal-date")) {
    $("#journal-date").value = todayIso();
  }

  $("#login-form").addEventListener("submit", onLogin);
  $("#quick-user-login").addEventListener("click", onQuickUserLogin);
  $("#quick-admin-login")?.addEventListener("click", onQuickAdminLogin);
  $("#logout-btn").addEventListener("click", onLogout);
  $("#nav-announce-btn").addEventListener("click", () => showView("announce"));
  $("#nav-quests-btn").addEventListener("click", () => showView("quests"));
  $("#open-mall-btn").addEventListener("click", () => showView("mall"));
  $("#nav-wish-btn")?.addEventListener("click", () => showView("wish"));
  $("#open-giftbox-btn").addEventListener("click", openGiftboxModal);
  $("#giftbox-close-btn").addEventListener("click", closeGiftboxModal);

  bindQuestToolbar();

  $("#q-category")?.addEventListener("change", onQuestCategoryChange);
  onQuestCategoryChange(); // set initial visibility

  const lastSession = localStorage.getItem(SESSION_KEY);
  if (lastSession) {
    try {
      const parsed = JSON.parse(lastSession);
      if (parsed?.role === "admin" || parsed?.role === "user") {
        const pass = parsed.role === "admin" ? ADMIN_PASSPHRASE : USER_PASSPHRASE;
        await doLogin(pass);
        setAuthMessage(`已自動登入（${parsed.role === "admin" ? "管理者" : "使用者"}）`);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  $("#refresh-btn").addEventListener("click", async () => {
    const btn = $("#refresh-btn");
    btnLoading(btn);
    try {
      await refreshAll();
      setMessage("資料已更新");
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
    }
  });

  $("#quest-form").addEventListener("submit", async (event) => {
    try {
      await createQuest(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });

  $("#reward-form").addEventListener("submit", async (event) => {
    try {
      await createReward(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });

  $("#quest-list").addEventListener("click", onListClick);
  $("#quest-category-nav").addEventListener("click", onListClick);
  $("#admin-quest-nav")?.addEventListener("click", onAdminQuestNavClick);
  $("#mall-nav")?.addEventListener("click", onMallNavClick);
  $("#reward-list").addEventListener("click", onListClick);
  $("#gacha-list")?.addEventListener("click", onGachaListClick);
  $("#gacha-modal-close")?.addEventListener("click", closeGachaModal);
  $("#gacha-modal")?.addEventListener("click", (event) => {
    if (event.target?.id === "gacha-modal") closeGachaModal();
  });
  $("#announcement-list").addEventListener("click", async (event) => {
    const delId = event.target.closest("[data-delete-announcement]")?.getAttribute("data-delete-announcement");
    if (!delId) return;
    const btn = event.target.closest("button") || event.target;
    btnLoading(btn);
    try {
      await api(`/api/announcements/${delId}`, { method: "DELETE" });
      setMessage("公告已刪除");
      await refreshAll();
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
    }
  });
  $("#announcement-form").addEventListener("submit", async (event) => {
    try {
      await createAnnouncement(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });
  $("#giftbox-send-form").addEventListener("submit", async (event) => {
    try {
      await createGiftboxMail(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });
  $("#template-form")?.addEventListener("submit", createTemplate);
  $("#template-search")?.addEventListener("input", renderTemplateList);
  $("#template-list")?.addEventListener("click", async (event) => {
    await onTemplateListClick(event);
  });
  $("#admin-quest-tools")?.addEventListener("click", async (event) => {
    await onQuestAdminAction(event);
  });
  // Bulk actions for deleted quests
  $("#deleted-quest-list")?.addEventListener("click", async (event) => {
    await onListClick(event);
  });
  $("#restore-selected-deleted-btn")?.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("button") || event.target;
    const ids = Object.keys(state.selectedDeletedIds).filter((id) => state.selectedDeletedIds[id]);
    if (!ids.length) { setMessage("請先勾選要回復的紀錄", true); return; }
    const confirmed = await showConfirmModal(`確定回復勾選的 ${ids.length} 筆任務嗎？`);
    if (!confirmed) return;
    btnLoading(actionBtn);
    try {
      for (const id of ids) await api(`/api/quests/deleted-recent/${id}/restore`, { method: "POST" });
      state.selectedDeletedIds = {};
      setMessage(`已回復 ${ids.length} 筆任務`);
      state.deletedQuests = await api("/api/quests/deleted-recent");
      renderDeletedQuests();
      btnRestore(actionBtn);
      await refreshAll();
    } catch (err) { btnRestore(actionBtn); setMessage(err.message, true); }
  });
  $("#delete-selected-deleted-btn")?.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("button") || event.target;
    const ids = Object.keys(state.selectedDeletedIds).filter((id) => state.selectedDeletedIds[id]);
    if (!ids.length) { setMessage("請先勾選要刪除的紀錄", true); return; }
    const confirmed = await showConfirmModal(`確定永久刪除勾選的 ${ids.length} 筆紀錄？此操作無法復原`);
    if (!confirmed) return;
    btnLoading(actionBtn);
    try {
      for (const id of ids) await api(`/api/quests/deleted-recent/${id}`, { method: "DELETE" });
      state.selectedDeletedIds = {};
      setMessage(`已刪除 ${ids.length} 筆紀錄`);
      state.deletedQuests = await api("/api/quests/deleted-recent");
      renderDeletedQuests();
      btnRestore(actionBtn);
    } catch (err) { btnRestore(actionBtn); setMessage(err.message, true); }
  });
  $("#delete-all-deleted-btn")?.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("button") || event.target;
    const confirmed = await showConfirmModal("確定清除所有刪除紀錄嗎？此操作無法復原");
    if (!confirmed) return;
    btnLoading(actionBtn);
    try {
      const result = await api("/api/quests/deleted-recent/all", { method: "DELETE" });
      state.selectedDeletedIds = {};
      state.deletedQuests = [];
      setMessage(result.message || "已清除全部紀錄");
      renderDeletedQuests();
      btnRestore(actionBtn);
    } catch (err) { btnRestore(actionBtn); setMessage(err.message, true); }
  });
  // Template category change: hide/show due-days for daily/weekly
  $("#t-category")?.addEventListener("change", () => {
    const cat = $("#t-category").value;
    const dueDaysField = $("#t-due-days-field");
    if (dueDaysField) dueDaysField.classList.toggle("is-hidden", cat === "daily" || cat === "weekly");
  });
  // Fire once on load to set initial state
  (function () {
    const cat = $("#t-category")?.value;
    const dueDaysField = $("#t-due-days-field");
    if (dueDaysField && cat) dueDaysField.classList.toggle("is-hidden", cat === "daily" || cat === "weekly");
  })();
  $("#g-user-id").value = DEFAULT_USER_ID;
  // Toggle event-time field visibility based on announcement type
  $("#ann-type").addEventListener("change", (e) => {
    const wrap = $("#ann-event-time-wrap");
    if (wrap) wrap.style.display = e.target.value === "event" ? "" : "none";
  });
  const annEventWrap = $("#ann-event-time-wrap");
  if (annEventWrap) annEventWrap.style.display = "none";
  $("#claim-list").addEventListener("click", async (event) => {
    try {
      await onClaimListClick(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });
  $("#submission-list").addEventListener("click", async (event) => {
    try {
      await onSubmissionListClick(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });
  $("#giftbox-list").addEventListener("click", async (event) => {
    try {
      await onGiftboxListClick(event);
    } catch (err) {
      setMessage(err.message, true);
    }
  });
  $("#giftbox-claim-all-btn").addEventListener("click", onGiftboxToolbarClick);
  $("#giftbox-read-all-btn").addEventListener("click", onGiftboxToolbarClick);
  $("#giftbox-delete-read-btn").addEventListener("click", onGiftboxToolbarClick);
  $("#journal-detail-close")?.addEventListener("click", closeDailyJournalModal);
  $("#wish-form")?.addEventListener("submit", submitWish);
  $("#wish-list")?.addEventListener("click", onWishListClick);
  $("#event-schedule-form")?.addEventListener("submit", createEventSchedule);
  $("#event-admin-nav")?.addEventListener("click", onEventAdminNavClick);
  $("#event-schedule-list")?.addEventListener("click", onEventScheduleListClick);
  $("#event-import-preview-list")?.addEventListener("click", onImportedEventPreviewClick);
  $("#quest-xlsx-upload")?.addEventListener("change", onQuestXlsxUpload);
  $("#event-xlsx-upload")?.addEventListener("change", onEventXlsxUpload);
  $("#daily-journal-form")?.addEventListener("submit", saveDailyJournal);
  $("#journal-date")?.addEventListener("change", async (event) => {
    try {
      await loadDailyJournalByDate(event.target.value || todayIso());
    } catch (err) {
      setMessage(err.message, true);
    }
  });

  renderEventAdminNav();
  applyEventAdminTabVisibility();

  // Lightbox: open on data-lightbox click, close on overlay or close button
  document.addEventListener("click", (event) => {
    const adminTabBtn = event.target.closest("[data-admin-quest-tab]");
    if (adminTabBtn) {
      onAdminQuestNavClick(event);
      return;
    }

    const src =
      event.target.getAttribute("data-lightbox") ||
      event.target.closest("[data-lightbox]")?.getAttribute("data-lightbox");
    if (src) {
      const lb = $("#img-lightbox");
      const img = $("#img-lightbox-img");
      if (lb && img) {
        img.src = src;
        lb.classList.remove("is-hidden");
      }
      return;
    }
    if (event.target.id === "img-lightbox" || event.target.id === "img-lightbox-close") {
      $("#img-lightbox")?.classList.add("is-hidden");
    }
    if (event.target.id === "giftbox-modal") {
      closeGiftboxModal();
    }
    if (event.target.id === "journal-detail-modal") {
      closeDailyJournalModal();
    }
    if (event.target.id === "journal-detail-close") {
      closeDailyJournalModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDailyJournalModal();
    }
  });
}

boot();
