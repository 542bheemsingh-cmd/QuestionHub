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
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { $, getAvatar, getDisplayName, toast } from "./ui.js";

let authActionInFlight = false;
let authRedirecting = false;
let initialAuthStatePending = true;

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
    "auth/user-not-found": "Is email se account nahi mila. Register tab use karo.",
    "auth/popup-closed-by-user": "Google login popup close ho gaya. Dobara try karo.",
    "auth/popup-blocked": "Browser ne popup block kar diya. Google login ke liye popup allow karo ya dobara try karo.",
    "auth/popup-timeout": "Google login popup response nahi de raha. Dobara try karo.",
    "auth/network-request-failed": "Network connection check karke dobara try karo.",
    "auth/too-many-requests": "Bahut zyada attempts ho gaye. Thodi der baad try karo.",
    "auth/user-disabled": "Ye account disabled hai. Firebase administrator se contact karo.",
    "auth/account-exists-with-different-credential": "Is email ka account kisi aur login provider se connected hai.",
    "auth/missing-password": "Password enter karo.",
  };
  return messages[error.code] || error.message || "Firebase login mein issue aaya.";
}

function goAfterLogin(path = "index.html") {
  if (authRedirecting) return;
  authRedirecting = true;
  window.location.assign(new URL(path, window.location.href).href);
}

function setAuthStatus(message = "", type = "info") {
  const status = $("#auth-status");
  if (!status) return;
  status.className = `auth-status ${message ? `is-${type}` : ""}`;
  status.textContent = message;
}

function setFormBusy(form, busy, label) {
  if (!form) return;
  const submit = form.querySelector("button[type='submit']");
  if (!submit) return;
  if (!submit.dataset.defaultHtml) submit.dataset.defaultHtml = submit.innerHTML;
  submit.disabled = busy;
  form.setAttribute("aria-busy", String(busy));
  if (busy) submit.innerHTML = `<i data-lucide="LoaderCircle"></i><span>${label}</span>`;
  else submit.innerHTML = submit.dataset.defaultHtml;
  if (window.lucide) window.lucide.createIcons();
}

function setGoogleBusy(button, busy) {
  if (!button) return;
  if (!button.dataset.defaultHtml) button.dataset.defaultHtml = button.innerHTML;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  if (busy) button.innerHTML = `<i data-lucide="LoaderCircle"></i><span>Connecting...</span>`;
  else button.innerHTML = button.dataset.defaultHtml;
  if (window.lucide) window.lucide.createIcons();
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
    if (initialAuthStatePending && user && !authActionInFlight) {
      goAfterLogin("index.html");
    }
    initialAuthStatePending = false;
  });

  // A redirect login resolves after the browser returns to this page. Reading
  // the result here makes that flow explicit and surfaces redirect errors.
  getRedirectResult(auth)
    .then(async (result) => {
      if (!result?.user) return;
      authActionInFlight = true;
      await saveUser(result.user);
      setAuthStatus("Login successful. Opening your feed...", "success");
      goAfterLogin("index.html");
    })
    .catch((error) => {
      authActionInFlight = false;
      setGoogleBusy(googleButton, false);
      setAuthStatus(getAuthErrorMessage(error), "error");
    });

  switchers.forEach((button) => {
    button.addEventListener("click", () => {
      document.body.dataset.authMode = button.dataset.authSwitch;
      switchers.forEach((item) => item.setAttribute("aria-selected", String(item === button)));
      setAuthStatus("");
    });
  });

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-wrap")?.querySelector("input");
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      button.innerHTML = `<i data-lucide="${showing ? "Eye" : "EyeOff"}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });
  });

  $("#forgot-password")?.addEventListener("click", async () => {
    const email = String(loginForm?.elements.email?.value || "").trim();
    if (!email) {
      setAuthStatus("Pehle apna email enter karo.", "warning");
      loginForm?.elements.email?.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthStatus("Password reset link email par bhej diya gaya hai.", "success");
    } catch (error) {
      setAuthStatus(getAuthErrorMessage(error), "error");
    }
  });

  googleButton?.addEventListener("click", async () => {
    if (showAuthSetupIssue()) return;
    authActionInFlight = true;
    setGoogleBusy(googleButton, true);
    setAuthStatus("Google sign-in secure popup open kar raha hai...", "info");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUser(result.user);
      setAuthStatus("Login successful. Opening your feed...", "success");
      goAfterLogin("index.html");
    } catch (error) {
      if (["auth/popup-blocked", "auth/popup-timeout"].includes(error.code)) {
        setAuthStatus("Popup blocked hai. Secure redirect login start ho raha hai...", "warning");
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          authActionInFlight = false;
          setGoogleBusy(googleButton, false);
          setAuthStatus(getAuthErrorMessage(redirectError), "error");
        }
        return;
      }
      authActionInFlight = false;
      setGoogleBusy(googleButton, false);
      setAuthStatus(getAuthErrorMessage(error), "error");
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (showAuthSetupIssue()) return;
    const data = new FormData(loginForm);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!email || !password) {
      setAuthStatus("Email aur password dono required hain.", "warning");
      return;
    }
    authActionInFlight = true;
    setFormBusy(loginForm, true, "Logging in...");
    setAuthStatus("Checking your account...", "info");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveUser(result.user);
      setAuthStatus("Login successful. Opening your feed...", "success");
      goAfterLogin("index.html");
    } catch (error) {
      authActionInFlight = false;
      setFormBusy(loginForm, false);
      setAuthStatus(getAuthErrorMessage(error), "error");
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (showAuthSetupIssue()) return;
    const data = new FormData(registerForm);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!name || !email || password.length < 6) {
      setAuthStatus("Name, valid email aur 6+ character password required hain.", "warning");
      return;
    }
    authActionInFlight = true;
    setFormBusy(registerForm, true, "Creating account...");
    setAuthStatus("Creating your QuestionHub account...", "info");
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(result.user, { displayName: name });
      } catch (profileError) {
        console.warn("Display name update skipped:", profileError);
      }
      await saveUser(result.user);
      setAuthStatus("Account ready. Opening your profile...", "success");
      goAfterLogin("profile.html");
    } catch (error) {
      authActionInFlight = false;
      setFormBusy(registerForm, false);
      setAuthStatus(getAuthErrorMessage(error), "error");
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
