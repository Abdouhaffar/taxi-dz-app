import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AdminApp from "./Admin";
import { TrackPage } from "./TripKit";
import { LegalPage } from "./Legal";
import { installErrorLogger } from "./ErrorLog";
installErrorLogger();

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
const legal = window.location.pathname.startsWith("/privacy") ? "privacy" : window.location.pathname.startsWith("/terms") ? "terms" : null;
root.render(legal ? <LegalPage kind={legal} /> : trackMatch ? <TrackPage token={trackMatch[1]} /> : isAdmin ? <AdminApp /> : <App />);
