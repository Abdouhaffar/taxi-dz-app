/* eslint-disable */
// زر اللغات المنسدل — أعلى اليسار دائماً، بنفس حركة زر المشاركة (يتفتّح على شكل قوس)
import { useState, useEffect, useRef } from "react";
const LANGS = [
  { code: "ar", flag: "🇩🇿", name: "العربية" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "en", flag: "🇬🇧", name: "English" },
];
export default function LangDropdown({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  const pick = (c) => { setLang(c); try { localStorage.setItem("taxidz_lang", c); } catch (e) {} setTimeout(() => setOpen(false), 180); };
  return (
    <div ref={ref} dir="ltr" style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: 12, zIndex: 9000, width: 40, height: 40 }}>
      {LANGS.filter((l) => l.code !== cur.code).concat([cur]).slice(0, 3).map((l, i) => {
        const idx = i; // موضع القوس
        const ang = (idx * 38 + 12) * Math.PI / 180; // ينتشر نحو الأسفل واليمين
        const r = 58;
        const x = Math.sin(ang) * r, y = Math.cos(ang) * r;
        const active = l.code === lang;
        return (
          <button key={l.code} aria-label={l.name} onClick={() => pick(l.code)}
            style={{
              position: "absolute", left: 0, top: 0, width: 40, height: 40, borderRadius: "50%", padding: 0, cursor: "pointer",
              border: active ? "2px solid #7c5cfc" : "none", background: "#fff", fontSize: 20,
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
              transform: open ? `translate(${x}px,${y}px) scale(1)` : "translate(0,0) scale(0.2)",
              opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
              transition: `transform .5s cubic-bezier(.34,1.56,.64,1) ${open ? i * 55 : 0}ms, opacity .25s ease ${open ? i * 55 : 0}ms`,
            }}>{l.flag}</button>
        );
      })}
      <button aria-label="language" onClick={() => setOpen(!open)}
        style={{
          position: "absolute", left: 0, top: 0, width: 40, height: 40, borderRadius: "50%", padding: 0, border: "none", cursor: "pointer",
          background: "#1e1b4b", color: "#fff", fontSize: 19, boxShadow: "0 6px 18px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
          transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .4s cubic-bezier(.34,1.3,.64,1)",
        }}>
        <span style={{ transform: open ? "rotate(-90deg)" : "none", transition: "transform .4s", display: "block" }}>{open ? "✕" : cur.flag}</span>
      </button>
    </div>
  );
}
