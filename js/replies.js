import {
  auth,
  db,
  storage,
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  getDoc,
  increment,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
} from "./firebase.js";
import { requireUser } from "./auth.js";
import { $, escapeHtml, formatDate, getAvatar, getDisplayName, toast } from "./ui.js";

async function uploadReplyImage(file, userId) {
  if (!file || !file.size) return "";
  const imageRef = ref(storage, `replies/${userId}/${crypto.randomUUID()}-${file.name}`);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}

function replyMarkup(reply, id) {
  const reactions = reply.reactions || {};
  return `
    <article class="reply-card" data-reply-id="${id}">
      <div class="question-meta">
        <img src="${escapeHtml(reply.authorPhoto)}" alt="" class="avatar">
        <div>
          <strong>${escapeHtml(reply.authorName)}</strong>
          <span>${formatDate(reply.createdAt)}</span>
        </div>
      </div>
      <p>${escapeHtml(reply.body)}</p>
      ${reply.imageUrl ? `<img class="reply-image" src="${escapeHtml(reply.imageUrl)}" alt="Reply attachment">` : ""}
      <div class="card-actions">
        <button class="icon-action" data-like-reply="${id}" type="button"><i data-lucide="Heart"></i><span>${reply.likeCount || 0}</span></button>
        ${["👍", "🔥", "💡", "🚀"].map((emoji) => `
          <button class="emoji-action" data-react-reply="${id}" data-emoji="${emoji}" type="button">${emoji} ${reactions[emoji] || 0}</button>
        `).join("")}
      </div>
    </article>
  `;
}

export function initReplies(questionId) {
  const list = $("#reply-list");
  const form = $("#reply-form");
  if (!list || !form || !questionId) return;

  onSnapshot(query(collection(db, "questions", questionId, "replies"), orderBy("createdAt", "asc")), (snapshot) => {
    list.innerHTML = snapshot.docs.map((docSnap) => replyMarkup(docSnap.data(), docSnap.id)).join("") || `<p class="empty-state">No replies yet. Drop the first signal.</p>`;
    if (window.lucide) window.lucide.createIcons();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = await requireUser();
    if (!user) return;
    const data = new FormData(form);
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "Sending...";
    try {
      const imageUrl = await uploadReplyImage(data.get("image"), user.uid);
      await addDoc(collection(db, "questions", questionId, "replies"), {
        body: data.get("body").trim(),
        imageUrl,
        authorId: user.uid,
        authorName: getDisplayName(user),
        authorPhoto: getAvatar(user),
        likeCount: 0,
        reactions: {},
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "questions", questionId), {
        replyCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      form.reset();
      toast("Reply posted live.", "success");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Post reply";
    }
  });

  list.addEventListener("click", async (event) => {
    const likeButton = event.target.closest("[data-like-reply]");
    const reactButton = event.target.closest("[data-react-reply]");
    if (!likeButton && !reactButton) return;
    const user = await requireUser();
    if (!user) return;
    try {
      if (likeButton) {
        const replyId = likeButton.dataset.likeReply;
        const likeRef = doc(db, "questions", questionId, "replies", replyId, "likes", user.uid);
        const likeSnap = await getDoc(likeRef);
        await updateDoc(doc(db, "questions", questionId, "replies", replyId), { likeCount: increment(likeSnap.exists() ? -1 : 1) });
        if (likeSnap.exists()) await deleteDoc(likeRef);
        else await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
      }
      if (reactButton) {
        const replyId = reactButton.dataset.reactReply;
        const emoji = reactButton.dataset.emoji;
        await updateDoc(doc(db, "questions", questionId, "replies", replyId), {
          [`reactions.${emoji}`]: increment(1),
        });
      }
    } catch (error) {
      toast(error.message, "error");
    }
  });
}
