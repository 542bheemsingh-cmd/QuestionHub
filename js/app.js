import { auth, db, onAuthStateChanged, doc, getDoc } from "./firebase.js";
import { initAuthControls } from "./auth.js";
import { initAskPage, initQuestionActions, listenQuestionList, listenSearch, getQuestion } from "./questions.js";
import { initReplies } from "./replies.js";
import { $, categories, escapeHtml, formatDate, initPageChrome, renderCategoryCards } from "./ui.js";

initPageChrome();
initAuthControls();
initQuestionActions();

const page = document.body.dataset.page;

if (page === "home") {
  renderCategoryCards($("#category-grid"), (category) => {
    location.href = `index.html?category=${encodeURIComponent(category)}`;
  });
  const params = new URLSearchParams(location.search);
  const category = params.get("category");
  listenQuestionList($("#trending-list"), { orderField: "likeCount", limit: 6, skeletonCount: 3 });
  listenQuestionList($("#latest-list"), { category, limit: 8, skeletonCount: 4 });
  listenSearch($("#global-search"), $("#search-results"));
  const tagWrap = $("#trending-tags");
  if (tagWrap) {
    tagWrap.innerHTML = ["firebase", "ai", "gaming", "security", "javascript", "space", "anime"].map((tag) => `<a href="index.html?tag=${tag}">#${tag}</a>`).join("");
  }
}

if (page === "ask") {
  initAskPage();
}

if (page === "question") {
  const id = new URLSearchParams(location.search).get("id");
  const shell = $("#question-detail");
  if (!id) {
    shell.innerHTML = `<p class="empty-state">Missing question id.</p>`;
  } else {
    getQuestion(id).then((question) => {
      if (!question) {
        shell.innerHTML = `<p class="empty-state">Question not found.</p>`;
        return;
      }
      document.title = `${question.title} | QuestionHub`;
      shell.innerHTML = `
        <article class="detail-card">
          <div class="question-meta">
            <img src="${escapeHtml(question.authorPhoto)}" alt="" class="avatar">
            <div>
              <strong>${escapeHtml(question.authorName)}</strong>
              <span>${formatDate(question.createdAt)} · ${escapeHtml(question.category)}</span>
            </div>
          </div>
          <h1>${escapeHtml(question.title)}</h1>
          <p>${escapeHtml(question.description)}</p>
          ${question.imageUrl ? `<img class="detail-image" src="${escapeHtml(question.imageUrl)}" alt="Question attachment">` : ""}
          <div class="tag-row">${(question.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="card-actions">
            <button class="icon-action" data-like-question="${question.id}" type="button"><i data-lucide="Heart"></i><span>${question.likeCount || 0}</span></button>
            <span class="icon-action passive"><i data-lucide="MessageCircle"></i><span>${question.replyCount || 0}</span></span>
            <button class="icon-action" data-bookmark-question="${question.id}" type="button"><i data-lucide="Bookmark"></i><span>Save</span></button>
          </div>
        </article>
      `;
      if (window.lucide) window.lucide.createIcons();
      initReplies(id);
    });
  }
}

if (page === "profile") {
  const profile = $("#profile-panel");
  const saved = $("#saved-list");
  const renderLoggedOutProfile = () => {
    profile.dataset.loaded = "true";
    profile.innerHTML = `
      <div class="profile-empty">
        <span class="profile-orb"><i data-lucide="UserRound"></i></span>
        <p class="eyebrow">Access required</p>
        <h1>Your hub is waiting</h1>
        <p>Login to view your saved questions, profile stats, and discussion shortcuts.</p>
        <a class="btn primary" href="login.html"><i data-lucide="LogIn"></i>Open login</a>
      </div>
    `;
    saved.innerHTML = "";
    if (window.lucide) window.lucide.createIcons();
  };
  setTimeout(() => {
    if (profile && profile.dataset.loaded !== "true") renderLoggedOutProfile();
  }, 3500);
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      renderLoggedOutProfile();
      return;
    }
    profile.dataset.loaded = "true";
    let data = {};
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      data = userSnap.data() || {};
    } catch (error) {
      console.warn("Profile data unavailable:", error);
    }
    const bookmarks = data.bookmarks || [];
    const avatar = user.photoURL || data.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.displayName || data.name || user.email || "QH")}`;
    const displayName = user.displayName || data.name || "QuestionHub User";
    profile.innerHTML = `
      <div class="profile-cover"></div>
      <div class="profile-hero">
        <img class="profile-avatar" src="${escapeHtml(avatar)}" alt="">
        <div class="profile-copy">
          <p class="eyebrow">QuestionHub profile</p>
          <h1>${escapeHtml(displayName)}</h1>
          <p>${escapeHtml(user.email || "No email connected")}</p>
          <div class="profile-badges">
            <span><i data-lucide="ShieldCheck"></i>${user.emailVerified ? "Verified email" : "Email not verified"}</span>
            <span><i data-lucide="Zap"></i>Live member</span>
          </div>
        </div>
        <button class="btn danger" id="logout-button" type="button"><i data-lucide="LogOut"></i>Logout</button>
      </div>
      <div class="profile-stats">
        <span><strong>${bookmarks.length}</strong> saved questions</span>
        <span><strong>${categories.length}</strong> category channels</span>
        <span><strong>${formatDate(data.updatedAt)}</strong> last sync</span>
      </div>
      <div class="profile-actions">
        <a class="profile-action-card" href="ask.html">
          <i data-lucide="PlusCircle"></i>
          <strong>Ask a question</strong>
          <span>Start a new community thread.</span>
        </a>
        <a class="profile-action-card" href="index.html#latest-discussions">
          <i data-lucide="Radar"></i>
          <strong>Explore feed</strong>
          <span>Jump into live discussions.</span>
        </a>
        <a class="profile-action-card" href="index.html">
          <i data-lucide="Grid3X3"></i>
          <strong>Browse channels</strong>
          <span>Find questions by category.</span>
        </a>
      </div>
    `;
    initAuthControls();
    if (!bookmarks.length) {
      saved.innerHTML = `
        <div class="empty-state profile-saved-empty">
          <i data-lucide="Bookmark"></i>
          <strong>No saved questions yet</strong>
          <span>Tap Save on any question to build your personal vault.</span>
        </div>
      `;
    } else {
      const savedQuestions = await Promise.all(bookmarks.slice(0, 12).map(async (id) => {
        try {
          const question = await getQuestion(id);
          return question ? `
            <a class="saved-question-card" href="question.html?id=${escapeHtml(id)}">
              <span>${escapeHtml(question.category || "Question")}</span>
              <strong>${escapeHtml(question.title || "Untitled question")}</strong>
              <small>${question.likeCount || 0} likes · ${question.replyCount || 0} replies</small>
            </a>
          ` : "";
        } catch {
          return "";
        }
      }));
      saved.innerHTML = `<div class="saved-grid">${savedQuestions.join("") || `<p class="empty-state">Saved questions could not be loaded.</p>`}</div>`;
    }
    if (window.lucide) window.lucide.createIcons();
  });
}

