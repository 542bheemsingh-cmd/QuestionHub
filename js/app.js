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
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      profile.innerHTML = `<p class="empty-state">Log in to see your profile.</p><a class="btn primary" href="login.html">Open login</a>`;
      return;
    }
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const data = userSnap.data() || {};
    profile.innerHTML = `
      <img class="profile-avatar" src="${user.photoURL || data.photoURL || "https://api.dicebear.com/8.x/initials/svg?seed=QH"}" alt="">
      <h1>${escapeHtml(user.displayName || data.name || "QuestionHub User")}</h1>
      <p>${escapeHtml(user.email || "")}</p>
      <div class="profile-stats">
        <span><strong>${(data.bookmarks || []).length}</strong> saved</span>
        <span><strong>${categories.length}</strong> channels</span>
      </div>
      <button class="btn ghost" id="logout-button" type="button">Sign out</button>
    `;
    initAuthControls();
    saved.innerHTML = `<p class="empty-state">Saved question ids: ${(data.bookmarks || []).map(escapeHtml).join(", ") || "none yet"}</p>`;
  });
}
