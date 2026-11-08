/* eslint-disable */
// مراقبة الأخطاء بدون خدمة خارجية: تُسجَّل الأخطاء غير المعالجة في Firestore (client_errors) لتراها في Firebase Console
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

const VERSION = "v2.6";
let sent = 0;
const seen = new Set();
function report(kind, message, stack) {
  try {
    const msg = String(message || "").slice(0, 300);
    const key = kind + msg;
    if (sent >= 8 || seen.has(key) || !auth.currentUser) return; // حدّ أقصى 8 لكل جلسة، بلا تكرار، لمستخدم مسجّل فقط
    if (/ResizeObserver|Script error|Loading chunk|network|Failed to fetch/i.test(msg)) return;
    seen.add(key); sent++;
    addDoc(collection(db, "client_errors"), {
      kind, message: msg, stack: String(stack || "").slice(0, 800),
      url: location.pathname, ua: (navigator.userAgent || "").slice(0, 160),
      uid: auth.currentUser.uid, v: VERSION, at: serverTimestamp(),
    }).catch(() => {});
  } catch (e) {}
}
export function installErrorLogger() {
  window.addEventListener("error", (e) => report("error", e.message, e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => report("promise", e.reason?.message || e.reason, e.reason?.stack));
}
