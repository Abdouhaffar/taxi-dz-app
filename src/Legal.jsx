/* eslint-disable */
// الصفحات القانونية (/privacy و /terms) + زر الدعم + شريط انقطاع الإنترنت
import { C } from "./Theme";
import { useState, useEffect } from "react";

// ضع بيانات الدعم الحقيقية في Vercel → Environment Variables (لا تُكتب في الكود)
const SUPPORT_PHONE = process.env.REACT_APP_SUPPORT_PHONE || "";   // مثال: 213555123456 (بدون + أو أصفار)
const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "";
const FONT = "'IBM Plex Sans Arabic',Cairo,system-ui,sans-serif";
import { DOCS, UPDATED } from "./LegalText";

export function LegalPage({ kind = "privacy", onClose = null }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("taxidz_lang") || "ar"; } catch (e) { return "ar"; } });
  const d = (DOCS[kind] || DOCS.privacy)[lang] || DOCS[kind].ar;
  const rtl = lang === "ar";
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT, direction: rtl ? "rtl" : "ltr" }}>
      <div style={{ background: C.dark, color: "#fff", padding: "calc(env(safe-area-inset-top,0px) + 18px) 20px 22px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 800, letterSpacing: 2 }}>AL-BURAQ</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{d.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["ar", "fr", "en"].map((l) => <button key={l} onClick={() => { setLang(l); try { localStorage.setItem("taxidz_lang", l); } catch (e) {} }} style={{ background: lang === l ? C.green : "#ffffff22", color: "#fff", border: "none", borderRadius: 10, padding: "6px 10px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 60px" }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{rtl ? "آخر تحديث" : "Updated"}: {UPDATED}</div>
        {d.sections.map(([h, b], i) => (
          <div key={i} style={{ background: C.card, borderRadius: 18, padding: "16px 18px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: C.text, marginBottom: 6 }}>{i + 1}. {h}</div>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: C.text, whiteSpace: "pre-line" }}>{b}</div>
          </div>
        ))}
        {(SUPPORT_EMAIL || SUPPORT_PHONE) && <div style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 10 }}>{SUPPORT_EMAIL}{SUPPORT_EMAIL && SUPPORT_PHONE ? " · " : ""}{SUPPORT_PHONE ? "+" + SUPPORT_PHONE : ""}</div>}
        <div style={{ textAlign: "center", marginTop: 18 }}>{onClose ? <button onClick={onClose} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 14, padding: "12px 28px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>{rtl ? "رجوع" : lang === "fr" ? "Retour" : "Back"}</button> : <a href="/" style={{ color: C.green, fontWeight: 800, textDecoration: "none" }}>← AL-BURAQ</a>}</div>
      </div>
    </div>
  );
}

export function openLegal(kind) { try { window.dispatchEvent(new CustomEvent("open-legal", { detail: kind })); } catch (e) { window.location.href = "/" + kind; } }

// طبقة تعرض الصفحة القانونية داخل التطبيق (تعمل حتى دون مسار خاص)
export function LegalOverlay() {
  const [kind, setKind] = useState(null);
  useEffect(() => { const h = (e) => setKind(e.detail); window.addEventListener("open-legal", h); return () => window.removeEventListener("open-legal", h); }, []);
  if (!kind) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 100000, overflowY: "auto", background: C.bg }}><LegalPage kind={kind} onClose={() => setKind(null)} /></div>;
}

export function LegalLinks({ lang = "ar", dark = true }) {
  const L = { ar: ["سياسة الخصوصية", "شروط الاستخدام"], fr: ["Confidentialité", "Conditions"], en: ["Privacy", "Terms"] }[lang] || [];
  const st = { color: dark ? "#ffffffaa" : C.textMuted, fontSize: 11, textDecoration: "underline", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", padding: 4 };
  return <div style={{ display: "flex", gap: 14, justifyContent: "center", padding: "10px 0" }}><button onClick={() => openLegal("privacy")} style={st}>{L[0]}</button><button onClick={() => openLegal("terms")} style={st}>{L[1]}</button></div>;
}

// زر دعم عائم: واتساب إن ضُبط الرقم، وإلا بريد
export function SupportButton({ lang = "ar", context = "" }) {
  if (!SUPPORT_PHONE && !SUPPORT_EMAIL) return null;
  const msg = encodeURIComponent((lang === "ar" ? "مرحباً، أحتاج مساعدة في AL-BURAQ" : "Hello, I need help with AL-BURAQ") + (context ? ` (${context})` : ""));
  const href = SUPPORT_PHONE ? `https://wa.me/${SUPPORT_PHONE}?text=${msg}` : `mailto:${SUPPORT_EMAIL}?subject=${msg}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label="support" style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom,0px) + 14px)", left: 14, zIndex: 40, width: 44, height: 44, borderRadius: "50%", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,.28)", textDecoration: "none", fontSize: 22 }}>💬</a>
  );
}

export function OfflineBanner({ lang = "ar" }) {
  const [off, setOff] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const a = () => setOff(true), b = () => setOff(false);
    window.addEventListener("offline", a); window.addEventListener("online", b);
    return () => { window.removeEventListener("offline", a); window.removeEventListener("online", b); };
  }, []);
  if (!off) return null;
  const t = { ar: "لا يوجد اتصال بالإنترنت — سيعود التطبيق للعمل تلقائياً", fr: "Pas de connexion Internet — reprise automatique", en: "No internet connection — will resume automatically" }[lang] || "";
  return <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99995, background: C.dark, color: "#fff", textAlign: "center", fontSize: 12.5, fontWeight: 700, padding: "calc(env(safe-area-inset-top,0px) + 8px) 12px 8px", fontFamily: FONT }}>📡 {t}</div>;
}
