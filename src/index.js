import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AdminApp from "./Admin";

// تسجيل مبكر لـ service worker الخاص بالإشعارات (FCM)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .catch((e) => console.error("SW registration failed:", e));
  });
}

// /admin → لوحة الإدارة ، وأي مسار آخر → التطبيق
const isAdmin = window.location.pathname.startsWith("/admin");

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(isAdmin ? <AdminApp /> : <App />);
