import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, requestNotificationPermission, onForegroundMessage } from "./firebase";

// استيراد المكونات الرئيسية للتطبيق
import PassengerApp from "./PassengerApp";
import DriverApp from "./DriverApp"; // افترضنا وجود المكون الخاص بالسائق
import AuthScreen from "./AuthScreen"; // شاشة تسجيل الدخول

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState("ar");

  // 1. الاستماع لحالة تسجيل الدخول جلب بيانات المستخدم
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            
            // طلب إذن الإشعارات وتحديث FCM Token في Firestore
            const fcmToken = await requestNotificationPermission();
            if (fcmToken) {
              await updateDoc(doc(db, "users", currentUser.uid), {
                fcmToken: fcmToken
              });
            }
          }
        } catch (error) {
          console.error("خطأ في جلب بيانات المستخدم:", error);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. الاستماع للإشعارات أثناء استخدام التطبيق (Foreground)
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log("إشعار جديد تم استقباله:", payload);
      if (payload?.notification) {
        alert(`🔔 ${payload.notification.title}\n${payload.notification.body}`);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // 3. تغيير اللغة
  const toggleLanguage = () => {
    setLang((prev) => (prev === "ar" ? "fr" : "ar"));
  };

  // 4. تسجيل الخروج
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("خطأ أثناء تسجيل الخروج:", error);
    }
  };

  // شاشة التحميل (Loading)
  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", justifyContent: "center", alignItems: "center", background: "#0a0f1d", color: "#fff", fontFamily: "Cairo, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
          <div>جاري التحميل...</div>
        </div>
      </div>
    );
  }

  // إذا لم يكن المستخدم مسجلاً لدخوله
  if (!user) {
    return <AuthScreen lang={lang} onToggleLang={toggleLanguage} />;
  }

  // التوجيه بناءً على نوع حساب المستخدم (راكب أم سائق)
  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0a0f1d" }}>
      {userData?.role === "driver" ? (
        <DriverApp user={user} userData={userData} lang={lang} onLogout={handleLogout} />
      ) : (
        <PassengerApp user={user} userData={userData} lang={lang} onLogout={handleLogout} />
      )}
    </div>
  );
}
