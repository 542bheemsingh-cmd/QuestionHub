# 🌐 QuestionHub

**Live Community Q&A — a realtime, image-rich discussion platform.**

QuestionHub is a modern, cyberpunk-styled web app where people ask and answer
questions across 17 category channels, with live Firebase sync, likes, bookmarks,
emoji reactions, and image attachments.

- 🔴 **Live site:** <https://542bheemsingh-cmd.github.io/QuestionHub/>
- 📂 **Repository:** <https://github.com/542bheemsingh-cmd/QuestionHub>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 Multi-category | 17 channels — Technology, Gaming, Science, Space, Coding, and more |
| ⚡ Realtime | Live feed and replies via Firestore `onSnapshot` |
| 🔐 Auth | Google + Email/Password (Firebase Auth), password reset |
| 🖼️ Image uploads | Attach images to questions and replies (≤ 5 MB) |
| ❤️ Engagement | Likes, bookmarks (save / un-save), emoji reactions on replies |
| 🔎 Search | Instant search over questions, tags, and categories |
| 🎨 Neon UI | Dark glassmorphism theme, canvas particles, smooth animations |
| 📱 Responsive | Layout adapts at 1040px / 760px / 420px |

---

## 🛠️ Tech stack

| Technology | Purpose |
|---|---|
| HTML5 | Structure (5 pages) |
| CSS3 | Styling, glassmorphism, animations |
| JavaScript (ES modules) | All app logic — no framework, no build step |
| Firebase 10.12.5 | Auth, Firestore, Storage |
| [Lucide](https://lucide.dev) `1.55.0` | Icons (pinned) |
| DiceBear | Fallback avatars |

---

## 📁 Project structure

```text
questionhub/
├── index.html          # Home: hero, trending, categories, live feed, search
├── ask.html            # Ask a question
├── question.html       # Question detail + replies
├── login.html          # Login / register
├── profile.html        # Profile + saved questions
├── css/
│   ├── style.css
│   ├── animations.css
│   └── responsive.css
├── js/
│   ├── app.js          # Page router / bootstrap
│   ├── auth.js         # Auth flows (Google, email, reset, logout)
│   ├── firebase.js     # Firebase init + config
│   ├── image-upload.js # Image validation
│   ├── questions.js    # Feed, ask form, likes, bookmarks, search
│   ├── replies.js      # Replies, likes, emoji reactions
│   └── ui.js           # Shared UI helpers (particles, nav, toast, categories)
├── firestore.rules     # Firestore security rules
├── storage.rules       # Storage security rules
├── firebase.json
└── FIREBASE_SETUP.md   # Setup guide (read this before deploying)
```

---

## 🚀 Run locally

ES modules need an HTTP origin — don't open the HTML files directly.

```bash
git clone https://github.com/542bheemsingh-cmd/QuestionHub.git
cd QuestionHub
python3 -m http.server 5173
# open http://localhost:5173
```

Firebase-backed features (login, feed, posting) require your own Firebase config
and deployed rules — see **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**.

---

## 🔐 Security

The data is protected by [`firestore.rules`](firestore.rules) and
[`storage.rules`](storage.rules): public read, signed-in write, and **ownership
checks** so a user can only edit or delete their own content. Deploy them with:

```bash
firebase deploy --only firestore:rules,storage:rules
```

Never ship with open ("test mode") rules.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
