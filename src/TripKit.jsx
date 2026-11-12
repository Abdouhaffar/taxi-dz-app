/* eslint-disable */
// أدوات الرحلة: رمز الركوب، تقييم بنقاط، مشاركة الرحلة مع جهة موثوقة (رابط تتبع مباشر)، وصفحة التتبع العامة
import { C } from "./Theme";
import { useState, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const K = { get dark(){return C.dark;}, get red(){return C.green;}, get ok(){return C.ok;}, get okBg(){return C.okLight;}, get muted(){return C.textMuted;}, get line(){return C.border;}, get soft(){return C.soft;}, get warn(){return "#d98a00";} };
const FONT = "'IBM Plex Sans Arabic',Cairo,sans-serif";

// ================= رمز الركوب =================
export const makeRideCode = () => String(Math.floor(1000 + Math.random() * 9000));

export function RideCodeGate({ code, verify, passengerName, onOk, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState("");
  const [fails, setFails] = useState(0);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (verify) { // تحقق من جهة الخادم
      setBusy(true);
      try { await verify(v); }
      catch (e) { setBusy(false); setV(""); setErr(e?.code === "functions/resource-exhausted" ? "محاولات كثيرة — انتظر بضع دقائق أو اطلب الرمز من الراكب" : e?.code === "functions/permission-denied" ? "الرمز غير صحيح، اطلب الرمز من الراكب" : "تعذر التحقق، تأكد من الاتصال وحاول مجدداً"); }
      return;
    }
    if (v === code) return onOk();
    const f = fails + 1; setFails(f); setV("");
    setErr(f >= 5 ? "محاولات كثيرة — اطلب من الراكب رمزاً صحيحاً أو أبلغ الدعم" : "الرمز غير صحيح، اطلب الرمز من الراكب");
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT, direction: "rtl" }}>
      <div style={{ background: C.card, borderRadius: 24, padding: 26, width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🔐</div>
        <div style={{ fontWeight: 900, fontSize: 19, color: K.dark, margin: "6px 0 4px" }}>رمز تأكيد الركوب</div>
        <div style={{ fontSize: 13, color: K.muted, marginBottom: 16 }}>اطلب من {passengerName || "الراكب"} الرمز المكوّن من 4 أرقام</div>
        <input autoFocus inputMode="numeric" maxLength={4} value={v} onChange={(e) => { setV(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && v.length === 4 && submit()}
          style={{ width: "100%", textAlign: "center", letterSpacing: 14, fontSize: 34, fontWeight: 900, border: `2px solid ${err ? K.red : K.line}`, borderRadius: 16, padding: "12px 0", outline: "none", fontFamily: "inherit", direction: "ltr" }} />
        {err && <div style={{ color: K.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} style={{ flex: 1, background: K.soft, border: "none", borderRadius: 14, padding: 14, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>رجوع</button>
          <button onClick={submit} disabled={v.length !== 4 || fails >= 5 || busy} style={{ flex: 2, background: v.length === 4 && fails < 5 ? K.dark : "#ccc", color: "#fff", border: "none", borderRadius: 14, padding: 14, fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>تأكيد وبدء الرحلة</button>
        </div>
      </div>
    </div>
  );
}

// ================= تقييم بنقاط محددة =================
export const RATE_TAGS = {
  driver: {
    good: [["clean", { ar: "سيارة نظيفة", fr: "Voiture propre", en: "Clean car" }], ["safe", { ar: "قيادة آمنة", fr: "Conduite sûre", en: "Safe driving" }], ["polite", { ar: "أدب واحترام", fr: "Courtoisie", en: "Polite" }], ["ontime", { ar: "التزام بالوقت", fr: "Ponctuel", en: "On time" }], ["route", { ar: "يعرف الطريق", fr: "Connaît la route", en: "Knows the route" }]],
    bad: [["dirty", { ar: "سيارة غير نظيفة", fr: "Voiture sale", en: "Dirty car" }], ["reckless", { ar: "قيادة متهورة", fr: "Conduite dangereuse", en: "Reckless driving" }], ["rude", { ar: "سوء معاملة", fr: "Impoli", en: "Rude" }], ["late", { ar: "تأخر كثيراً", fr: "En retard", en: "Late" }], ["wrongroute", { ar: "طريق خاطئ", fr: "Mauvais trajet", en: "Wrong route" }]],
  },
  passenger: {
    good: [["polite", { ar: "أدب واحترام", fr: "Courtoisie", en: "Polite" }], ["ready", { ar: "جاهز في الموعد", fr: "Prêt à l'heure", en: "Ready on time" }], ["carecar", { ar: "حافظ على السيارة", fr: "Respecte la voiture", en: "Respected the car" }], ["clearloc", { ar: "موقع واضح", fr: "Lieu clair", en: "Clear pickup" }]],
    bad: [["rude", { ar: "سوء معاملة", fr: "Impoli", en: "Rude" }], ["late", { ar: "تأخر عن الموعد", fr: "En retard", en: "Kept me waiting" }], ["mess", { ar: "أضرّ بالسيارة", fr: "A sali la voiture", en: "Messed the car" }], ["unclear", { ar: "موقع غير واضح", fr: "Lieu imprécis", en: "Unclear pickup" }]],
  },
};
export function TagPicker({ kind, stars, value, onChange, lang = "ar", dark }) {
  if (!stars) return null;
  const list = RATE_TAGS[kind][stars >= 4 ? "good" : "bad"];
  const L = { ar: stars >= 4 ? "ما الذي أعجبك؟" : "ما المشكلة؟", fr: stars >= 4 ? "Qu'avez-vous aimé ?" : "Quel problème ?", en: stars >= 4 ? "What went well?" : "What went wrong?" }[lang] || "";
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, color: dark ? C.textMuted : K.muted, marginBottom: 8, fontWeight: 700 }}>{L}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {list.map(([k, labels]) => {
          const on = value.includes(k);
          return <button key={k} onClick={() => toggle(k)} style={{ border: `1px solid ${on ? (stars >= 4 ? K.ok : K.red) : (dark ? C.border : K.line)}`, background: on ? (stars >= 4 ? K.ok : K.red) : "transparent", color: on ? "#fff" : (dark ? "#fff5f6" : K.dark), borderRadius: 20, padding: "7px 14px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{labels[lang] || labels.ar}</button>;
        })}
      </div>
    </div>
  );
}

// ================= مشاركة الرحلة =================
const newToken = () => {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
};
const intlPhone = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("213") ? d : d.startsWith("0") ? "213" + d.slice(1) : d; };

// يحافظ على وثيقة shares/{token} محدّثة طوال الرحلة، وينهيها عند انتهاء الرحلة
export function useShareSync({ token, active, phase, driverLocation, ended }) {
  const last = useRef(0);
  useEffect(() => {
    if (!token) return;
    const now = Date.now();
    if (ended) { updateDoc(doc(db, "shares", token), { ended: true, updatedAt: serverTimestamp() }).catch(() => {}); return; }
    if (!active) return;
    if (now - last.current < 4000 && driverLocation) return;
    last.current = now;
    updateDoc(doc(db, "shares", token), { phase, ...(driverLocation ? { driverLocation } : {}), updatedAt: serverTimestamp() }).catch(() => {});
  }, [token, active, phase, driverLocation?.lat, driverLocation?.lng, ended]);
}

export async function createShare({ bookingId, passengerName, driver, originText, destText, origin, dest }) {
  const token = newToken();
  await setDoc(doc(db, "shares", token), {
    bookingId, passengerName: passengerName || "", driverName: driver?.name || "", carBrand: driver?.carBrand || "", carModel: driver?.carModel || "",
    carColor: driver?.carColor || "", plate: driver?.plateNumber || "", originText: originText || "", destText: destText || "",
    origin: origin || null, dest: dest || null, phase: "pickup", ended: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return token;
}

export function ShareTripSheet({ link, passengerName, contacts = [], onSaveContacts, onClose, lang = "ar" }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const msg = (n) => ({
    ar: `${n ? n + "، " : ""}أنا ${passengerName} في رحلة عبر AL-BURAQ. تابع رحلتي مباشرة: ${link}`,
    fr: `${passengerName} est en course avec AL-BURAQ. Suivez le trajet en direct : ${link}`,
    en: `${passengerName} is on a ride with AL-BURAQ. Follow live: ${link}`,
  }[lang] || link);
  const T = { ar: ["مشاركة رحلتي", "أرسل رابط التتبع لشخص تثق به ليتابع موقعك مباشرة حتى نهاية الرحلة", "جهاتي الموثوقة", "الاسم", "الهاتف", "إضافة", "واتساب", "رسالة", "نسخ الرابط", "تم النسخ ✓", "مشاركة عبر تطبيق آخر", "إغلاق"],
    fr: ["Partager mon trajet", "Envoyez un lien de suivi à une personne de confiance", "Contacts de confiance", "Nom", "Téléphone", "Ajouter", "WhatsApp", "SMS", "Copier le lien", "Copié ✓", "Partager via une autre app", "Fermer"],
    en: ["Share my trip", "Send a live tracking link to someone you trust", "Trusted contacts", "Name", "Phone", "Add", "WhatsApp", "SMS", "Copy link", "Copied ✓", "Share via another app", "Close"] }[lang] || [];
  const add = () => { if (!name.trim() || intlPhone(phone).length < 9) return; onSaveContacts([...contacts, { name: name.trim(), phone: phone.trim() }].slice(0, 5)); setName(""); setPhone(""); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };
  const more = async () => { if (navigator.share) { try { await navigator.share({ text: msg("") }); } catch {} } else copy(); };
  const btn = { border: "none", borderRadius: 10, padding: "8px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", textDecoration: "none" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3500 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "86vh", overflowY: "auto", background: C.card, borderRadius: "24px 24px 0 0", padding: "22px 20px 28px", fontFamily: FONT, direction: lang === "ar" ? "rtl" : "ltr" }}>
        <div style={{ fontWeight: 900, fontSize: 19, color: K.dark }}>📡 {T[0]}</div>
        <div style={{ fontSize: 12, color: K.muted, margin: "4px 0 16px" }}>{T[1]}</div>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{T[2]}</div>
        {contacts.map((c, i) => (
          <div key={i} style={{ background: K.soft, borderRadius: 14, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div><div style={{ fontSize: 12, color: K.muted, direction: "ltr", textAlign: "right" }}>{c.phone}</div></div>
              <button onClick={() => onSaveContacts(contacts.filter((_, j) => j !== i))} style={{ ...btn, background: "none", color: K.muted, fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <a href={`https://wa.me/${intlPhone(c.phone)}?text=${encodeURIComponent(msg(c.name))}`} target="_blank" rel="noreferrer" style={{ ...btn, flex: 1, background: "#25D366", color: "#fff", textAlign: "center" }}>{T[6]}</a>
              <a href={`sms:${c.phone}?&body=${encodeURIComponent(msg(c.name))}`} style={{ ...btn, flex: 1, background: K.dark, color: "#fff", textAlign: "center" }}>{T[7]}</a>
            </div>
          </div>
        ))}
        {contacts.length < 5 && (
          <div style={{ display: "flex", gap: 8, margin: "10px 0 16px" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T[3]} style={{ flex: 1, minWidth: 0, border: `1px solid ${K.line}`, borderRadius: 12, padding: "10px 12px", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={T[4]} inputMode="tel" style={{ flex: 1, minWidth: 0, border: `1px solid ${K.line}`, borderRadius: 12, padding: "10px 12px", fontFamily: "inherit", fontSize: 13, outline: "none", direction: "ltr" }} />
            <button onClick={add} style={{ ...btn, background: K.dark, color: "#fff" }}>{T[5]}</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copy} style={{ ...btn, flex: 1, background: K.soft, color: K.dark, padding: 12 }}>{copied ? T[9] : "🔗 " + T[8]}</button>
          <button onClick={more} style={{ ...btn, flex: 1, background: K.soft, color: K.dark, padding: 12 }}>↗ {T[10]}</button>
        </div>
        <button onClick={onClose} style={{ ...btn, width: "100%", background: "none", color: K.muted, marginTop: 10, padding: 12 }}>{T[11]}</button>
      </div>
    </div>
  );
}

// ================= صفحة التتبع العامة (/track/<token>) =================
const dist = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lng - a.lng) * r; const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };

export function TrackPage({ token }) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || "", libraries: ["places"], language: "ar", region: "DZ" });
  const [s, setS] = useState(undefined);
  const mapRef = useRef(null);
  useEffect(() => onSnapshot(doc(db, "shares", token), (d) => setS(d.exists() ? d.data() : null), () => setS(null)), [token]);

  if (s === undefined) return <Shell><div style={{ textAlign: "center", padding: 60, color: K.muted }}>⏳ جارٍ التحميل…</div></Shell>;
  if (s === null) return <Shell><div style={{ textAlign: "center", padding: 60, color: K.muted }}>الرابط غير صالح أو منتهي</div></Shell>;

  const target = s.phase === "ride" ? s.dest : s.origin;
  const km = s.driverLocation && target ? dist(s.driverLocation, target) : null;
  const eta = km !== null ? Math.max(1, Math.round(km / 0.5)) : null;
  const status = s.ended ? { t: "انتهت الرحلة ✅", c: K.ok } : s.phase === "ride" ? { t: "الرحلة جارية", c: "#1e6fd9" } : { t: "السائق في الطريق إلى الراكب", c: "#d98a00" };
  return (
    <Shell>
      <div style={{ padding: "16px 18px 6px" }}>
        <div style={{ fontWeight: 900, fontSize: 20, color: K.dark }}>تتبع رحلة {s.passengerName}</div>
        <div style={{ display: "inline-block", marginTop: 8, background: status.c + "1f", color: status.c, fontWeight: 800, fontSize: 13, borderRadius: 20, padding: "5px 14px" }}>{status.t}</div>
        {!s.ended && eta !== null && <span style={{ marginInlineStart: 10, fontSize: 13, color: K.dark, fontWeight: 700 }}>⏱ ~{eta} د · {km.toFixed(1)} كم</span>}
      </div>
      <div style={{ margin: "10px 14px", borderRadius: 18, overflow: "hidden", border: `1px solid ${K.line}`, height: "46vh", background: K.soft }}>
        {isLoaded ? (
          <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={s.driverLocation || s.origin || { lat: 36.737, lng: 3.086 }} zoom={14}
            onLoad={(m) => (mapRef.current = m)} options={{ disableDefaultUI: true, zoomControl: true }}>
            {s.origin && <Marker position={s.origin} label="A" />}
            {s.dest && <Marker position={s.dest} label="B" />}
            {s.driverLocation && <Marker position={s.driverLocation} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: C.green, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 }} />}
          </GoogleMap>
        ) : <div style={{ padding: 40, textAlign: "center", color: K.muted }}>جارٍ تحميل الخريطة…</div>}
      </div>
      <div style={{ margin: "0 14px 14px", background: K.soft, borderRadius: 18, padding: 16, fontSize: 13, lineHeight: 1.9 }}>
        <div>🚕 <b>{s.driverName}</b> — {s.carBrand} {s.carModel} {s.carColor}</div>
        {s.plate && <div>🔢 اللوحة: <b style={{ direction: "ltr", display: "inline-block" }}>{s.plate}</b></div>}
        <div>📍 من: {s.originText}</div>
        <div>🏁 إلى: {s.destText}</div>
        <div style={{ color: K.muted, fontSize: 11, marginTop: 6 }}>يتحدث الموقع تلقائياً · AL-BURAQ</div>
      </div>
    </Shell>
  );
}
const Shell = ({ children }) => <div style={{ minHeight: "100vh", background: C.card, fontFamily: FONT, direction: "rtl", maxWidth: 520, margin: "0 auto" }}>{children}</div>;
