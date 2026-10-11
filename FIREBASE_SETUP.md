# QuestionHub Firebase Setup

QuestionHub is a static site (GitHub Pages) backed by Firebase. It uses Firebase
Authentication, Firestore, and Storage from the browser — there is no server.

## 1. Create the project

1. Open the [Firebase Console](https://console.firebase.google.com) and create a project.
2. Add a Web App, then copy the Firebase config object.
3. Paste your config into `js/firebase.js`, replacing the `YOUR_*` placeholder values.

> The Firebase **web** config (apiKey, projectId, appId, …) is not a secret — it
> ships in every browser bundle. Your data is protected by the Firestore and
> Storage **security rules**, not by hiding this object. Still, restrict the key:
> in **Google Cloud Console → APIs & Services → Credentials**, edit the browser
> key and set **Application restrictions → HTTP referrers** to your domains
> (e.g. `542bheemsingh-cmd.github.io/*`, `localhost:5173/*`), and under **API
> restrictions** allow only the Identity Toolkit, Firestore, and Storage APIs.

## 2. Enable the products

In **Authentication**, enable:
- Google
- Email/Password

In **Firestore Database**, create a database (production mode is fine — the rules
below are the real protection).

In **Storage**, create a default bucket for image uploads.

## 3. Deploy the security rules

This repo ships hardened rules. **Do not run the database in open "test mode"** —
in test mode anyone on the internet can read, write, and delete all data.

```bash
firebase deploy --only firestore:rules,storage:rules
```

The rules live in [`firestore.rules`](firestore.rules) and [`storage.rules`](storage.rules).
In short:

- Questions and replies are **publicly readable**.
- Only **signed-in** users can create content, and only as themselves.
- A user may **edit or delete only their own** questions and replies.
- Other users may only bump the derived counters (`likeCount`, `replyCount`,
  `reactions`) — not change anyone's content.
- `users/{uid}` documents are readable/writable **only by that user**.
- Storage uploads must go into the uploader's own folder, be an image, and be < 5 MB.

## 4. Authorized domains

Add any non-Firebase host you serve from (e.g. your GitHub Pages domain) under
**Authentication → Settings → Authorized domains**, otherwise Google login returns
`auth/unauthorized-domain`.

## 5. Run locally

ES modules need an HTTP origin — do not open the HTML files by double-clicking.

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

## Data model

```text
questions/{questionId}
questions/{questionId}/likes/{userId}
questions/{questionId}/replies/{replyId}
questions/{questionId}/replies/{replyId}/likes/{userId}
users/{userId}
```
