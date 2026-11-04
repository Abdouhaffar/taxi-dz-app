/* eslint-disable */
// مكوّنات مشتركة بين تطبيق الراكب وتطبيق السائق:
//  - ShareButton : زر مشاركة متحرّك (يتحول إلى دائرة وتنتشر منه أيقونات المشاركة)
//  - TierProgress : مستوى الإحالة وتقدّمه
//  - referralPerInvite : نقاط كل دعوة حسب ترتيبها (يجب أن تطابق دالة Firebase)
import { useState, useRef, useEffect } from "react";

const RED = "#c4001d";
const DARK = "#1c1a1d";

// ===== نظام النقاط: كلما زاد عدد المدعوين زادت نقاط كل دعوة =====
export const REFERRAL_BONUSES = { 5: 50, 15: 150, 30: 400 }; // مكافأة إضافية عند بلوغ العدد
export const REFERRAL_WELCOME = 20;                           // هدية المدعو الجديد
export function referralPerInvite(n) {                        // n = ترتيب الدعوة (1، 2، 3...)
  return n >= 30 ? 60 : n >= 15 ? 50 : n >= 5 ? 40 : 30;
}
export const REFERRAL_LEVELS = [
  { from: 0,  ar: "برونزي",  fr: "Bronze",   en: "Bronze",   per: 30 },
  { from: 5,  ar: "فضي",     fr: "Argent",   en: "Silver",   per: 40 },
  { from: 15, ar: "ذهبي",    fr: "Or",       en: "Gold",     per: 50 },
  { from: 30, ar: "بلاتيني", fr: "Platine",  en: "Platinum", per: 60 },
];
export function referralLevel(count) {
  let idx = 0;
  REFERRAL_LEVELS.forEach((l, i) => { if (count >= l.from) idx = i; });
  return { idx, level: REFERRAL_LEVELS[idx], next: REFERRAL_LEVELS[idx + 1] || null };
}

// ===== رسالة المشاركة =====
export function buildShare(code, lang = "ar") {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://alburaq-dz.vercel.app";
  const link = `${origin}/?ref=${encodeURIComponent(code)}`;
  const text =
    lang === "fr" ? `Rejoignez AL-BURAQ 🚕 avec mon code ${code} et gagnez des points ! ${link}` :
    lang === "en" ? `Join AL-BURAQ 🚕 with my code ${code} and earn points! ${link}` :
    `انضم لتطبيق البراق للتاكسي 🚕 واستعمل كودي ${code} عند التسجيل لتحصل على نقاط! ${link}`;
  return { link, text };
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
  } catch (e) { return false; }
}

// ===== الأيقونات =====
const Ico = {
  whatsapp: (
    <svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="#25D366" />
      <path d="M12 4.6a7.4 7.4 0 0 0-6.4 11.1L4.7 19.3l3.7-.9A7.4 7.4 0 1 0 12 4.6z" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M9.3 8.6c.3 2.2 3.1 5.1 5.4 5.4l1.2-1.2-1.7-1-.9.7c-.8-.3-1.7-1.2-2-2l.7-.9-1-1.7-1.7.7z" fill="#fff" /></svg>
  ),
  messenger: (
    <svg viewBox="0 0 24 24" width="28" height="28"><defs><linearGradient id="msgr" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0099ff" /><stop offset="1" stopColor="#a033ff" /></linearGradient></defs>
      <circle cx="12" cy="12" r="12" fill="url(#msgr)" />
      <path d="M12 5C8.1 5 5.2 7.8 5.2 11.4c0 1.9.8 3.6 2.3 4.7V19l2.5-1.4c.6.2 1.3.3 2 .3 3.9 0 6.8-2.8 6.8-6.5S15.9 5 12 5z" fill="#fff" />
      <path d="M8 13.4l2.6-3.4 2 1.7 2.4-1.7-2.6 3.5-2-1.7z" fill="#7a3cff" /></svg>
  ),
  sms: (
    <svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="#1c1a1d" />
      <path d="M6 7.5h12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 18 16.5h-6.3L8 19v-2.5H6A1.5 1.5 0 0 1 4.5 15V9A1.5 1.5 0 0 1 6 7.5z" fill="#fff" />
      <circle cx="9" cy="12" r="1" fill="#1c1a1d" /><circle cx="12" cy="12" r="1" fill="#1c1a1d" /><circle cx="15" cy="12" r="1" fill="#1c1a1d" /></svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="#fff" />
      <circle cx="7" cy="12" r="1.8" fill="#1c1a1d" /><circle cx="12" cy="12" r="1.8" fill="#1c1a1d" /><circle cx="17" cy="12" r="1.8" fill="#1c1a1d" /></svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1c1a1d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" strokeDashoffset="24" style={{ animation: "shChk 0.4s ease forwards" }} /></svg>
  ),
};

const LABELS = {
  ar: { share: "مشاركة الكود", pick: "اختر وسيلة المشاركة", whatsapp: "واتساب", messenger: "ماسنجر", sms: "SMS", more: "المزيد", copy: "نسخ", copying: "جارٍ النسخ…", copied: "تم النسخ ✓" },
  fr: { share: "Partager le code", pick: "Choisissez un canal", whatsapp: "WhatsApp", messenger: "Messenger", sms: "SMS", more: "Plus", copy: "Copier", copying: "Copie…", copied: "Copié ✓" },
  en: { share: "Share code", pick: "Pick a channel", whatsapp: "WhatsApp", messenger: "Messenger", sms: "SMS", more: "More", copy: "Copy", copying: "Copying…", copied: "Copied ✓" },
};

// مواضع الأيقونات (x,y) بالنسبة لمركز الزر — قوس مثل الفيديو
const POS = { whatsapp: [0, -104], messenger: [-76, -66], sms: [76, -66], more: [-116, -2], copy: [116, -2] };
const ORDER = ["whatsapp", "messenger", "sms", "more", "copy"];

export function ShareButton({ code, lang = "ar", accent = DARK, labelColor = "#6b5a5f" }) {
  const L = LABELS[lang] || LABELS.ar;
  const [stage, setStage] = useState("idle"); // idle | open | copying | copied
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  const open = stage !== "idle";
  const busy = stage === "copying" || stage === "copied";
  const { link, text } = buildShare(code, lang);

  const close = () => setStage("idle");

  const act = async (id) => {
    if (busy) return;
    if (id === "copy") {
      setStage("copying");
      const ok = await copyText(text);
      later(() => setStage("copied"), 750);
      later(() => setStage("idle"), 2500);
      return ok;
    }
    if (id === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    else if (id === "messenger") window.location.href = `fb-messenger://share/?link=${encodeURIComponent(link)}`;
    else if (id === "sms") window.location.href = `sms:?body=${encodeURIComponent(text)}`;
    else if (id === "more") {
      if (navigator.share) { try { await navigator.share({ title: "AL-BURAQ", text, url: link }); } catch (e) {} }
      else { await copyText(text); }
    }
    later(close, 350);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: open ? 196 : 56, transition: "height .5s cubic-bezier(.34,1.3,.64,1)", direction: "ltr", userSelect: "none" }}>
      <style>{`@keyframes shChk{to{stroke-dashoffset:0}} @keyframes shSpin{to{transform:rotate(360deg)}}`}</style>

      {/* أيقونات القوس */}
      {ORDER.map((id, i) => {
        const [x, y] = POS[id];
        const isCopy = id === "copy";
        const hidden = !open || (busy && !isCopy);
        const [cx, cy] = busy && !isCopy ? POS.copy : [x, y];
        const copyBg = stage === "copied" ? RED : stage === "copying" ? DARK : "#fff";
        return (
          <button key={id} aria-label={L[id]} onClick={() => act(id)}
            style={{
              position: "absolute", left: "50%", bottom: 22 + 28 - 26, marginLeft: -26, width: 52, height: 52, padding: 0,
              borderRadius: "50%", border: "none", cursor: open ? "pointer" : "default",
              background: isCopy ? copyBg : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              transform: hidden ? `translate(${cx}px,${cy}px) scale(0.2)` : `translate(${cx}px,${cy}px) scale(1)`,
              opacity: hidden ? 0 : 1, pointerEvents: open && !busy ? "auto" : "none",
              transition: `transform .55s cubic-bezier(.34,1.56,.64,1) ${open && !busy ? i * 55 : 0}ms, opacity .3s ease ${open && !busy ? i * 55 : 0}ms, background .3s`,
            }}>
            {isCopy
              ? (stage === "copying"
                  ? <span style={{ width: 20, height: 20, border: "2.5px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "block", animation: "shSpin .7s linear infinite" }} />
                  : stage === "copied" ? Ico.check : Ico.copy)
              : Ico[id]}
          </button>
        );
      })}

      {/* وسوم النص تحت الأيقونات */}
      {ORDER.map((id) => {
        const [x, y] = POS[id];
        const hide = !open || (busy && id !== "copy");
        return (
          <div key={"l" + id} style={{
            position: "absolute", left: "50%", bottom: 22 + 28 - 26 - 17, marginLeft: -35, width: 70, textAlign: "center",
            fontSize: 10.5, fontWeight: 700, color: labelColor, pointerEvents: "none",
            transform: `translate(${(busy && id === "copy") ? x : x}px,${y}px)`, opacity: hide ? 0 : 1,
            transition: "opacity .3s ease .35s",
          }}>{id === "copy" && stage === "copying" ? L.copying : id === "copy" && stage === "copied" ? L.copied : L[id]}</div>
        );
      })}

      {/* الزر الرئيسي: شريحة → دائرة */}
      <button onClick={() => (open ? (busy ? null : close()) : setStage("open"))}
        style={{
          position: "absolute", left: "50%", bottom: open ? 22 : 0, height: 56, width: open ? 56 : "100%",
          transform: "translateX(-50%)", borderRadius: 28, border: "none", cursor: "pointer",
          background: accent, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden",
          boxShadow: "0 8px 22px rgba(0,0,0,0.25)", opacity: busy ? 0.35 : 1,
          transition: "width .45s cubic-bezier(.77,0,.18,1), bottom .5s cubic-bezier(.34,1.3,.64,1), opacity .3s",
        }}>
        <span style={{ position: "absolute", whiteSpace: "nowrap", opacity: open ? 0 : 1, transition: "opacity .2s", display: "flex", alignItems: "center", gap: 8 }}>📤 {L.share}</span>
        <span style={{ position: "absolute", fontSize: 20, opacity: open ? 1 : 0, transition: "opacity .25s .2s" }}>✕</span>
      </button>

      {/* "اختر وسيلة المشاركة" */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -2, textAlign: "center", fontSize: 11.5, fontWeight: 700, color: labelColor, opacity: open && !busy ? 1 : 0, transition: "opacity .3s ease .4s", pointerEvents: "none" }}>{L.pick}</div>
    </div>
  );
}

// ===== مستوى الإحالة وتقدّمه =====
export function TierProgress({ count = 0, lang = "ar", dark = false }) {
  const { idx, level, next } = referralLevel(count);
  const T = dark ? { text: "#fff", muted: "#c7a9ae", track: "#3a2a2f", bg: "#201a1d", border: "#3a2a2f" } : { text: "#1c1a1d", muted: "#7a6268", track: "#e9e2e4", bg: "#fff", border: "#eee" };
  const nm = level[lang] || level.ar;
  const nextOrdinal = count + 1;
  const nextPts = referralPerInvite(nextOrdinal) + (REFERRAL_BONUSES[nextOrdinal] || 0);
  const span = next ? next.from - level.from : 1;
  const pct = next ? Math.min(100, Math.round(((count - level.from) / span) * 100)) : 100;
  const remaining = next ? next.from - count : 0;
  const nextMilestone = Object.keys(REFERRAL_BONUSES).map(Number).find(m => m > count);
  const t = {
    ar: { lvl: "مستواك", per: "نقطة لكل صديق", nextIn: `ادعُ ${remaining} آخرين لتصل إلى المستوى ${next ? (next.ar) : ""}`, top: "🏆 أعلى مستوى — استمر في الدعوة!", bonus: (m) => `مكافأة +${REFERRAL_BONUSES[m]} نقطة عند الوصول إلى ${m} دعوات`, friend: `صديقك يحصل على ${REFERRAL_WELCOME} نقطة هدية` },
    fr: { lvl: "Niveau", per: "pts par ami", nextIn: `Parrainez ${remaining} de plus pour atteindre ${next ? next.fr : ""}`, top: "🏆 Niveau maximum !", bonus: (m) => `Bonus +${REFERRAL_BONUSES[m]} pts à ${m} parrainages`, friend: `Votre ami reçoit ${REFERRAL_WELCOME} pts` },
    en: { lvl: "Level", per: "pts per friend", nextIn: `Invite ${remaining} more to reach ${next ? next.en : ""}`, top: "🏆 Top level!", bonus: (m) => `Bonus +${REFERRAL_BONUSES[m]} pts at ${m} invites`, friend: `Your friend gets ${REFERRAL_WELCOME} pts` },
  }[lang] || null;
  const tt = t || { lvl: "", per: "", nextIn: "", top: "", bonus: () => "", friend: "" };
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: T.muted }}>{tt.lvl}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{["🥉", "🥈", "🥇", "💎"][idx]} {nm}</div>
        </div>
        <div style={{ textAlign: "center", background: RED, color: "#fff", borderRadius: 14, padding: "8px 14px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>+{nextPts}</div>
          <div style={{ fontSize: 10, opacity: 0.9, marginTop: 3 }}>{tt.per}</div>
        </div>
      </div>
      <div style={{ height: 10, background: T.track, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${RED},#ff5a70)`, borderRadius: 6, transition: "width .8s cubic-bezier(.2,.8,.2,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginTop: 8 }}>
        <span>{count} / {next ? next.from : count}</span>
        <span>{next ? tt.nextIn : tt.top}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {REFERRAL_LEVELS.map((l, i) => (
          <div key={i} style={{ flex: "1 1 22%", textAlign: "center", padding: "6px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: i === idx ? DARK : "transparent", color: i === idx ? "#fff" : T.muted, border: `1px solid ${i === idx ? DARK : T.border}` }}>
            {l[lang] || l.ar}<div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>{l.per}</div>
          </div>
        ))}
      </div>
      {nextMilestone && <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>🎁 {tt.bonus(nextMilestone)}</div>}
      <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>👥 {tt.friend}</div>
    </div>
  );
}
