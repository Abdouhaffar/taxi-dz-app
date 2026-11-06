/* eslint-disable */
// 1) جهاز واحد لكل حساب  2) لوحة الأذونات (الموقع/الإشعارات/التثبيت)
import { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const DEV_KEY = "taxidz_device_id", CLAIM_KEY = "taxidz_claimed_uid";
const safe = (f, d) => { try { return f(); } catch (e) { return d; } };
export const getDeviceId = () => {
  let id = safe(() => localStorage.getItem(DEV_KEY), null);
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); safe(() => localStorage.setItem(DEV_KEY, id)); }
  return id;
};
export const clearDeviceClaim = () => safe(() => localStorage.removeItem(CLAIM_KEY));

// يعيد true إذا فُتح الحساب على جهاز آخر بعد هذا الجهاز
export function useSingleSession(uid) {
  const [kicked, setKicked] = useState(false);
  useEffect(() => {
    if (!uid) return;
    const me = getDeviceId();
    const ref = doc(db, "sessions", uid);
    // الجهاز الذي لم يسجّل دخولاً بهذا الحساب من قبل = دخول جديد → يستولي على الجلسة
    const fresh = safe(() => localStorage.getItem(CLAIM_KEY), null) !== uid;
    if (fresh) {
      setDoc(ref, { deviceId: me, at: serverTimestamp(), ua: (navigator.userAgent || "").slice(0, 120) })
        .then(() => safe(() => localStorage.setItem(CLAIM_KEY, uid))).catch(() => {});
    }
    let first = true;
    return onSnapshot(ref, (s) => {
      if (!s.exists()) { return; }
      const d = s.data();
      if (s.metadata.hasPendingWrites) return;
      if (d.deviceId && d.deviceId !== me) { setKicked(true); }
      else setKicked(false);
    }, () => {});
  }, [uid]);
  return kicked;
}

export function KickedScreen({ onLogout, lang = "ar" }) {
  const T = {
    ar: ["تم تسجيل الخروج", "تم فتح حسابك على هاتف آخر، ولا يمكن استعمال الحساب إلا على جهاز واحد في نفس الوقت.", "حسنًا"],
    fr: ["Déconnecté", "Votre compte a été ouvert sur un autre téléphone. Un seul appareil à la fois est autorisé.", "OK"],
    en: ["Signed out", "Your account was opened on another phone. Only one device at a time is allowed.", "OK"],
  }[lang] || [];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#141012", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: lang === "ar" ? "rtl" : "ltr", textAlign: "center" }}>
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 60 }}>📱</div>
        <div style={{ fontSize: 22, fontWeight: 900, margin: "10px 0" }}>{T[0]}</div>
        <div style={{ fontSize: 14, color: "#c7a9ae", lineHeight: 1.8, marginBottom: 22 }}>{T[1]}</div>
        <button onClick={onLogout} style={{ background: "#c4001d", border: "none", color: "#fff", borderRadius: 14, padding: "13px 34px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{T[2]}</button>
      </div>
    </div>
  );
}

// ===== لوحة الأذونات =====
const ua = () => (typeof navigator !== "undefined" ? navigator.userAgent || "" : "");
const isIOS = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => safe(() => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true, false);

async function geoState() {
  try {
    if (navigator.permissions?.query) { const r = await navigator.permissions.query({ name: "geolocation" }); return r.state; }
  } catch (e) {}
  return "unknown";
}

export function PermissionGate({ lang = "ar" }) {
  const [geo, setGeo] = useState("checking");
  const [hidden, setHidden] = useState(() => safe(() => sessionStorage.getItem("taxidz_perm_skip") === "1", false));
  const [busy, setBusy] = useState(false);
  const notifSupported = typeof Notification !== "undefined";
  const [notif, setNotif] = useState(notifSupported ? Notification.permission : "unsupported");
  const ios = isIOS();

  const refresh = async () => {
    const g = await geoState();
    setGeo(g);
    if (notifSupported) setNotif(Notification.permission);
  };
  useEffect(() => { refresh(); const t = setInterval(refresh, 2500); return () => clearInterval(t); }, []);

  const askGeo = () => {
    setBusy(true);
    navigator.geolocation?.getCurrentPosition(
      () => { setBusy(false); refresh(); },
      (e) => { setBusy(false); setGeo(e.code === 1 ? "denied" : "unknown"); },
      { enableHighAccuracy: true, timeout: 12000 });
  };
  const askNotif = async () => { try { await Notification.requestPermission(); } catch (e) {} refresh(); };
  const skip = () => { safe(() => sessionStorage.setItem("taxidz_perm_skip", "1")); setHidden(true); };

  const geoOk = geo === "granted";
  // iOS Safari العادي لا يدعم إشعارات الويب إلا بعد "إضافة للشاشة الرئيسية"
  const needInstall = ios && !isStandalone();
  if (hidden || geo === "checking" || (geoOk && !needInstall && (notif === "granted" || notif === "unsupported"))) return null;
  if (geoOk && needInstall && safe(() => localStorage.getItem("taxidz_install_seen") === "1", false)) return null;

  const L = {
    ar: {
      t: "لنُجهّز تطبيقك 🚀", s: "نحتاج بعض الأذونات ليعمل التطبيق بشكل صحيح.",
      geo: "الموقع الجغرافي", geoWhy: "لتحديد نقطة الانطلاق وإيجاد أقرب سائق", on: "مفعّل ✓", allow: "تفعيل", recheck: "تحقّقت من الإعدادات",
      notif: "الإشعارات", notifWhy: "لتنبيهك بقبول الرحلة ووصول السائق", later: "لاحقاً", done: "متابعة",
      denied: "الموقع محظور على هذا المتصفح. فعّله بهذه الخطوات:",
      iosSteps: ["اضغط على الرمز «aA» في شريط عنوان Safari (يسار/يمين الرابط)", "اختر «إعدادات الموقع الإلكتروني»", "اجعل «الموقع» = السماح", "أو: الإعدادات ← الخصوصية والأمان ← خدمات الموقع ← مواقع Safari ← «أثناء استخدام التطبيق»", "ثم ارجع واضغط «تحقّقت من الإعدادات»"],
      andSteps: ["اضغط على أيقونة القفل 🔒 بجانب الرابط", "الأذونات ← الموقع ← السماح", "ثم ارجع واضغط «تحقّقت من الإعدادات»"],
      install: "للحصول على الإشعارات والصوت على iPhone: اضغط زر المشاركة ⬆️ في Safari ثم «إضافة إلى الشاشة الرئيسية» وافتح التطبيق من أيقونته.",
    },
    fr: {
      t: "Préparons votre application 🚀", s: "Quelques autorisations sont nécessaires.",
      geo: "Localisation", geoWhy: "Pour votre point de départ et les chauffeurs proches", on: "Activée ✓", allow: "Activer", recheck: "J'ai vérifié les réglages",
      notif: "Notifications", notifWhy: "Pour être alerté de l'acceptation et de l'arrivée", later: "Plus tard", done: "Continuer",
      denied: "La localisation est bloquée. Activez-la ainsi :",
      iosSteps: ["Touchez « aA » dans la barre d'adresse de Safari", "Choisissez « Réglages du site web »", "Localisation = Autoriser", "Ou : Réglages ← Confidentialité ← Service de localisation ← Sites Safari ← « Lors de l'utilisation »", "Revenez et touchez « J'ai vérifié les réglages »"],
      andSteps: ["Touchez le cadenas 🔒 à côté de l'adresse", "Autorisations ← Localisation ← Autoriser", "Revenez et touchez « J'ai vérifié les réglages »"],
      install: "Pour les notifications et le son sur iPhone : touchez Partager ⬆️ dans Safari puis « Sur l'écran d'accueil », et ouvrez l'app depuis son icône.",
    },
    en: {
      t: "Let's set up your app 🚀", s: "A few permissions are needed for everything to work.",
      geo: "Location", geoWhy: "To set your pickup point and find nearby drivers", on: "Enabled ✓", allow: "Enable", recheck: "I've checked settings",
      notif: "Notifications", notifWhy: "To alert you when a driver accepts and arrives", later: "Later", done: "Continue",
      denied: "Location is blocked. Turn it on like this:",
      iosSteps: ["Tap “aA” in Safari's address bar", "Choose “Website Settings”", "Set Location = Allow", "Or: Settings ← Privacy & Security ← Location Services ← Safari Websites ← “While Using”", "Come back and tap “I've checked settings”"],
      andSteps: ["Tap the lock 🔒 next to the address", "Permissions ← Location ← Allow", "Come back and tap “I've checked settings”"],
      install: "For notifications & sound on iPhone: tap Share ⬆️ in Safari then “Add to Home Screen”, and open the app from its icon.",
    },
  }[lang] || {};
  const rtl = lang === "ar";
  const row = { background: "#201a1d", border: "1px solid #3a2a2f", borderRadius: 16, padding: 14, marginBottom: 12 };
  const btn = { background: "#c4001d", border: "none", color: "#fff", borderRadius: 12, padding: "10px 18px", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99990, background: "rgba(10,6,8,0.96)", color: "#fff", overflowY: "auto", padding: "calc(env(safe-area-inset-top,0px) + 56px) 18px 24px", fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: rtl ? "rtl" : "ltr" }}>
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{L.t}</div>
        <div style={{ fontSize: 13, color: "#c7a9ae", margin: "6px 0 18px" }}>{L.s}</div>

        <div style={row}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28 }}>📍</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{L.geo}</div><div style={{ fontSize: 12, color: "#c7a9ae" }}>{L.geoWhy}</div></div>
            {geoOk ? <div style={{ color: "#37d67a", fontWeight: 800, fontSize: 13 }}>{L.on}</div>
              : geo !== "denied" && <button style={btn} onClick={askGeo} disabled={busy}>{busy ? "…" : L.allow}</button>}
          </div>
          {geo === "denied" && (
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ color: "#ff8fa0", fontWeight: 700, marginBottom: 6 }}>{L.denied}</div>
              <ol style={{ paddingInlineStart: 20, margin: 0 }}>{(ios ? L.iosSteps : L.andSteps).map((x, i) => <li key={i}>{x}</li>)}</ol>
              <button style={{ ...btn, marginTop: 12, width: "100%" }} onClick={() => { askGeo(); }}>{L.recheck}</button>
            </div>
          )}
        </div>

        {notif !== "unsupported" && (
          <div style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>🔔</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{L.notif}</div><div style={{ fontSize: 12, color: "#c7a9ae" }}>{L.notifWhy}</div></div>
              {notif === "granted" ? <div style={{ color: "#37d67a", fontWeight: 800, fontSize: 13 }}>{L.on}</div>
                : notif === "default" ? <button style={btn} onClick={askNotif}>{L.allow}</button>
                : <div style={{ color: "#ff8fa0", fontSize: 12 }}>⛔</div>}
            </div>
          </div>
        )}

        {needInstall && <div style={{ ...row, fontSize: 13, lineHeight: 1.8 }}>📲 {L.install}</div>}

        <button onClick={() => { safe(() => localStorage.setItem("taxidz_install_seen", "1")); skip(); }}
          style={{ ...btn, width: "100%", marginTop: 6, background: geoOk ? "#c4001d" : "transparent", border: geoOk ? "none" : "1px solid #5a4348", color: geoOk ? "#fff" : "#c7a9ae" }}>
          {geoOk ? L.done : L.later}
        </button>
      </div>
    </div>
  );
}
