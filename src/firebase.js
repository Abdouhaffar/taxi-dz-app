import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBIVg4BuL38sGZrcY4vrHLEbmwgVu1knlA",
  authDomain: "taxi-dz-ee993.firebaseapp.com",
  projectId: "taxi-dz-ee993",
  storageBucket: "taxi-dz-ee993.firebasestorage.app",
  messagingSenderId: "547448954066",
  appId: "1:547448954066:web:75185d79056a27b5eb610b",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
