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

// شاشة خطأ مفهومة بدل الصفحة البيضاء (تعرض نص الخطأ ليسهل إصلاحه)
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error("UI crash:", err, info?.componentStack); } catch (e) {} }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String(this.state.err?.message || this.state.err).slice(0, 400);
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f4f2ff", fontFamily: "system-ui,sans-serif", direction: "rtl" }}>
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#1e1b4b", margin: "10px 0" }}>حدث خطأ غير متوقع</div>
          <div style={{ fontSize: 13, color: "#6b6a8f", marginBottom: 14 }}>أعد تحميل الصفحة، وإن تكرر فأرسل لقطة لهذه الشاشة للدعم.</div>
          <div dir="ltr" style={{ fontSize: 11, color: "#a3a1c2", background: "#fff", borderRadius: 10, padding: 10, marginBottom: 14, wordBreak: "break-word", textAlign: "left" }}>{msg}</div>
          <button onClick={() => { try { navigator.serviceWorker?.getRegistrations().then(r => r.forEach(x => x.unregister())); caches?.keys().then(k => k.forEach(c => caches.delete(c))); } catch (e) {} window.location.reload(); }} style={{ background: "#7c5cfc", color: "#fff", border: "none", borderRadius: 14, padding: "12px 28px", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>إعادة التحميل</button>
        </div>
      </div>
    );
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
const legal = window.location.pathname.startsWith("/privacy") ? "privacy" : window.location.pathname.startsWith("/terms") ? "terms" : null;
const tree = (legal ? <LegalPage kind={legal} /> : trackMatch ? <TrackPage token={trackMatch[1]} /> : isAdmin ? <AdminApp /> : <App />);
root.render(<ErrorBoundary>{tree}</ErrorBoundary>);
