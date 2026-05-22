import {
  auth,
  db,
  googleProvider,
  onAuthStateChanged,
  doc,
  setDoc,
  serverTimestamp,
  getFirebaseSetupIssue,
} from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { $, getAvatar, getDisplayName, toast } from "./ui.js";

function showAuthSetupIssue() {
  const issue = getFirebaseSetupIssue();
  if (!issue) return false;
  const card = $(".auth-card");
  let warning = $("#firebase-warning");
  if (!warning && card) {
    warning = document.createElement("div");
    warning.id = "firebase-warning";
    warning.className = "setup-warning";
    card.insertBefore(warning, card.querySelector(".auth-tabs"));
  }
  if (warning) {
    warning.innerHTML = `
      <strong>Firebase setup required</strong>
      <span>${issue}</span>
    `;
  }
  toast(issue, "warning");
  return true;
}

function getAuthErrorMessage(error) {
  const messages = {
    "auth/configuration-not-found": "Firebase Authentication abhi project mein enable nahi hai. Firebase Console > Authentication > Get started kholo, phir Email/Password aur Google providers enable karo.",
    "auth/operation-not-allowed": "Ye sign-in provider disabled hai. Firebase Console > Authentication > Sign-in method mein provider enable karo.",
    "auth/unauthorized-domain": "localhost authorized domain mein nahi hai. Firebase Console > Authentication > Settings > Authorized domains mein localhost add karo.",
    "auth/email-already-in-use": "Is email se account already bana hua hai. Login tab use karo.",
    "auth/invalid-email": "Email address valid nahi lag raha.",
    "auth/weak-password": "Password kam se kam 6 characters ka hona chahiye.",
    "auth/invalid-credential": "Email ya password galat hai, ya account register nahi hua.",
    "auth/popup-closed-by-user": "Google login popup close ho gaya. Dobara try karo.",
  };
  return messages[error.code] || error.message || "Firebase login mein issue aaya.";
}

async function saveUser(user) {
  if (!user) return;
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: getDisplayName(user),
    email: user.email || "",
    photoURL: getAvatar(user),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function requireUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast("Please log in to continue.", "warning");
        setTimeout(() => { location.href = "login.html"; }, 650);
      }
      resolve(user);
    });
  });
}

export function initAuthPage() {
  const loginForm = $("#login-form");
  const registerForm = $("#register-form");
  const googleButton = $("#google-login");
  const switchers = document.querySelectorAll("[data-auth-switch]");
  showAuthSetupIssue();

  switchers.forEach((button) => {
    button.addEventListener("click", () => {
      document.body.dataset.authMode = button.dataset.authSwitch;
    });
  });

  googleButton?.addEventListener("click", async () => {
    if (showAuthSetupIssue()) return;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUser(result.user);
      toast("Welcome to QuestionHub.", "success");
      location.href = "index.html";
    } catch (error) {
      toast(getAuthErrorMessage(error), "error");
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (showAuthSetupIssue()) return;
    const data = new FormData(loginForm);
    try {
      const result = await signInWithEmailAndPassword(auth, data.get("email"), data.get("password"));
      await saveUser(result.user);
      toast("Logged in successfully.", "success");
      location.href = "index.html";
    } catch (error) {
      toast(getAuthErrorMessage(error), "error");
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (showAuthSetupIssue()) return;
    const data = new FormData(registerForm);
    try {
      const result = await createUserWithEmailAndPassword(auth, data.get("email"), data.get("password"));
      await updateProfile(result.user, { displayName: data.get("name") });
      await saveUser(result.user);
      toast("Account created.", "success");
      location.href = "profile.html";
    } catch (error) {
      toast(getAuthErrorMessage(error), "error");
    }
  });
}

export function initAuthControls() {
  const logoutButton = $("#logout-button");
  logoutButton?.addEventListener("click", async () => {
    await signOut(auth);
    toast("Signed out.", "info");
    location.href = "index.html";
  });
}
