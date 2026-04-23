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
  announcements: [],
  questTemplates: [],
  deletedQuests: [],
  refreshSettings: { daily_count: 3, weekly_count: 2 },
  selectedQuestIds: {},
  questSortBy: "published_date",
  questSortOrder: "desc",
  questFilterDifficulty: "all",
  activeQuestCategory: "all",
  activeMallTab: "shop",
  collapsedQuestIds: {},
  expandedSubmissionIds: {},
  editingQuestId: null,
};

const USER_PASSPHRASE = "咕咕嘎嘎";
const ADMIN_PASSPHRASE = "tim0403";
const SESSION_KEY = "love_quest_admin_session";
const DEFAULT_USER_ID = "郭芸甄";
const DEFAULT_ADMIN_ID = "admin";

const $ = (selector) => document.querySelector(selector);

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
  }

  applyMallTabVisibility();
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
  state.submissions = [];
  state.claims = [];
  state.playerClaims = [];
  state.giftboxMails = [];
  state.giftboxHistory = [];
  state.questTemplates = [];
  state.deletedQuests = [];
  state.selectedQuestIds = {};
  state.expandedSubmissionIds = {};
  state.editingQuestId = null;
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
  const navAnnounceBtn = $("#nav-announce-btn");
  const navQuestsBtn = $("#nav-quests-btn");
  const mallBtn = $("#open-mall-btn");

  [announceView, questsView, mallView].forEach((v) => v?.classList.add("is-hidden"));
  [navAnnounceBtn, navQuestsBtn, mallBtn].forEach((b) => b?.classList.remove("nav-active"));

  if (view === "announce") {
    announceView?.classList.remove("is-hidden");
    navAnnounceBtn?.classList.add("nav-active");
  } else if (view === "mall") {
    mallView?.classList.remove("is-hidden");
    mallBtn?.classList.add("nav-active");
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
  const rewardBoard = $("#mall-reward-board");
  const historyBoard = $("#player-claim-history-board");
  const isAdmin = state.role === "admin";

  if (isAdmin) {
    rewardBoard?.classList.remove("is-hidden");
    historyBoard?.classList.add("is-hidden");
    return;
  }

  if (state.activeMallTab === "history") {
    rewardBoard?.classList.add("is-hidden");
    historyBoard?.classList.remove("is-hidden");
  } else {
    rewardBoard?.classList.remove("is-hidden");
    historyBoard?.classList.add("is-hidden");
  }
}

function renderMallNav() {
  const nav = $("#mall-nav");
  if (!nav) return;

  nav.innerHTML = "";
  const tabs = [
    { key: "shop", label: "獎勵商城", icon: "🎁", count: state.rewards.length },
    { key: "history", label: "兌換歷史", icon: "🧾", count: state.playerClaims.length },
  ].filter((tab) => (state.role === "admin" ? tab.key === "shop" : true));

  if (state.role === "admin") {
    state.activeMallTab = "shop";
  }

  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `quest-cat-tab${state.activeMallTab === tab.key ? " active" : ""}`;
    btn.setAttribute("data-mall-tab", tab.key);
    btn.innerHTML = `
      <span class="tab-icon">${tab.icon}</span>
      <span class="tab-label">${tab.label}</span>
      <span class="tab-remain">${tab.count}</span>
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
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-head">
        <strong>${q.title || "未命名任務"}</strong>
        <span class="pill">${q.reason || "manual"}</span>
      </div>
      <div class="muted">點數：${q.points || 0} ｜ 難度：${difficultyLabel(q.difficulty)}</div>
    `;
    list.appendChild(item);
  });
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
  quests.sort((a, b) => {
    if (state.questSortBy === "points") {
      return (Number(a.points || 0) - Number(b.points || 0)) * dir;
    }
    if (state.questSortBy === "difficulty") {
      return ((difficultyOrder[a.difficulty || "easy"] || 0) - (difficultyOrder[b.difficulty || "easy"] || 0)) * dir;
    }
    const da = String(a.published_date || "");
    const db = String(b.published_date || "");
    return da.localeCompare(db) * dir;
  });

  return quests;
}

function renderQuests() {
  const list = $("#quest-list");
  const nav = $("#quest-category-nav");
  list.innerHTML = "";
  if (nav) nav.innerHTML = "";

  const quests = getVisibleQuests();
  if (!quests.length) {
    list.innerHTML = '<div class="muted">目前沒有符合條件的任務。</div>';
    return;
  }

  const statusText = {
    accepted: "已承接",
    submitted: "待審核",
    rejected: "已退回",
    approved: "已通過",
  };

  const completedIds = state.progress.completed_quest_ids || [];
  const questStates = state.progress.quest_states || {};
  const claimedBonuses = state.progress.claimed_category_bonuses || [];

  // Group quests by category
  const grouped = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  quests.forEach((q) => grouped[getQuestCategory(q)].push(q));

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
      const source = cat === "all" ? quests : grouped[cat];
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
  const activeQuests = activeCategory === "all" ? quests : grouped[activeCategory] || [];

  if (!activeQuests.length) {
    list.innerHTML = '<div class="muted">此分類目前沒有任務。</div>';
    return;
  }

  activeQuests.forEach((q) => {
    const questState = questStates[q.id] || "";
    const completed = completedIds.includes(q.id) || questState === "approved";
    const dueDate = q.due_date || q.published_date || "";
    const deadlineText = getDeadlineText(dueDate);
    const cat = getQuestCategory(q);
    const catLabel = CATEGORY_CONFIG[cat]?.label || "其他任務";

    let actions = "";
    let selectHtml = "";
    if (state.role === "admin") {
      selectHtml = `<label class="quest-select-wrap"><input type="checkbox" data-select-quest="${q.id}" ${state.selectedQuestIds[q.id] ? "checked" : ""}> 勾選</label>`;
      actions = `
        <div class="review-actions">
          <button class="btn-wood btn-sm btn-accent" data-edit-quest="${q.id}" type="button">編輯</button>
          <button class="btn-wood btn-sm btn-brand" data-delete-quest="${q.id}" type="button">刪除</button>
        </div>
      `;
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
        </div>
      </div>
      <div class="quest-item-body">
        <div class="muted">${q.description}</div>
        <div class="muted">難度：${difficultyLabel(q.difficulty)} ｜ 發布：${q.published_date || "-"} ｜ 截止：${dueDate || "-"}</div>
        <div class="deadline-left ${deadlineText === "已截止" ? "is-overdue" : ""}">距離截止還有：${deadlineText}</div>
        ${selectHtml}
        ${questState ? `<div class="muted">狀態：<span class="pill quest-status ${questState}">${statusText[questState] || questState}</span></div>` : ""}
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
    const claimed = state.progress.claimed_reward_ids.includes(r.id);
    const canClaim = state.progress.points >= r.cost_points;

    const card = document.createElement("article");
    card.className = `reward-card${claimed ? " is-claimed" : ""}${!canClaim && !claimed ? " no-points" : ""}`;
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
        <button class="reward-card-btn${claimed ? " btn-ghost" : canClaim ? " btn-accent" : " btn-ghost"}"
          data-claim="${r.id}" ${claimed || !canClaim ? "disabled" : ""}>
          ${claimed ? "✓ 已兌換" : canClaim ? "兌換" : "點數不足"}
        </button>
      </div>
    `;
    list.appendChild(card);
  });
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
  state.userId = state.userId || DEFAULT_USER_ID;

  const [progress, quests, rewards, announcements, giftboxMails, playerClaims] = await Promise.all([
    api(`/api/progress/${encodeURIComponent(state.userId)}`),
    api("/api/quests"),
    api("/api/rewards"),
    api("/api/announcements"),
    api(`/api/giftbox/${encodeURIComponent(state.userId)}`),
    api(`/api/claims/${encodeURIComponent(state.userId)}`),
  ]);

  state.progress = progress;
  state.quests = quests;
  state.rewards = rewards;
  state.announcements = announcements;
  state.giftboxMails = giftboxMails;
  state.playerClaims = playerClaims;

  if (state.role === "admin") {
    const [claims, submissions, templates, settings, deleted, giftHistory] = await Promise.all([
      api("/api/claims"),
      api("/api/quest-submissions"),
      api("/api/quest-templates"),
      api("/api/quest-refresh-settings"),
      api("/api/quests/deleted-recent"),
      api("/api/giftbox-history"),
    ]);
    state.claims = claims;
    state.submissions = submissions;
    state.questTemplates = templates;
    state.refreshSettings = settings;
    state.deletedQuests = deleted;
    state.giftboxHistory = giftHistory;
    if ($("#refresh-daily-count")) $("#refresh-daily-count").value = String(settings.daily_count ?? 3);
    if ($("#refresh-weekly-count")) $("#refresh-weekly-count").value = String(settings.weekly_count ?? 2);
  } else {
    state.claims = [];
    state.submissions = [];
    state.questTemplates = [];
    state.deletedQuests = [];
    state.giftboxHistory = [];
  }

  renderStats();
  renderQuests();
  renderRewards();
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
}

function onMallNavClick(event) {
  const tab = event.target.closest("[data-mall-tab]")?.getAttribute("data-mall-tab");
  if (!tab) return;
  state.activeMallTab = tab;
  renderMallNav();
}

function resetQuestForm() {
  $("#quest-form").reset();
  if ($("#q-due-date")) $("#q-due-date").value = "";
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
    let imagePath = $("#r-image").value.trim();
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

    await api("/api/rewards", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    event.target.reset();
    setMessage("獎勵新增成功");
    await refreshAll();
  } catch (err) {
    btnRestore(btn);
    throw err;
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
    if (!quest) {
      return;
    }
    state.editingQuestId = quest.id;
    $("#q-title").value = quest.title || "";
    $("#q-description").value = quest.description || "";
    $("#q-points").value = quest.points || "";
    $("#q-difficulty").value = quest.difficulty || "easy";
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
    if (!ok) {
      return;
    }
    btnLoading(btn);
    try {
      await api(`/api/quests/${deleteQuestId}`, { method: "DELETE" });
    } catch (err) {
      btnRestore(btn);
      setMessage(err.message, true);
      return;
    }
    if (state.editingQuestId === deleteQuestId) {
      resetQuestForm();
    }
    setMessage("任務已刪除");
    await refreshAll();
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
      setMessage(result.message || "刷新設定已更新");
      await refreshAll();
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

async function boot() {
  state.userId = DEFAULT_USER_ID;
  renderPlayerName();

  $("#login-form").addEventListener("submit", onLogin);
  $("#quick-user-login").addEventListener("click", onQuickUserLogin);
  $("#quick-admin-login")?.addEventListener("click", onQuickAdminLogin);
  $("#logout-btn").addEventListener("click", onLogout);
  $("#nav-announce-btn").addEventListener("click", () => showView("announce"));
  $("#nav-quests-btn").addEventListener("click", () => showView("quests"));
  $("#open-mall-btn").addEventListener("click", () => showView("mall"));
  $("#open-giftbox-btn").addEventListener("click", openGiftboxModal);
  $("#giftbox-close-btn").addEventListener("click", closeGiftboxModal);

  bindQuestToolbar();

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
  $("#mall-nav")?.addEventListener("click", onMallNavClick);
  $("#reward-list").addEventListener("click", onListClick);
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

  // Lightbox: open on data-lightbox click, close on overlay or close button
  document.addEventListener("click", (event) => {
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
  });
}

boot();
