import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  serverTimestamp,
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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// 1. Create a Firebase web app at https://console.firebase.google.com
// 2. Enable Authentication providers: Google and Email/Password.
// 3. Create Firestore Database and Storage.
// 4. Replace this object with your Firebase config.
const firebaseConfig = {
  apiKey: "AIzaSyDeIGY5Kh7_ENy6AAdc523S67e-pIrqIWQ",
  authDomain: "questionhub-2aeee.firebaseapp.com",
  projectId: "questionhub-2aeee",
  storageBucket: "questionhub-2aeee.firebasestorage.app",
  messagingSenderId: "36839273395",
  appId: "1:36839273395:web:cc789d2afb118a2f1211c6",
  measurementId: "G-6MSPJZ26PG",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export {
  onAuthStateChanged,
  serverTimestamp,
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
  ref,
  uploadBytes,
  getDownloadURL,
};

export const firebaseReady =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

export function getFirebaseSetupIssue() {
  if (!firebaseReady) {
    return "Firebase config missing hai. js/firebase.js mein YOUR_* values ko apne Firebase Web App config se replace karo.";
  }
  if (location.protocol === "file:") {
    return "Login file:// se work nahi karega. Site ko local server se open karo: http://localhost:5173/login.html";
  }
  return "";
}
