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
import { $, escapeHtml, formatDate, getAvatar, getDisplayName, showSkeleton, toast } from "./ui.js";

const pageSize = 8;
let lastQuestionDoc = null;
let loadingMore = false;

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
  const imageRef = ref(storage, `questions/${userId}/${crypto.randomUUID()}-${file.name}`);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}

export function initAskPage() {
  const form = $("#ask-form");
  const select = $("#category");
  if (!form) return;
  import("./ui.js").then(({ categories }) => {
    select.innerHTML = categories.map((category) => `<option value="${category.name}">${category.name}</option>`).join("");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = await requireUser();
    if (!user) return;
    const data = new FormData(form);
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "Publishing...";
    try {
      const imageUrl = await uploadQuestionImage(data.get("image"), user.uid);
      const tags = String(data.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
      const docRef = await addDoc(collection(db, "questions"), {
        title: data.get("title").trim(),
        description: data.get("description").trim(),
        category: data.get("category"),
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
      });
      toast("Question launched into the hub.", "success");
      location.href = `question.html?id=${docRef.id}`;
    } catch (error) {
      toast(error.message, "error");
      submit.disabled = false;
      submit.textContent = "Publish question";
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
