import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AdminApp from "./Admin";
import { TrackPage } from "./TripKit";

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
const trackMatch = window.location.pathname.match(/^\/track\/([A-Za-z0-9]+)/);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(trackMatch ? <TrackPage token={trackMatch[1]} /> : isAdmin ? <AdminApp /> : <App />);
