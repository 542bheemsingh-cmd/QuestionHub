# QuestionHub Firebase Setup

1. Open [Firebase Console](https://console.firebase.google.com) and create a project.
2. Add a Web App, then copy the Firebase config object.
3. Paste your config into `js/firebase.js`, replacing the `YOUR_*` placeholder values.
4. In Firebase Authentication, enable:
   - Google
   - Email/Password
5. In Firestore Database, create a database. Start in test mode while developing, then tighten rules before launch.
6. In Storage, create a default bucket for image uploads.
7. Run the site from a local server, not by double-clicking HTML files, because ES modules need an HTTP origin.

Development server:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

Suggested Firestore structure:

```text
questions/{questionId}
questions/{questionId}/likes/{userId}
questions/{questionId}/replies/{replyId}
questions/{questionId}/replies/{replyId}/likes/{userId}
users/{userId}
```

Starter development rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /questions/{questionId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;

      match /likes/{userId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == userId;
      }

      match /replies/{replyId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null;

        match /likes/{userId} {
          allow read: if true;
          allow write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Starter Storage rules:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /questions/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    match /replies/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```
