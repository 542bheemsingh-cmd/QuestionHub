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
  const currentDomain = location.hostname || "current domain";
  const messages = {
    "auth/configuration-not-found": "Firebase Authentication abhi project mein enable nahi hai. Firebase Console > Authentication > Get started kholo, phir Email/Password aur Google providers enable karo.",
    "auth/operation-not-allowed": "Ye sign-in provider disabled hai. Firebase Console > Authentication > Sign-in method mein provider enable karo.",
    "auth/unauthorized-domain": `${currentDomain} authorized domain mein nahi hai. Firebase Console > Authentication > Settings > Authorized domains mein ${currentDomain} add karo.`,
    "auth/email-already-in-use": "Is email se account already bana hua hai. Login tab use karo.",
    "auth/invalid-email": "Email address valid nahi lag raha.",
    "auth/weak-password": "Password kam se kam 6 characters ka hona chahiye.",
    "auth/invalid-credential": "Email ya password galat hai, ya account register nahi hua.",
    "auth/popup-closed-by-user": "Google login popup close ho gaya. Dobara try karo.",
  };
  return messages[error.code] || error.message || "Firebase login mein issue aaya.";
}

function goAfterLogin(path = "index.html") {
  window.location.assign(new URL(path, window.location.href).href);
}

async function saveUser(user) {
  if (!user) return;
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: getDisplayName(user),
      email: user.email || "",
      photoURL: getAvatar(user),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn("Profile save skipped:", error);
  }
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

  onAuthStateChanged(auth, (user) => {
    if (user && !sessionStorage.getItem("questionhub-stay-login")) {
      goAfterLogin("index.html");
    }
  });

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
      goAfterLogin("index.html");
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
      goAfterLogin("index.html");
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
      goAfterLogin("profile.html");
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
    goAfterLogin("index.html");
  });
}
