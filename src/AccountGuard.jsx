/* eslint-disable */
// منع الحسابات الموقوفة/المحظورة من استعمال التطبيق (يتحدّث لحظياً عند قرار الأدمن)
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const toDate = (t) => t?.toDate?.() || (t?.seconds ? new Date(t.seconds * 1000) : null);

export function useAccountBlock(col, uid) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, col, uid), (s) => setData(s.exists() ? s.data() : null), () => {});
  }, [col, uid]);
  const until = toDate(data?.suspendedUntil);
  // يعيد التقييم عند انتهاء مدة الإيقاف
  useEffect(() => {
    if (!until) return;
    const ms = until.getTime() - Date.now();
    if (ms <= 0 || ms > 2147483000) return;
    const t = setTimeout(() => setTick((x) => x + 1), ms + 500);
    return () => clearTimeout(t);
  }, [until?.getTime()]);
  const banned = data?.accountStatus === "banned";
  const suspended = data?.accountStatus === "suspended" && (!until || until > new Date());
  return { blocked: banned || suspended, banned, until, reason: data?.suspendReason || "" };
}

export function AccountBlockedScreen({ info, onLogout, lang = "ar" }) {
  const T = {
    ar: { tBan: "تم حظر حسابك", tSus: "تم إيقاف حسابك مؤقتاً", until: "ينتهي الإيقاف في", reason: "السبب", help: "إذا كنت ترى أن هذا خطأ، تواصل مع الدعم.", out: "تسجيل الخروج" },
    fr: { tBan: "Votre compte est banni", tSus: "Votre compte est suspendu", until: "Fin de la suspension", reason: "Motif", help: "Si vous pensez qu'il s'agit d'une erreur, contactez le support.", out: "Se déconnecter" },
    en: { tBan: "Your account is banned", tSus: "Your account is suspended", until: "Suspension ends", reason: "Reason", help: "If you think this is a mistake, contact support.", out: "Log out" },
  }[lang] || {};
  return (
    <div style={{ minHeight: "100vh", background: "#141012", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: lang === "ar" ? "rtl" : "ltr" }}>
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>{info.banned ? "⛔" : "⏸️"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, margin: "10px 0" }}>{info.banned ? T.tBan : T.tSus}</div>
        {info.until && !info.banned && <div style={{ fontSize: 14, color: "#ff8fa0", marginBottom: 8 }}>{T.until}: <b>{info.until.toLocaleString(lang === "ar" ? "ar-DZ" : lang)}</b></div>}
        {info.reason && <div style={{ background: "#201a1d", border: "1px solid #3a2a2f", borderRadius: 14, padding: 14, fontSize: 14, margin: "14px 0", lineHeight: 1.7 }}><div style={{ fontSize: 11, color: "#c7a9ae", marginBottom: 4 }}>{T.reason}</div>{info.reason}</div>}
        <div style={{ fontSize: 12, color: "#c7a9ae", marginBottom: 20 }}>{T.help}</div>
        <button onClick={onLogout} style={{ background: "#c4001d", border: "none", color: "#fff", borderRadius: 14, padding: "13px 30px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{T.out}</button>
      </div>
    </div>
  );
}
