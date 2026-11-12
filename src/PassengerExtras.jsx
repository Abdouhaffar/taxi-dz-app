/* eslint-disable */
// ميزات الراكب: أماكن محفوظة، رحلات مجدولة، سجل الرحلات + فاتورة + إعادة الطلب، أكواد الخصم
import { C } from "./Theme";
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, updateDoc, doc, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";

const K = { get dark(){return C.dark;}, get red(){return C.green;}, get ok(){return C.ok;}, get okBg(){return C.okLight;}, get muted(){return C.textMuted;}, get line(){return C.border;}, get soft(){return C.soft;}, get warn(){return "#d98a00";} };
const FONT = "'IBM Plex Sans Arabic',Cairo,sans-serif";
const fns = getFunctions(undefined, "europe-west1");
const L3 = (lang, ar, fr, en) => (lang === "fr" ? fr : lang === "en" ? en : ar);
const dateOf = (t) => t?.toDate?.() || (t?.seconds ? new Date(t.seconds * 1000) : null);
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d, lang) => d ? d.toLocaleDateString(lang === "fr" ? "fr-DZ" : lang === "en" ? "en-GB" : "ar-DZ", { weekday: "short", day: "numeric", month: "short" }) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : "—";
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ================= الأماكن المحفوظة =================
export function SavedPlacesBar({ places = [], current, onUse, onSave, lang = "ar" }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const already = current && places.some((p) => Math.abs(p.lat - current.lat) < 0.0003 && Math.abs(p.lng - current.lng) < 0.0003);
  const presets = [["🏠", L3(lang, "المنزل", "Maison", "Home")], ["💼", L3(lang, "العمل", "Travail", "Work")]];
  const save = (icon, name) => {
    if (!current || !name.trim()) return;
    onSave([...places.filter((p) => p.label !== name.trim()), { id: Date.now().toString(36), icon, label: name.trim(), text: current.text, lat: current.lat, lng: current.lng }].slice(0, 8));
    setAdding(false); setLabel("");
  };
  if (!places.length && !current) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {places.map((p) => (
          <div key={p.id} style={{ flexShrink: 0, display: "flex", alignItems: "center", background: K.soft, borderRadius: 20, paddingInlineStart: 12, paddingInlineEnd: 4 }}>
            <span onClick={() => onUse(p)} style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, padding: "8px 4px", color: K.dark }}>{p.icon} {p.label}</span>
            <span onClick={() => onSave(places.filter((x) => x.id !== p.id))} style={{ cursor: "pointer", color: "#aaa", fontSize: 13, padding: "6px 8px" }}>✕</span>
          </div>
        ))}
        {current && !already && places.length < 8 && (
          <button onClick={() => setAdding(!adding)} style={{ flexShrink: 0, border: `1.5px dashed ${K.muted}`, background: "none", borderRadius: 20, padding: "8px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, color: K.dark, cursor: "pointer" }}>
            ⭐ {L3(lang, "حفظ هذه الوجهة", "Enregistrer", "Save this place")}
          </button>
        )}
      </div>
      {adding && current && (
        <div style={{ background: K.soft, borderRadius: 14, padding: 12, marginTop: 8 }}>
          <div style={{ fontSize: 12, color: K.muted, marginBottom: 8 }}>{current.text?.slice(0, 60)}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {presets.map(([ic, nm]) => <button key={nm} onClick={() => save(ic, nm)} style={{ flex: 1, background: C.card, border: `1px solid ${K.line}`, borderRadius: 12, padding: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>{ic} {nm}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={L3(lang, "اسم آخر (مثال: الجامعة)", "Autre nom", "Other name")} style={{ flex: 1, border: `1px solid ${K.line}`, borderRadius: 12, padding: "10px 12px", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
            <button onClick={() => save("📍", label)} style={{ background: K.dark, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>{L3(lang, "حفظ", "OK", "Save")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= الجدولة =================
export const minSchedule = () => new Date(Date.now() + 30 * 60000);
export function SchedulePicker({ value, onChange, lang = "ar" }) {
  const later = !!value;
  const min = minSchedule(), max = new Date(Date.now() + 7 * 86400000);
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: 14, margin: "0 20px 14px", boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", background: K.soft, borderRadius: 12, padding: 3 }}>
        {[[false, "🚕 " + L3(lang, "الآن", "Maintenant", "Now")], [true, "🗓️ " + L3(lang, "لاحقاً", "Plus tard", "Later")]].map(([v, l]) => (
          <button key={String(v)} onClick={() => onChange(v ? localInput(new Date(Date.now() + 60 * 60000)) : "")} style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer", background: later === v ? K.dark : "transparent", color: later === v ? "#fff" : K.muted }}>{l}</button>
        ))}
      </div>
      {later && (
        <div style={{ marginTop: 12 }}>
          <input type="datetime-local" value={value} min={localInput(min)} max={localInput(max)} onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%", border: `1px solid ${K.line}`, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 15, outline: "none", direction: "ltr" }} />
          <div style={{ fontSize: 11, color: K.muted, marginTop: 8, lineHeight: 1.7 }}>
            {L3(lang, "نبدأ البحث عن سائق قبل موعدك بـ 15 دقيقة، وتصلك رسالة عند قبول السائق. يمكنك الحجز حتى 7 أيام مقدماً وإلغاؤه مجاناً قبل البحث.",
              "Nous cherchons un chauffeur 15 min avant l'heure. Réservation jusqu'à 7 jours à l'avance.",
              "We start looking for a driver 15 min before pickup. Book up to 7 days ahead.")}
          </div>
          {value && new Date(value) < min && <div style={{ color: K.red, fontSize: 12, marginTop: 6 }}>{L3(lang, "اختر موعداً بعد 30 دقيقة على الأقل", "Au moins 30 min à l'avance", "At least 30 min ahead")}</div>}
        </div>
      )}
    </div>
  );
}
export const scheduleToTimestamp = (v) => (v ? Timestamp.fromDate(new Date(v)) : null);
export const scheduleValid = (v) => !v || new Date(v) >= minSchedule();

// ================= كود الخصم =================
export function PromoBox({ price, rideType, applied, onApply, onClear, initialCode = "", lang = "ar" }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr("");
    try {
      const res = await httpsCallable(fns, "validatePromo")({ code: code.trim(), price, rideType });
      onApply({ code: res.data.code, discount: res.data.discount, title: res.data.title });
      setCode("");
    } catch (e) { setErr((e?.message || "").replace(/^.*?: /, "") || L3(lang, "كود غير صالح", "Code invalide", "Invalid code")); }
    setBusy(false);
  };
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: 14, margin: "0 20px 14px", boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
      {applied ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: K.okBg, borderRadius: 12, padding: "10px 14px" }}>
          <div><div style={{ fontWeight: 900, color: K.ok, fontSize: 14 }}>🎟️ {applied.code} — {L3(lang, "خصم", "Remise", "Off")} {applied.discount} DA</div>{applied.title && <div style={{ fontSize: 11, color: K.muted }}>{applied.title}</div>}</div>
          <button onClick={onClear} style={{ border: "none", background: "none", color: K.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }} placeholder={"🎟️ " + L3(lang, "لديك كود خصم؟", "Code promo ?", "Promo code?")}
              style={{ flex: 1, minWidth: 0, border: `1px solid ${err ? K.red : K.line}`, borderRadius: 12, padding: "11px 14px", fontFamily: "inherit", fontSize: 14, outline: "none", direction: "ltr", textAlign: "center", letterSpacing: 2, fontWeight: 700 }} />
            <button onClick={apply} disabled={busy || !code.trim()} style={{ background: code.trim() ? K.dark : "#ccc", color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>{busy ? "…" : L3(lang, "تطبيق", "OK", "Apply")}</button>
          </div>
          {err && <div style={{ color: K.red, fontSize: 12, marginTop: 6 }}>{err}</div>}
        </>
      )}
    </div>
  );
}

// عروض عامة يطلقها الأدمن (شريط في الرئيسية)
export function OffersBanner({ lang = "ar", onUse }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => { httpsCallable(fns, "listOffers")({}).then((r) => setOffers(r.data.offers || [])).catch(() => {}); }, []);
  if (!offers.length) return null;
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 12 }}>
      {offers.map((o) => (
        <div key={o.code} onClick={() => onUse && onUse(o.code)} style={{ flexShrink: 0, minWidth: 220, background: `linear-gradient(135deg,${C.green},${C.green})`, color: "#fff", borderRadius: 16, padding: "12px 16px", cursor: "pointer" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>🎁 {o.title || o.code}</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginTop: 4 }}>{o.type === "percent" ? `-${o.value}%` : `-${o.value} DA`} · {L3(lang, "الكود", "Code", "Code")}: <b style={{ letterSpacing: 1 }}>{o.code}</b></div>
        </div>
      ))}
    </div>
  );
}

// ================= رحلاتي القادمة (الرئيسية) =================
export function UpcomingRides({ userId, lang = "ar", onResume }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!userId) return;
    return onSnapshot(query(collection(db, "bookings"), where("passengerId", "==", userId), where("status", "in", ["scheduled", "pending", "accepted"])),
      (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.scheduledAt && (dateOf(b.scheduledAt) || 0) > Date.now() - 3 * 3600000).sort((a, b) => dateOf(a.scheduledAt) - dateOf(b.scheduledAt))),
      () => {});
  }, [userId]);
  if (!rows.length) return null;
  const cancel = async (id) => { try { await updateDoc(doc(db, "bookings", id), { status: "cancelled" }); } catch {} };
  return (
    <div style={{ marginBottom: 12 }}>
      {rows.map((b) => (
        <div key={b.id} style={{ background: "#fff8e6", border: "1px solid #f3d98a", borderRadius: 16, padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: K.dark }}>🗓️ {fmtDate(dateOf(b.scheduledAt), lang)}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: b.status === "accepted" ? K.ok : K.warn }}>
              {b.status === "accepted" ? L3(lang, "تم قبولها ✓", "Acceptée ✓", "Accepted ✓") : b.status === "pending" ? L3(lang, "جارٍ البحث عن سائق…", "Recherche…", "Finding a driver…") : L3(lang, "مجدولة", "Planifiée", "Scheduled")}
            </div>
          </div>
          <div style={{ fontSize: 12, color: K.muted, margin: "6px 0 10px" }}>🏁 {b.destText?.slice(0, 50)} · {b.price} DA</div>
          {b.status === "accepted" && b.driverInfo && <div style={{ fontSize: 12, color: K.dark, marginBottom: 8 }}>🚕 {b.driverInfo.name} — {b.driverInfo.carBrand} {b.driverInfo.carModel} {b.driverInfo.plateNumber}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            {b.status === "accepted" && <button onClick={() => onResume(b)} style={{ flex: 1, background: K.dark, color: "#fff", border: "none", borderRadius: 10, padding: 10, fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>{L3(lang, "تتبّع السائق", "Suivre", "Track driver")}</button>}
            {(b.status === "scheduled" || b.status === "pending") && <button onClick={() => cancel(b.id)} style={{ flex: 1, background: C.card, color: K.red, border: `1px solid ${K.red}55`, borderRadius: 10, padding: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>{L3(lang, "إلغاء الحجز", "Annuler", "Cancel")}</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ================= الفاتورة =================
export function InvoiceModal({ ride, passengerName, lang = "ar", onClose }) {
  const d = dateOf(ride.completedAt) || dateOf(ride.createdAt);
  const total = ride.price || 0, disc = ride.discount || 0;
  const no = "BRQ-" + ride.id.slice(0, 8).toUpperCase();
  const rows = [
    [L3(lang, "الراكب", "Passager", "Passenger"), passengerName],
    [L3(lang, "السائق", "Chauffeur", "Driver"), ride.driverInfo?.name],
    [L3(lang, "السيارة", "Voiture", "Car"), [ride.driverInfo?.carBrand, ride.driverInfo?.carModel, ride.driverInfo?.carColor].filter(Boolean).join(" ")],
    [L3(lang, "اللوحة", "Plaque", "Plate"), ride.driverInfo?.plateNumber],
    [L3(lang, "من", "De", "From"), ride.originText],
    [L3(lang, "إلى", "À", "To"), ride.destText],
    [L3(lang, "المسافة", "Distance", "Distance"), ride.distanceKm ? ride.distanceKm.toFixed(1) + " km" : ""],
  ].filter((r) => r[1]);
  const text = `AL-BURAQ ${no}\n${fmtDate(d, lang)}\n` + rows.map((r) => r.join(": ")).join("\n") + `\n${L3(lang, "الإجمالي", "Total", "Total")}: ${total} DA`;
  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${no}</title><style>body{font-family:Arial,sans-serif;max-width:420px;margin:30px auto;color:#111}h2{margin:0}table{width:100%;border-collapse:collapse;margin-top:14px}td{padding:8px 0;border-bottom:1px solid #eee;font-size:14px}td:last-child{text-align:end;font-weight:600}.t td{font-size:18px;font-weight:900;border:0}</style></head><body><h2>AL-BURAQ</h2><div style="color:#777;font-size:13px">${no} · ${fmtDate(d, lang)}</div><table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}${disc ? `<tr><td>${L3(lang, "خصم", "Remise", "Discount")} (${ride.promoCode || ""})</td><td>-${disc} DA</td></tr>` : ""}<tr class="t"><td>${L3(lang, "الإجمالي", "Total", "Total")}</td><td>${total} DA</td></tr><tr><td>${L3(lang, "الدفع", "Paiement", "Payment")}</td><td>${L3(lang, "نقداً", "Espèces", "Cash")}</td></tr></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };
  const share = async () => { if (navigator.share) { try { await navigator.share({ text }); } catch {} } else { try { await navigator.clipboard.writeText(text); } catch {} } };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3600 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "90vh", overflowY: "auto", background: C.card, borderRadius: "24px 24px 0 0", padding: "22px 20px 26px", fontFamily: FONT, direction: lang === "ar" ? "rtl" : "ltr" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>🧾 {L3(lang, "فاتورة الرحلة", "Reçu de course", "Trip receipt")}</div>
          <div style={{ fontSize: 12, color: K.muted, marginTop: 4 }}>{no} · {fmtDate(d, lang)}</div>
        </div>
        {rows.map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${K.line}`, fontSize: 13 }}><span style={{ color: K.muted }}>{r[0]}</span><span style={{ fontWeight: 700, textAlign: "end" }}>{r[1]}</span></div>)}
        {disc > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", color: K.ok, fontWeight: 700, fontSize: 13 }}><span>🎟️ {ride.promoCode}</span><span>-{disc} DA</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: K.soft, borderRadius: 14, padding: "14px 16px", margin: "14px 0" }}>
          <span style={{ fontWeight: 800 }}>{L3(lang, "الإجمالي (نقداً)", "Total (espèces)", "Total (cash)")}</span><span style={{ fontWeight: 900, fontSize: 22 }}>{total} DA</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={print} style={{ flex: 1, background: K.dark, color: "#fff", border: "none", borderRadius: 12, padding: 13, fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>🖨️ {L3(lang, "طباعة / PDF", "Imprimer / PDF", "Print / PDF")}</button>
          <button onClick={share} style={{ flex: 1, background: K.soft, border: "none", borderRadius: 12, padding: 13, fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>↗ {L3(lang, "مشاركة", "Partager", "Share")}</button>
        </div>
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", color: K.muted, padding: 12, fontFamily: "inherit", cursor: "pointer" }}>{L3(lang, "إغلاق", "Fermer", "Close")}</button>
      </div>
    </div>
  );
}

// ================= سجل الرحلات =================
export function HistoryScreen({ userId, passengerName, lang = "ar", onBack, onRebook }) {
  const [rides, setRides] = useState(null);
  const [filter, setFilter] = useState("all");
  const [inv, setInv] = useState(null);
  useEffect(() => {
    getDocs(query(collection(db, "bookings"), where("passengerId", "==", userId), orderBy("createdAt", "desc"), limit(60)))
      .then((s) => setRides(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.status !== "scheduled")))
      .catch(() => setRides([]));
  }, [userId]);
  const done = (r) => r.status === "completed" || r.status === "rated";
  const list = (rides || []).filter((r) => filter === "all" || (filter === "done" ? done(r) : r.status === "cancelled"));
  const stats = useMemo(() => { const d = (rides || []).filter(done); return { n: d.length, sum: d.reduce((s, r) => s + (r.price || 0), 0), km: d.reduce((s, r) => s + (r.distanceKm || 0), 0) }; }, [rides]);
  return (
    <div style={{ minHeight: "100vh", background: C.soft, fontFamily: FONT, direction: lang === "ar" ? "rtl" : "ltr", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "48px 20px 14px" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: C.card, fontSize: 18, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>{lang === "ar" ? "→" : "←"}</button>
        <div style={{ fontWeight: 900, fontSize: 20 }}>🧾 {L3(lang, "رحلاتي", "Mes courses", "My trips")}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, margin: "0 20px 14px" }}>
        {[[stats.n, L3(lang, "رحلة", "courses", "trips")], [stats.sum, "DA"], [stats.km.toFixed(0), "km"]].map(([v, l], i) => (
          <div key={i} style={{ background: C.card, borderRadius: 16, padding: "14px 8px", textAlign: "center" }}><div style={{ fontWeight: 900, fontSize: 20 }}>{v}</div><div style={{ fontSize: 11, color: K.muted }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, margin: "0 20px 12px" }}>
        {[["all", L3(lang, "الكل", "Tout", "All")], ["done", L3(lang, "مكتملة", "Terminées", "Completed")], ["cancelled", L3(lang, "ملغاة", "Annulées", "Cancelled")]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ border: "none", borderRadius: 20, padding: "8px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", background: filter === v ? K.dark : "#fff", color: filter === v ? "#fff" : K.muted }}>{l}</button>
        ))}
      </div>
      <div style={{ margin: "0 20px" }}>
        {rides === null && <div style={{ textAlign: "center", color: K.muted, padding: 40 }}>⏳</div>}
        {rides && !list.length && <div style={{ textAlign: "center", color: K.muted, padding: 40, fontSize: 13 }}>{L3(lang, "لا توجد رحلات", "Aucune course", "No trips")}</div>}
        {list.map((r) => (
          <div key={r.id} style={{ background: C.card, borderRadius: 18, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: K.muted }}>{fmtDate(dateOf(r.createdAt), lang)}</span>
              <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "3px 10px", background: done(r) ? K.okBg : "#fdeaea", color: done(r) ? K.ok : K.red }}>{done(r) ? L3(lang, "مكتملة", "Terminée", "Completed") : L3(lang, "ملغاة", "Annulée", "Cancelled")}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 5 }}><div style={{ width: 9, height: 9, borderRadius: "50%", background: K.ok }} /><div style={{ flex: 1, width: 2, background: K.line, margin: "3px 0" }} /><div style={{ width: 9, height: 9, borderRadius: 2, background: K.red }} /></div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>{r.originText || "—"}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.destText || "—"}</div>
              </div>
              <div style={{ textAlign: "end" }}><div style={{ fontWeight: 900, fontSize: 18 }}>{r.price} DA</div><div style={{ fontSize: 11, color: K.muted }}>{r.distanceKm?.toFixed?.(1)} km</div></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onRebook(r)} style={{ flex: 1, background: K.dark, color: "#fff", border: "none", borderRadius: 12, padding: 11, fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🔁 {L3(lang, "أعد الطلب", "Recommander", "Book again")}</button>
              {done(r) && <button onClick={() => setInv(r)} style={{ flex: 1, background: K.soft, border: "none", borderRadius: 12, padding: 11, fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🧾 {L3(lang, "الفاتورة", "Reçu", "Receipt")}</button>}
            </div>
          </div>
        ))}
      </div>
      {inv && <InvoiceModal ride={inv} passengerName={passengerName} lang={lang} onClose={() => setInv(null)} />}
    </div>
  );
}
