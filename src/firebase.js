import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// FCM Messaging
let messaging = null;
try {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    messaging = getMessaging(app);
  }
} catch (e) {
  console.log("FCM not supported:", e);
}

export { messaging };

// VAPID Key
const VAPID_KEY = "BFbJyYleI208_wa3mLhq9OKPrCLnJXLz_WKjgpmn7PCm-FASBOHi1YRfddJS00WwzhlzM7jgoRcYUHSVySOVb8I";

// طلب إذن الإشعارات والحصول على FCM Token
export const requestNotificationPermission = async () => {
  try {
    if (!messaging) return null;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("❌ الإشعارات غير مسموح بها");
      return null;
    }
    // تسجيل Service Worker
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    console.log("✅ FCM Token:", token);
    return token;
  } catch (e) {
    console.log("FCM Token error:", e);
    return null;
  }
};

// استقبال الإشعارات في المقدمة
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
