/* eslint-disable */
// إعلانات مباشرة (صورة أو فيديو قصير) تُعرض للراكب أثناء انتظار السائق فقط — لا تُعرض للسائق أبداً
import { useEffect, useState } from "react";
import { collection, query, where, limit, getDocs, getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

const dayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
export const ytId = (u) => { const m = String(u || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; };
export const safeLink = (u) => { const s = String(u || "").trim(); return /^https:\/\/[^\s]+$/i.test(s) ? s : ""; };
const ms = (v) => (v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : null);
const TXT = {
  ar: { ad: "إعلان", more: "تفاصيل", skip: "تخطي", skipIn: "تخطي بعد", report: "إبلاغ عن الإعلان", reported: "شكراً، تم إبلاغ الإدارة", hide: "إخفاء" },
  fr: { ad: "Annonce", more: "Détails", skip: "Passer", skipIn: "Passer dans", report: "Signaler cette annonce", reported: "Merci, l'administration est informée", hide: "Masquer" },
  en: { ad: "Ad", more: "Details", skip: "Skip", skipIn: "Skip in", report: "Report this ad", reported: "Thanks, admin notified", hide: "Hide" },
};

async function logEvent(adId, type) {
  const uid = auth.currentUser?.uid; if (!uid || !adId) return;
  const day = dayKey();
  try { await setDoc(doc(db, "ad_events", `${adId}_${type}_${uid}_${day}`), { adId, type, uid, day, ts: serverTimestamp() }); } catch (e) {}
}

export function AdSlot({ lang = "ar", wilaya }) {
  const t = TXT[lang] || TXT.ar;
  const [ad, setAd] = useState(null);
  const [img, setImg] = useState("");
  const [hidden, setHidden] = useState(false);
  const [left, setLeft] = useState(5);
  const [rep, setRep] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const s = await getDocs(query(collection(db, "ads"), where("status", "==", "approved"), where("active", "==", true), limit(12)));
        const now = Date.now();
        let list = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => {
          const st = ms(a.startsAt), en = ms(a.endsAt);
          if (st && st > now) return false; if (en && en < now) return false;
          const c = a.cities || []; return c.length === 0 || c.includes("all") || (wilaya && c.includes(String(wilaya)));
        });
        if (!list.length) return;
        let seen = []; try { seen = JSON.parse(sessionStorage.getItem("taxidz_ads_seen") || "[]"); } catch (e) {}
        const fresh = list.filter((a) => !seen.includes(a.id));
        const pool = fresh.length ? fresh : list;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        let data = "";
        if (pick.kind === "image" && pick.mediaRef) { const m = await getDoc(doc(db, "ad_media", pick.mediaRef)); data = m.exists() ? m.data().data || "" : ""; }
        if (dead) return;
        setImg(data || pick.mediaUrl || ""); setAd(pick);
        try { sessionStorage.setItem("taxidz_ads_seen", JSON.stringify([...seen, pick.id].slice(-30))); } catch (e) {}
        logEvent(pick.id, "view");
      } catch (e) {}
    })();
    return () => { dead = true; };
  }, [wilaya]);

  const isVideo = ad?.kind === "video";
  useEffect(() => {
    if (!ad || !isVideo) return;
    const i = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(i);
  }, [ad, isVideo]);

  if (!ad || hidden) return null;
  const link = safeLink(ad.link), yt = isVideo ? ytId(ad.mediaUrl) : null;
  const canClose = !isVideo || left === 0;
  const open = () => { logEvent(ad.id, "click"); window.open(link, "_blank", "noopener,noreferrer"); };
  const report = async () => { try { await setDoc(doc(db, "ad_reports", `${ad.id}_${auth.currentUser?.uid}`), { adId: ad.id, uid: auth.currentUser?.uid, ts: serverTimestamp() }); } catch (e) {} setRep(true); };
  const box = { position: "relative", borderRadius: 16, overflow: "hidden", background: "rgba(127,127,127,.08)", border: "1px solid rgba(127,127,127,.22)", fontFamily: "inherit" };
  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", fontSize: 11, opacity: .85 }}>
        <span style={{ fontWeight: 800, background: "rgba(127,127,127,.2)", borderRadius: 6, padding: "2px 8px" }}>{t.ad}</span>
        <button onClick={() => (canClose ? setHidden(true) : null)} disabled={!canClose} style={{ background: "none", border: "none", color: "inherit", cursor: canClose ? "pointer" : "default", fontFamily: "inherit", fontSize: 12, fontWeight: 700, opacity: canClose ? 1 : .6 }}>
          {canClose ? (isVideo ? t.skip : "✕ " + t.hide) : `${t.skipIn} ${left}`}
        </button>
      </div>
      <div onClick={link && !isVideo ? open : undefined} style={{ cursor: link && !isVideo ? "pointer" : "default" }}>
        {isVideo ? (
          yt ? <iframe title="ad" src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1`} allow="autoplay; encrypted-media" style={{ width: "100%", height: 190, border: 0, display: "block", background: "#000" }} />
            : <video src={ad.mediaUrl} muted autoPlay playsInline controls={false} style={{ width: "100%", maxHeight: 220, display: "block", background: "#000" }} />
        ) : img ? <img src={img} alt={ad.title || ""} style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} /> : null}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        {ad.title && <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{ad.title}</div>}
        {ad.advertiser && <div style={{ fontSize: 11, opacity: .7 }}>{ad.advertiser}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
          {link ? <button onClick={open} style={{ background: "#16a34a", border: "none", color: "#fff", borderRadius: 10, padding: "8px 18px", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t.more}</button> : <span />}
          {rep ? <span style={{ fontSize: 11, opacity: .8 }}>{t.reported}</span> : <button onClick={report} style={{ background: "none", border: "none", color: "inherit", opacity: .6, textDecoration: "underline", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>{t.report}</button>}
        </div>
      </div>
    </div>
  );
}
