import {
  auth,
  db,
  storage,
  collection,
  doc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
} from "./firebase.js";
import { requireUser } from "./auth.js";
import { getUploadErrorMessage, validateImage } from "./image-upload.js";
import { $, categories, escapeHtml, formatDate, getAvatar, getDisplayName, showSkeleton, toast } from "./ui.js";

const pageSize = 8;
let lastQuestionDoc = null;
let loadingMore = false;

function withTimeout(promise, message = "Request timed out. Firebase rules/network check karo.", ms = 15000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getQuestionErrorMessage(error) {
  const messages = {
    "permission-denied": "Firestore rules write allow nahi kar rahe. Firebase Console > Firestore rules mein authenticated create allow karo.",
    "unauthenticated": "Session expire ho gaya. Login karke dobara publish karo.",
    "failed-precondition": "Firestore database/index setup incomplete hai. Firebase Console mein Firestore Database enable karo.",
    "unavailable": "Firebase temporarily unavailable hai. Network check karke dobara try karo.",
  };
  return messages[error.code] || error.message || "Question publish nahi ho paya.";
}

function setFirebaseStatus(type, message) {
  const box = $("#firebase-status");
  if (!box) return;
  box.className = `firebase-status ${type}`;
  const icon = type === "ok" ? "CircleCheck" : type === "error" ? "TriangleAlert" : "LoaderCircle";
  box.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span>`;
  if (window.lucide) window.lucide.createIcons();
}

export function questionCard(question, id) {
  const tags = (question.tags || []).slice(0, 4).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
  return `
    <article class="question-card tilt-card" data-question-id="${id}">
      <a class="question-card-link" href="question.html?id=${id}" aria-label="${escapeHtml(question.title)}"></a>
      <div class="question-meta">
        <img src="${escapeHtml(question.authorPhoto)}" alt="" class="avatar">
        <div>
          <strong>${escapeHtml(question.authorName)}</strong>
          <span>${formatDate(question.createdAt)} · ${escapeHtml(question.category)}</span>
        </div>
      </div>
      <div class="question-kicker">
        <span class="question-category">${escapeHtml(question.category)}</span>
        <span class="question-state ${question.replyCount ? "has-answers" : "needs-answer"}"><i data-lucide="${question.replyCount ? "MessagesSquare" : "CircleHelp"}"></i>${question.replyCount ? "Active answers" : "Needs an answer"}</span>
      </div>
      <h3>${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.description || "").slice(0, 180)}${(question.description || "").length > 180 ? "..." : ""}</p>
      ${question.imageUrl ? `<img class="question-thumb" src="${escapeHtml(question.imageUrl)}" alt="Question attachment">` : ""}
      <div class="tag-row">${tags}</div>
      <div class="card-actions">
        <button class="icon-action" data-like-question="${id}" type="button"><i data-lucide="Heart"></i><span>${question.likeCount || 0}</span></button>
        <span class="icon-action passive"><i data-lucide="MessageCircle"></i><span>${question.replyCount || 0}</span></span>
        <button class="icon-action" data-bookmark-question="${id}" type="button"><i data-lucide="Bookmark"></i><span>Save</span></button>
      </div>
    </article>
  `;
}

async function uploadQuestionImage(file, userId) {
  if (!file || !file.size) return "";
  validateImage(file);
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const imageRef = ref(storage, `questions/${userId}/${crypto.randomUUID()}-${safeName}`);
  await uploadBytes(imageRef, file, { contentType: file.type });
  return getDownloadURL(imageRef);
}

export function initAskPage() {
  const form = $("#ask-form");
  const categoryInput = $("#category");
  const categoryTrigger = $("[data-category-select] .custom-select-trigger");
  const categoryCurrent = $("[data-category-current]");
  const categoryMenu = $("[data-category-menu]");
  if (!form) return;

  form.querySelectorAll("[data-count-input]").forEach((input) => {
    const counter = input.parentElement.querySelector("[data-count]");
    const updateCount = () => {
      if (counter) counter.textContent = String(input.value.length);
    };
    input.addEventListener("input", updateCount);
    updateCount();
  });

  const imageInput = form.querySelector("input[name='image']");
  const imagePreview = $("#question-image-preview");
  const imageDrop = $("#question-image-drop");
  const imageLabel = $("[data-image-label]");
  let previewUrl = "";
  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file || !imagePreview) return;
    previewUrl = URL.createObjectURL(file);
    imagePreview.innerHTML = `<img src="${previewUrl}" alt="Selected question image"><button class="preview-remove" type="button" aria-label="Remove selected image"><i data-lucide="X"></i></button>`;
    imagePreview.hidden = false;
    imageDrop?.classList.add("has-file");
    if (imageLabel) imageLabel.textContent = file.name;
    if (window.lucide) window.lucide.createIcons();
  });
  imagePreview?.addEventListener("click", (event) => {
    if (!event.target.closest(".preview-remove")) return;
    imageInput.value = "";
    imagePreview.hidden = true;
    imagePreview.innerHTML = "";
    imageDrop?.classList.remove("has-file");
    if (imageLabel) imageLabel.textContent = "Upload question image";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  });

  auth.onAuthStateChanged?.((user) => {
    if (!user) {
      setFirebaseStatus("warn", "Login required hai. Publish karne ke liye pehle login karo.");
      return;
    }
    setFirebaseStatus("ok", `Logged in as ${getDisplayName(user)}. Ready to publish.`);
  });

  if (categoryInput && categoryMenu && categoryTrigger && categoryCurrent) {
    categoryMenu.innerHTML = categories.map((category) => `
      <button type="button" style="--accent:${category.color}" data-category-option="${escapeHtml(category.name)}">
        <i data-lucide="${category.icon}"></i>
        <span>${escapeHtml(category.name)}</span>
      </button>
    `).join("");

    categoryTrigger.addEventListener("click", () => {
      const open = categoryTrigger.getAttribute("aria-expanded") === "true";
      categoryTrigger.setAttribute("aria-expanded", String(!open));
      categoryMenu.classList.toggle("is-open", !open);
    });

    categoryMenu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-category-option]");
      if (!option) return;
      categoryInput.value = option.dataset.categoryOption;
      categoryCurrent.textContent = option.dataset.categoryOption;
      categoryTrigger.setAttribute("aria-expanded", "false");
      categoryMenu.classList.remove("is-open");
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-category-select]")) {
        categoryTrigger.setAttribute("aria-expanded", "false");
        categoryMenu.classList.remove("is-open");
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = await requireUser();
    if (!user) return;
    const data = new FormData(form);
    const submit = form.querySelector("button[type='submit']");
    const original = submit.innerHTML;
    const title = String(data.get("title") || "").trim();
    const description = String(data.get("description") || "").trim();
    const category = String(data.get("category") || "").trim();
    if (!title || !description || !category) {
      toast("Title, description aur category required hain.", "error");
      return;
    }
    submit.disabled = true;
    submit.innerHTML = `<i data-lucide="LoaderCircle"></i>Publishing...`;
    if (window.lucide) window.lucide.createIcons();
    try {
      let imageUrl = "";
      try {
        imageUrl = await withTimeout(uploadQuestionImage(data.get("image"), user.uid), "Image upload stuck hai. Storage rules/network check karo.");
      } catch (imageError) {
        setFirebaseStatus("warn", `${getUploadErrorMessage(imageError)} Question text ke saath publish ho raha hai.`);
        toast(`${getUploadErrorMessage(imageError)} Question text ke saath publish ho raha hai.`, "warning");
        console.warn("Image upload skipped:", imageError);
      }
      const tags = String(data.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
      const docRef = await withTimeout(addDoc(collection(db, "questions"), {
        title,
        description,
        category,
        tags,
        imageUrl,
        authorId: user.uid,
        authorName: getDisplayName(user),
        authorPhoto: getAvatar(user),
        likeCount: 0,
        replyCount: 0,
        bookmarks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }), "Publish request timed out. Firestore rules/network check karo.");
      setFirebaseStatus("ok", "Question saved successfully.");
      toast("Question launched into the hub.", "success");
      location.href = `question.html?id=${docRef.id}`;
    } catch (error) {
      setFirebaseStatus("error", getQuestionErrorMessage(error));
      toast(getQuestionErrorMessage(error), "error");
      console.error("Publish failed:", error);
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

export function listenQuestionList(container, options = {}) {
  if (!container) return () => {};
  showSkeleton(container, options.skeletonCount || 4);
  const constraints = [orderBy(options.orderField || "createdAt", "desc"), limit(options.limit || pageSize)];
  if (options.category) constraints.unshift(where("category", "==", options.category));
  const q = query(collection(db, "questions"), ...constraints);
  return onSnapshot(q, (snapshot) => {
    container.innerHTML = snapshot.docs.map((docSnap) => questionCard(docSnap.data(), docSnap.id)).join("") || `<p class="empty-state">No questions yet. Start the signal.</p>`;
    if (window.lucide) window.lucide.createIcons();
  }, (error) => {
    container.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  });
}

function questionTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function paginationPages(currentPage, totalPages) {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
}

export function listenCategoryQuestions(container, pagination, category, pageSize = 15) {
  if (!container || !category) return () => {};
  let questions = [];
  let currentPage = Math.max(1, Number(new URLSearchParams(location.search).get("page")) || 1);

  showSkeleton(container, 4);

  const render = () => {
    const totalPages = Math.max(1, Math.ceil(questions.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageQuestions = questions.slice(start, start + pageSize);
    container.innerHTML = pageQuestions.map((question) => questionCard(question.data, question.id)).join("") || `<p class="empty-state">No questions in this category yet.</p>`;

    if (pagination) {
      const pageButtons = paginationPages(currentPage, totalPages);
      let markup = `<button class="page-button" type="button" data-page="${currentPage - 1}" aria-label="Previous page" ${currentPage === 1 ? "disabled" : ""}><i data-lucide="ChevronLeft"></i></button>`;
      let previous = 0;
      pageButtons.forEach((page) => {
        if (previous && page - previous > 1) markup += `<span class="page-gap">...</span>`;
        markup += `<button class="page-button${page === currentPage ? " is-active" : ""}" type="button" data-page="${page}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`;
        previous = page;
      });
      markup += `<button class="page-button" type="button" data-page="${currentPage + 1}" aria-label="Next page" ${currentPage === totalPages ? "disabled" : ""}><i data-lucide="ChevronRight"></i></button>`;
      pagination.innerHTML = totalPages > 1 ? markup : "";
    }

    if (window.lucide) window.lucide.createIcons();
  };

  pagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    currentPage = Number(button.dataset.page);
    const params = new URLSearchParams(location.search);
    params.set("category", category);
    params.set("page", String(currentPage));
    history.replaceState({}, "", `${location.pathname}?${params.toString()}#latest-discussions`);
    render();
    document.querySelector("#latest-discussions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const categoryQuery = query(collection(db, "questions"), where("category", "==", category));
  return onSnapshot(categoryQuery, (snapshot) => {
    questions = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
      .sort((a, b) => questionTime(b.data.createdAt) - questionTime(a.data.createdAt));
    render();
  }, (error) => {
    container.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    if (pagination) pagination.innerHTML = "";
  });
}

export async function loadMoreQuestions(container) {
  if (!container || loadingMore) return;
  loadingMore = true;
  const constraints = [orderBy("createdAt", "desc"), limit(pageSize)];
  if (lastQuestionDoc) constraints.push(startAfter(lastQuestionDoc));
  const snapshot = await getDocs(query(collection(db, "questions"), ...constraints));
  if (snapshot.docs.length) lastQuestionDoc = snapshot.docs[snapshot.docs.length - 1];
  container.insertAdjacentHTML("beforeend", snapshot.docs.map((docSnap) => questionCard(docSnap.data(), docSnap.id)).join(""));
  if (window.lucide) window.lucide.createIcons();
  loadingMore = false;
}

export function initQuestionActions() {
  document.addEventListener("click", async (event) => {
    const likeButton = event.target.closest("[data-like-question]");
    const bookmarkButton = event.target.closest("[data-bookmark-question]");
    if (!likeButton && !bookmarkButton) return;
    event.preventDefault();
    const user = await requireUser();
    if (!user) return;
    try {
      if (likeButton) {
        const id = likeButton.dataset.likeQuestion;
        const likeRef = doc(db, "questions", id, "likes", user.uid);
        const likeSnap = await getDoc(likeRef);
        await updateDoc(doc(db, "questions", id), { likeCount: increment(likeSnap.exists() ? -1 : 1) });
        if (likeSnap.exists()) await deleteDoc(likeRef);
        else await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
      }
      if (bookmarkButton) {
        const id = bookmarkButton.dataset.bookmarkQuestion;
        await setDoc(doc(db, "users", user.uid), { bookmarks: arrayUnion(id), updatedAt: serverTimestamp() }, { merge: true });
        toast("Saved to your profile.", "success");
      }
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

export async function getQuestion(id) {
  const snap = await getDoc(doc(db, "questions", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function listenSearch(input, results) {
  if (!input || !results) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const term = input.value.trim().toLowerCase();
    if (term.length < 2) {
      results.innerHTML = "";
      results.hidden = true;
      return;
    }
    timer = setTimeout(async () => {
      const snapshot = await getDocs(query(collection(db, "questions"), orderBy("createdAt", "desc"), limit(30)));
      const matches = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((question) => `${question.title} ${question.description} ${(question.tags || []).join(" ")}`.toLowerCase().includes(term))
        .slice(0, 6);
      results.hidden = false;
      results.innerHTML = matches.map((question) => `
        <a href="question.html?id=${question.id}">
          <strong>${escapeHtml(question.title)}</strong>
          <span>${escapeHtml(question.category)} · ${question.likeCount || 0} likes</span>
        </a>
      `).join("") || `<p>No live matches yet.</p>`;
    }, 180);
  });
}
