// نظام الألوان: فاتح (افتراضي) / داكن (mode sombre) — يتبع إعداد الهاتف تلقائياً مع زر تبديل يدوي
import { useState, useEffect } from "react";

const LIGHT = {
  bg: "#f4f2ff", page: "linear-gradient(160deg,#f3f0ff 0%,#fbf0f8 55%,#fff3ee 100%)", card: "#ffffff", soft: "#f1eefc", dark: "#1e1b4b",
  green: "#7c5cfc", greenDark: "#5b3fe6", greenLight: "#efeaff",
  orange: "#ff7a45", orangeLight: "#fff0e8", orangeDark: "#d9541c",
  red: "#ef4444", redLight: "#fef0f0",
  blue: "#1e1b4b", blueLight: "#efeaff", googleBlue: "#1e1b4b",
  yellow: "#f59e0b", yellowLight: "#fff6e0",
  gold: "#f5a623", goldLight: "#fff6e0",
  ok: "#16a34a", okLight: "#e8f8ee",
  text: "#1e1b4b", textMuted: "#6b6a8f", textLight: "#a3a1c2",
  border: "#e7e4fa", shadow: "0 4px 22px rgba(91,63,230,0.10)",
  brand: "linear-gradient(160deg,#1e1b4b 0%,#4c3bd6 48%,#8b5cf6 76%,#ec4899 100%)",
  grad: "linear-gradient(135deg,#8a6bff 0%,#6a47f0 100%)",
};
const DARK = {
  bg: "#0d0b1f", page: "#0d0b1f", card: "#17142e", soft: "#211d42", dark: "#7c5cfc",
  green: "#8d72ff", greenDark: "#6f52f5", greenLight: "#8d72ff26",
  orange: "#ff8a5c", orangeLight: "#ff8a5c22", orangeDark: "#ff6a33",
  red: "#f87171", redLight: "#f8717122",
  blue: "#c9c2ff", blueLight: "#8d72ff1f", googleBlue: "#c9c2ff",
  yellow: "#fbbf24", yellowLight: "#fbbf2422",
  gold: "#fbbf24", goldLight: "#fbbf2422",
  ok: "#34d399", okLight: "#34d39922",
  text: "#f1efff", textMuted: "#a19fc7", textLight: "#7d7aa6",
  border: "#2b2750", shadow: "0 6px 26px rgba(0,0,0,0.45)",
  brand: "linear-gradient(160deg,#0d0b1f 0%,#2a2170 48%,#6d4aff 78%,#c026d3 100%)",
  grad: "linear-gradient(135deg,#9a80ff 0%,#6f52f5 100%)",
};

// كائنات حيّة: تُعدَّل في مكانها عند تغيير الوضع، فتقرؤها كل الشاشات عند إعادة الرسم
export const C = { ...LIGHT };   // تطبيق الراكب وبقية الشاشات
export const DC = { ...LIGHT };  // لوحة السائق (نفس الألوان)
export let MODE = "light";

const KEY = "taxidz_theme"; // "auto" | "light" | "dark"
const safe = (f, d) => { try { return f(); } catch (e) { return d; } };
export const storedPref = () => safe(() => localStorage.getItem(KEY), null) || "auto";
const systemDark = () => safe(() => window.matchMedia("(prefers-color-scheme: dark)").matches, false);
export const resolve = (pref) => (pref === "dark" || (pref === "auto" && systemDark()) ? "dark" : "light");

export function applyTheme(mode) {
  MODE = mode;
  const P = mode === "dark" ? DARK : LIGHT;
  Object.assign(C, P); Object.assign(DC, P);
  safe(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.body.style.background = P.page;
    document.body.style.color = P.text;
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.content = P.bg;
  });
}
applyTheme(resolve(storedPref())); // قبل أول رسم لتفادي الوميض

// hook للجذر: يعيد { mode, pref, setPref } ويُعيد رسم التطبيق عند التغيير
export function useThemeMode() {
  const [pref, setPrefState] = useState(storedPref());
  const [mode, setMode] = useState(MODE);
  useEffect(() => {
    const m = resolve(pref); applyTheme(m); setMode(m);
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => { const x = resolve("auto"); applyTheme(x); setMode(x); };
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, [pref]);
  const setPref = (p) => { safe(() => localStorage.setItem(KEY, p)); setPrefState(p); };
  return { mode, pref, setPref };
}

// زر تبديل الوضع (شمس / قمر) — يوضع بجانب زر اللغات
export function themeIcon(mode) { return mode === "dark" ? "☀️" : "🌙"; }
