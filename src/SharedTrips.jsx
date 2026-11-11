/* eslint-disable */
// الرحلات التشاركية بين المدن: واجهة الراكب + واجهة السائق
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { sharedPrice, wilayaByCode, wilayaLabel, wilayaOf, roadKm, WILAYA_LIST, isEnabled, codeOfLabel } from "./Wilayas";

const fns = getFunctions(undefined, "europe-west1");
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);
const errMsg = (e) => (e?.message || "").replace(/^.*?:\s*/, "") || "حدث خطأ، حاول مجدداً";
const FONT = "'IBM Plex Sans Arabic',Cairo,system-ui,sans-serif";
const LIGHT = { bg: "#f5f5f7", card: "#fff", text: "#1c1a1d", muted: "#6e6469", border: "#ebebef", soft: "#f3f3f5", brand: "#c4001d", ok: "#16a34a", dark: "#1c1a1d" };
const DARK = { bg: "#0f0c0e", card: "#1d181b", text: "#fff", muted: "#c7a9ae", border: "#2e2428", soft: "#2a2125", brand: "#e0334d", ok: "#37d67a", dark: "#000" };
const fmtDT = (t, lang = "ar") => { const d = t?.toDate?.() || (t?.seconds ? new Date(t.seconds * 1000) : null); return d ? d.toLocaleString(lang === "ar" ? "ar-DZ" : lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; };
const L3 = (lang, ar, fr, en) => (lang === "fr" ? fr : lang === "en" ? en : ar);

// ================= الراكب: اختيار وحده / تشاركية =================
export function SharedModeBox({ price, mode, setMode, lang = "ar", uplift = 20 }) {
  const p2 = sharedPrice(price, 2, uplift), p3 = sharedPrice(price, 3, uplift);
  const T = LIGHT;
  const card = (k, ico, title, sub, big) => (
    <button key={k} onClick={() => setMode(k)} style={{ flex: 1, textAlign: "center", border: `2px solid ${mode === k ? T.brand : T.border}`, background: mode === k ? "#c4001d0f" : T.card, borderRadius: 18, padding: "14px 8px", fontFamily: FONT, cursor: "pointer" }}>
      <div style={{ fontSize: 28 }}>{ico}</div>
      <div style={{ fontWeight: 900, fontSize: 14, color: T.text, marginTop: 2 }}>{title}</div>
      <div style={{ fontWeight: 900, fontSize: 15, color: mode === k ? T.brand : T.text, marginTop: 4 }}>{big}</div>
      <div style={{ fontSize: 10, color: T.muted, marginTop: 2, lineHeight: 1.5 }}>{sub}</div>
    </button>
  );
  return (
    <div style={{ margin: "0 20px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>🛣️ {L3(lang, "رحلة بين المدن — كيف تريد السفر؟", "Trajet inter-villes — comment voyager ?", "Intercity trip — how do you want to travel?")}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {card("solo", "🚗", L3(lang, "وحدي", "Seul", "Private"), L3(lang, "سيارة لك وحدك", "Voiture pour vous", "Car just for you"), `${price} DA`)}
        {card("shared", "🚐", L3(lang, "تشاركية", "Partagé", "Shared"), L3(lang, "أرخص — تتقاسم الرحلة", "Moins cher — partagé", "Cheaper — share the ride"), `${p3}–${p2} DA`)}
      </div>
      {mode === "shared" && (
        <div style={{ marginTop: 10, background: "#fff7e6", border: "1px solid #ffe2a8", borderRadius: 14, padding: "10px 12px", fontSize: 12, lineHeight: 1.8, color: "#6b4a00" }}>
          {L3(lang,
            `السعر يُقسَّم على عدد الركاب الفعلي ثم تُضاف ${uplift}%: راكبان = ${p2} دج للفرد، ثلاثة = ${p3} دج. وإن بقيت وحدك فتدفع ${price} دج كاملة. يتحدد السعر النهائي عند انطلاق الرحلة.`,
            `Le prix est divisé par le nombre réel de passagers + ${uplift}% : 2 = ${p2} DA chacun, 3 = ${p3} DA. Seul : ${price} DA. Prix final fixé au départ.`,
            `Price is split by the actual passengers + ${uplift}%: 2 = ${p2} DA each, 3 = ${p3} DA. Alone: ${price} DA. Final price is set at departure.`)}
        </div>
      )}
    </div>
  );
}

// رحلات منشورة من السائقين بنفس المسار
export function SharedTripPicker({ originLL, destLL, price, uplift = 20, joinBusy, onJoin, lang = "ar" }) {
  const o = wilayaOf(originLL?.lat, originLL?.lng), d = wilayaOf(destLL?.lat, destLL?.lng);
  const [trips, setTrips] = useState([]);
  useEffect(() => {
    if (!o || !d) return;
    return onSnapshot(query(collection(db, "shared_trips"), where("fromCode", "==", o.c), where("toCode", "==", d.c), where("status", "==", "open")),
      (s) => setTrips(s.docs.map((x) => ({ id: x.id, ...x.data() })).filter((t) => t.seatsTaken < t.maxSeats && (t.departureAt?.toMillis?.() || 0) > Date.now() - 3600000).sort((a, b) => (a.departureAt?.toMillis?.() || 0) - (b.departureAt?.toMillis?.() || 0))), () => {});
  }, [o?.c, d?.c]);
  const T = LIGHT;
  if (!trips.length) return null;
  return (
    <div style={{ margin: "0 20px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>🚐 {L3(lang, "رحلات متاحة الآن بنفس مسارك", "Trajets disponibles sur votre itinéraire", "Trips available on your route")}</div>
      {trips.map((t) => {
        const est = sharedPrice(t.baseTotal, t.seatsTaken + 1, t.uplift ?? uplift);
        return (
          <div key={t.id} style={{ background: T.card, borderRadius: 18, padding: 14, marginBottom: 10, boxShadow: "0 2px 14px rgba(0,0,0,.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, color: T.text }}>{t.driverInfo?.name} · {t.driverInfo?.carBrand} {t.driverInfo?.carModel}</div>
              <div style={{ fontWeight: 900, color: T.brand }}>≈ {est} DA</div>
            </div>
            <div style={{ fontSize: 12, color: T.muted, margin: "4px 0 10px" }}>🕒 {fmtDT(t.departureAt, lang)} · 💺 {t.maxSeats - t.seatsTaken} {L3(lang, "مقعد متبقٍ من", "places sur", "seats left of")} {t.maxSeats}</div>
            <button disabled={joinBusy} onClick={() => onJoin(t)} style={{ width: "100%", background: T.dark, color: "#fff", border: "none", borderRadius: 12, padding: 12, fontFamily: FONT, fontWeight: 800, cursor: "pointer" }}>{L3(lang, "احجز مقعداً في هذه الرحلة", "Réserver une place", "Book a seat")}</button>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: T.muted, textAlign: "center" }}>{L3(lang, "أو أرسل طلباً بالأسفل ليقبله سائق", "Ou envoyez une demande ci-dessous", "Or send a request below for a driver to accept")}</div>
    </div>
  );
}

// ينشئ حجزاً تشاركياً (طلب ينتظر سائقاً)، ويعيد معرّفه
export async function createSharedBooking({ user, passengerName, passengerPhone, passengerPhoto, originText, destText, oLL, dLL, rideType, price, distanceKm, passengers, scheduledAt, promo }) {
  const ref = await addDoc(collection(db, "bookings"), {
    passengerId: user.uid, passengerName, passengerPhone: passengerPhone || "", passengerPhoto: passengerPhoto || null,
    originText, destText, originLat: oLL.lat, originLng: oLL.lng, destLat: dLL.lat, destLng: dLL.lng,
    rideType, price, soloPrice: price, distanceKm, passengers: passengers || 1, shared: true, intercity: true,
    status: "shared_pending", ...(scheduledAt ? { scheduledAt } : {}), createdAt: serverTimestamp(),
  });
  return ref.id;
}
export const joinTrip = (bookingId, tripId) => call("joinSharedTrip", { bookingId, tripId });

// ================= الراكب: شاشة رحلتي التشاركية =================
export function ActiveSharedBanner({ uid, onOpen, lang = "ar" }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, "bookings"), where("passengerId", "==", uid), where("status", "in", ["shared_pending", "shared_booked", "shared_started"])), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, [uid]);
  if (!list.length) return null;
  const b = list[0];
  const st = { shared_pending: L3(lang, "بانتظار سائق", "En attente d'un chauffeur", "Waiting for a driver"), shared_booked: L3(lang, "تم حجز مقعدك", "Place réservée", "Seat booked"), shared_started: L3(lang, "الرحلة انطلقت", "Trajet en cours", "Trip in progress") }[b.status];
  return (
    <div onClick={() => onOpen(b.id)} style={{ margin: "0 0 12px", background: "linear-gradient(135deg,#1c1a1d,#3a1119)", color: "#fff", borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: FONT }}>
      <div style={{ fontSize: 28 }}>🚐</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>{L3(lang, "رحلتك التشاركية", "Votre trajet partagé", "Your shared trip")} — {st}</div>
        <div style={{ fontSize: 12, opacity: .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.originText} → {b.destText}</div>
      </div>
      <div style={{ fontSize: 18 }}>›</div>
    </div>
  );
}

export function SharedTripScreen({ bookingId, onBack, lang = "ar" }) {
  const T = LIGHT, rtl = lang === "ar";
  const [b, setB] = useState(null), [trip, setTrip] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => onSnapshot(doc(db, "bookings", bookingId), (s) => setB(s.exists() ? { id: s.id, ...s.data() } : null), () => {}), [bookingId]);
  useEffect(() => { if (!b?.tripId) { setTrip(null); return; } return onSnapshot(doc(db, "shared_trips", b.tripId), (s) => setTrip(s.exists() ? { id: s.id, ...s.data() } : null), () => {}); }, [b?.tripId]);
  const cancel = async () => {
    if (!window.confirm(L3(lang, "إلغاء مقعدك في الرحلة؟", "Annuler votre place ?", "Cancel your seat?"))) return;
    setBusy(true); setErr("");
    try { await call("cancelSharedSeat", { bookingId }); onBack(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };
  const [stars, setStars] = useState(0);
  const rate = async (n) => { setStars(n); try { await updateDoc(doc(db, "bookings", bookingId), { driverRating: n, ratedAt: serverTimestamp() }); } catch (e) {} };
  const card = { background: T.card, borderRadius: 20, padding: 18, margin: "0 20px 14px", boxShadow: "0 2px 16px rgba(0,0,0,.06)" };
  if (!b) return <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>…</div>;
  const dr = trip?.driverInfo || b.driverInfo;
  const estNow = trip ? sharedPrice(trip.baseTotal, Math.max(1, trip.seatsTaken), trip.uplift ?? 20) : null;
  const finalPrice = b.sharedPrice || b.price;
  const done = b.status === "completed" || b.status === "rated";
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, direction: rtl ? "rtl" : "ltr", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top,0px) + 48px) 20px 16px" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,.12)", cursor: "pointer", fontSize: 18 }}>{rtl ? "→" : "←"}</button>
        <div style={{ fontWeight: 900, fontSize: 18, color: T.text }}>🚐 {L3(lang, "رحلتي التشاركية", "Mon trajet partagé", "My shared trip")}</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, color: T.muted }}>{L3(lang, "المسار", "Itinéraire", "Route")}</div>
        <div style={{ fontWeight: 800, color: T.text, marginTop: 4, lineHeight: 1.8 }}>🟢 {b.originText}<br />🏁 {b.destText}</div>
        {trip && <div style={{ marginTop: 8, fontSize: 13, color: T.muted }}>🕒 {fmtDT(trip.departureAt, lang)}</div>}
      </div>

      {b.status === "shared_pending" && (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <div style={{ fontWeight: 900, color: T.text, margin: "6px 0" }}>{L3(lang, "طلبك ينتظر سائقاً", "Demande en attente", "Waiting for a driver")}</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.8 }}>{L3(lang, "سيظهر طلبك للسائقين على هذا المسار. ستصلك رحلتك هنا فور قبول سائق.", "Votre demande est visible des chauffeurs sur cet itinéraire.", "Your request is visible to drivers on this route.")}</div>
          <div style={{ fontWeight: 900, color: T.brand, marginTop: 10 }}>{L3(lang, "السعر المتوقع", "Prix estimé", "Estimated price")}: {sharedPrice(b.soloPrice || b.price, 3)}–{sharedPrice(b.soloPrice || b.price, 2)} DA</div>
        </div>
      )}

      {(b.status === "shared_booked" || b.status === "shared_started") && trip && (
        <>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.soft, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{dr?.photo ? <img src={dr.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧑‍✈️"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: T.text }}>{dr?.name}</div>
                <div style={{ fontSize: 12, color: T.muted }}>{dr?.carBrand} {dr?.carModel} · {dr?.carColor}</div>
                {dr?.plateNumber && <div style={{ display: "inline-block", marginTop: 4, background: "#1c1a1d", color: "#fff", borderRadius: 8, padding: "2px 10px", fontWeight: 900, letterSpacing: 1, fontSize: 13 }} dir="ltr">{dr.plateNumber}</div>}
              </div>
            </div>
            {dr?.phone && <a href={`tel:${dr.phone}`} style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14, background: "#16a34a", color: "#fff", borderRadius: 14, padding: "12px 14px", textDecoration: "none", fontWeight: 800 }}>📞 {L3(lang, "اتصل بالسائق", "Appeler", "Call driver")} <span dir="ltr">{dr.phone}</span></a>}
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted }}><span>💺 {L3(lang, "الركاب", "Passagers", "Passengers")}</span><b style={{ color: T.text }}>{trip.status === "started" ? trip.finalPassengers : trip.seatsTaken} / {trip.maxSeats}</b></div>
            <div style={{ height: 8, background: T.soft, borderRadius: 4, margin: "8px 0 14px", overflow: "hidden" }}><div style={{ width: `${((trip.status === "started" ? trip.finalPassengers : trip.seatsTaken) / trip.maxSeats) * 100}%`, height: "100%", background: T.brand }} /></div>
            {b.status === "shared_booked" ? (
              <>
                <div style={{ fontSize: 12, color: T.muted }}>{L3(lang, "سعرك الآن (ينزل كلما انضم ركاب)", "Votre prix actuel (baisse quand d'autres rejoignent)", "Your price now (drops as others join)")}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: T.brand }}>{estNow} <span style={{ fontSize: 16 }}>DA</span></div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7, marginTop: 6 }}>{L3(lang, "السعر النهائي يُثبَّت عند انطلاق الرحلة حسب عدد الركاب. الدفع نقداً للسائق.", "Prix final fixé au départ. Paiement en espèces.", "Final price is fixed at departure. Cash payment.")}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: T.muted }}>{L3(lang, "الرحلة انطلقت — سعرك النهائي", "En route — prix final", "On the way — final price")}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: T.brand }}>{finalPrice} <span style={{ fontSize: 16 }}>DA</span></div>
              </>
            )}
          </div>
          {b.status === "shared_booked" && <div style={{ margin: "0 20px" }}>
            {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{err}</div>}
            <button disabled={busy} onClick={cancel} style={{ width: "100%", background: "#fff", border: "1px solid #ef444455", color: "#ef4444", borderRadius: 14, padding: 14, fontFamily: FONT, fontWeight: 800, cursor: "pointer" }}>{L3(lang, "إلغاء مقعدي", "Annuler ma place", "Cancel my seat")}</button>
          </div>}
        </>
      )}

      {b.status === "shared_pending" && <div style={{ margin: "0 20px" }}>
        {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{err}</div>}
        <button disabled={busy} onClick={cancel} style={{ width: "100%", background: "#fff", border: "1px solid #ef444455", color: "#ef4444", borderRadius: 14, padding: 14, fontFamily: FONT, fontWeight: 800, cursor: "pointer" }}>{L3(lang, "إلغاء الطلب", "Annuler la demande", "Cancel request")}</button>
      </div>}

      {done && (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <div style={{ fontWeight: 900, color: T.text, fontSize: 18 }}>{L3(lang, "وصلت بسلام!", "Bonne arrivée !", "You've arrived!")}</div>
          <div style={{ color: T.muted, margin: "6px 0 12px" }}>{L3(lang, "المبلغ المدفوع نقداً", "Montant payé en espèces", "Paid in cash")}: <b style={{ color: T.brand }}>{finalPrice} DA</b></div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>{L3(lang, "قيّم السائق", "Notez le chauffeur", "Rate the driver")}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => rate(n)} style={{ background: "none", border: "none", fontSize: 32, cursor: "pointer", opacity: n <= (stars || b.driverRating || 0) ? 1 : .25 }}>⭐</button>)}</div>
          <button onClick={onBack} style={{ marginTop: 14, background: T.dark, color: "#fff", border: "none", borderRadius: 14, padding: "12px 28px", fontFamily: FONT, fontWeight: 800, cursor: "pointer" }}>{L3(lang, "العودة", "Retour", "Back")}</button>
        </div>
      )}
      {b.status === "cancelled" && <div style={{ ...card, textAlign: "center", color: T.muted }}>{L3(lang, "تم إلغاء هذه الرحلة", "Trajet annulé", "Trip cancelled")}<div><button onClick={onBack} style={{ marginTop: 12, background: T.dark, color: "#fff", border: "none", borderRadius: 14, padding: "10px 24px", fontFamily: FONT, fontWeight: 800, cursor: "pointer" }}>{L3(lang, "العودة", "Retour", "Back")}</button></div></div>}
    </div>
  );
}

// ================= السائق: مركز الرحلات التشاركية =================
export function DriverSharedHub({ user, driverData, regions, estimate, onBack }) {
  const T = DARK;
  const [tab, setTab] = useState("requests");
  const [reqs, setReqs] = useState([]), [trips, setTrips] = useState([]);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState("");
  const [seatFor, setSeatFor] = useState(null), [seats, setSeats] = useState(3);
  const myCode = codeOfLabel(driverData?.wilaya);

  useEffect(() => onSnapshot(query(collection(db, "bookings"), where("status", "==", "shared_pending")), (s) => setReqs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);
  useEffect(() => onSnapshot(query(collection(db, "shared_trips"), where("driverId", "==", user.uid), where("status", "in", ["open", "started"])), (s) => setTrips(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), [user.uid]);

  const visible = useMemo(() => reqs.filter((r) => {
    const o = wilayaOf(r.originLat, r.originLng), d = wilayaOf(r.destLat, r.destLng);
    return o && d && isEnabled(regions, o.c) && isEnabled(regions, d.c) && (!myCode || o.c === myCode || trips.some((t) => t.fromCode === o.c));
  }).map((r) => ({ ...r, _o: wilayaOf(r.originLat, r.originLng), _d: wilayaOf(r.destLat, r.destLng) })), [reqs, regions, myCode, trips]);

  const run = async (key, fn) => { setBusy(key); setMsg(""); try { await fn(); } catch (e) { setMsg("⚠️ " + errMsg(e)); } setBusy(""); };
  const accept = (r) => {
    const match = trips.find((t) => t.status === "open" && t.fromCode === r._o.c && t.toCode === r._d.c && t.seatsTaken < t.maxSeats);
    if (match) return run(r.id, async () => { await call("acceptSharedRequest", { bookingId: r.id }); setMsg("✅ أُضيف الراكب إلى رحلتك"); });
    setSeats(3); setSeatFor(r);
  };
  const confirmSeats = () => { const r = seatFor; setSeatFor(null); run(r.id, async () => { await call("acceptSharedRequest", { bookingId: r.id, seats }); setMsg("✅ تم إنشاء الرحلة التشاركية"); setTab("trips"); }); };

  const card = { background: T.card, borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: "0 4px 18px rgba(0,0,0,.25)" };
  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 12, padding: "12px 16px", fontFamily: FONT, fontWeight: 800, cursor: "pointer", fontSize: 14 });
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FONT, direction: "rtl", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top,0px) + 48px) 18px 12px" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.card, color: T.text, cursor: "pointer", fontSize: 18 }}>→</button>
        <div style={{ fontWeight: 900, fontSize: 19 }}>🚐 الرحلات التشاركية</div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 18px 14px" }}>
        {[["requests", `الطلبات (${visible.length})`], ["trips", `رحلاتي (${trips.length})`], ["publish", "نشر رحلة"]].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(""); }} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: "none", fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: "pointer", background: tab === k ? T.brand : T.card, color: "#fff" }}>{l}</button>
        ))}
      </div>
      <div style={{ padding: "0 18px" }}>
        {msg && <div style={{ background: T.soft, borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{msg}</div>}

        {tab === "requests" && (
          <>
            {!visible.length && <div style={{ textAlign: "center", color: T.muted, padding: 30 }}>لا توجد طلبات تشاركية الآن</div>}
            {visible.map((r) => (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{r._o.n} ← {r._d.n}</div>
                  <div style={{ color: T.ok, fontWeight: 900 }}>{r.soloPrice || r.price} DA</div>
                </div>
                <div style={{ fontSize: 12, color: T.muted, margin: "6px 0 10px", lineHeight: 1.8 }}>🟢 {r.originText}<br />🏁 {r.destText}{r.scheduledAt && <><br />🕒 {fmtDT(r.scheduledAt)}</>}<br />👤 {r.passengerName}</div>
                <button disabled={busy === r.id} onClick={() => accept(r)} style={{ ...btn(T.brand), width: "100%" }}>{trips.some((t) => t.status === "open" && t.fromCode === r._o.c && t.toCode === r._d.c && t.seatsTaken < t.maxSeats) ? "➕ أضفه إلى رحلتي" : "✅ اقبل وأنشئ رحلة تشاركية"}</button>
              </div>
            ))}
          </>
        )}

        {tab === "trips" && (
          <>
            {!trips.length && <div style={{ textAlign: "center", color: T.muted, padding: 30 }}>ليست لديك رحلات تشاركية مفتوحة</div>}
            {trips.map((t) => <DriverTripCard key={t.id} t={t} T={T} card={card} btn={btn} busy={busy} run={run} />)}
          </>
        )}

        {tab === "publish" && <PublishTrip T={T} card={card} btn={btn} regions={regions} myCode={myCode} estimate={estimate} run={run} busy={busy} onDone={() => { setTab("trips"); setMsg("✅ نُشرت رحلتك ويراها الركاب"); }} />}
      </div>

      {seatFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>💺</div>
            <div style={{ fontWeight: 900, fontSize: 18, margin: "6px 0" }}>كم راكباً تقبل في هذه الرحلة؟</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 14, lineHeight: 1.7 }}>الحد الأقصى للمقاعد. سيرى الركاب الآخرون على نفس المسار رحلتك وينضمون إليها.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {Array.from({ length: (regions.maxSeatsLimit || 6) - 1 }, (_, i) => i + 2).map((n) => <button key={n} onClick={() => setSeats(n)} style={{ width: 52, height: 52, borderRadius: 14, border: `2px solid ${seats === n ? T.brand : T.border}`, background: seats === n ? T.brand : "transparent", color: "#fff", fontWeight: 900, fontSize: 20, cursor: "pointer", fontFamily: FONT }}>{n}</button>)}
            </div>
            <div style={{ fontSize: 12, color: T.muted, margin: "14px 0" }}>مثال على {seatFor.soloPrice || seatFor.price} DA: راكبان = {sharedPrice(seatFor.soloPrice || seatFor.price, 2, regions.uplift)} لكل فرد · ثلاثة = {sharedPrice(seatFor.soloPrice || seatFor.price, 3, regions.uplift)}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSeatFor(null)} style={{ ...btn(T.soft), flex: 1 }}>رجوع</button>
              <button onClick={confirmSeats} style={{ ...btn(T.brand), flex: 2 }}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverTripCard({ t, T, card, btn, busy, run }) {
  const [ps, setPs] = useState([]);
  useEffect(() => onSnapshot(query(collection(db, "bookings"), where("tripId", "==", t.id)), (s) => setPs(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => ["shared_booked", "shared_started", "completed"].includes(b.status))), () => {}), [t.id]);
  const n = t.status === "started" ? t.finalPassengers : t.seatsTaken;
  const price = t.status === "started" ? t.finalPrice : sharedPrice(t.baseTotal, Math.max(1, n), t.uplift ?? 20);
  const start = () => {
    if (!window.confirm(`الانطلاق بـ ${n} راكب؟\nسعر كل راكب ${price} DA (المجموع ${price * n} DA نقداً). لن يستطيع آخرون الانضمام بعد ذلك.`)) return;
    run("s" + t.id, () => call("startSharedTrip", { tripId: t.id }));
  };
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: 900 }}>{t.fromName} ← {t.toName}</div><div style={{ fontSize: 12, color: t.status === "started" ? T.ok : T.muted, fontWeight: 800 }}>{t.status === "started" ? "🚗 في الطريق" : "⏳ مفتوحة"}</div></div>
      <div style={{ fontSize: 12, color: T.muted, margin: "4px 0 10px" }}>🕒 {fmtDT(t.departureAt)} · 💺 {n}/{t.maxSeats}</div>
      <div style={{ background: T.soft, borderRadius: 14, padding: "10px 14px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.muted }}>{t.status === "started" ? "سعر كل راكب" : "سعر كل راكب الآن"} · مجموع الرحلة</div>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{price} DA <span style={{ color: T.ok }}>· {price * Math.max(1, n)} DA</span></div>
      </div>
      {ps.map((b) => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.soft, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>{b.passengerPhoto ? <img src={b.passengerPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 13 }}>{b.passengerName}</div><div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📍 {b.originText}</div></div>
          {b.passengerPhone && <a href={`tel:${b.passengerPhone}`} style={{ background: "#16a34a", color: "#fff", borderRadius: 12, padding: "8px 12px", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>📞</a>}
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {t.status === "open" && <>
          <button disabled={!n || busy === "s" + t.id} onClick={start} style={{ ...btn(n ? T.brand : "#555"), flex: 2 }}>🚗 انطلق ({n})</button>
          <button disabled={busy === "c" + t.id} onClick={() => window.confirm("إلغاء الرحلة؟ سيعود الركاب لقائمة الطلبات.") && run("c" + t.id, () => call("cancelSharedTrip", { tripId: t.id }))} style={{ ...btn(T.soft), flex: 1 }}>إلغاء</button>
        </>}
        {t.status === "started" && <button disabled={busy === "e" + t.id} onClick={() => window.confirm("تأكيد وصول جميع الركاب وتحصيل المبالغ؟") && run("e" + t.id, () => call("completeSharedTrip", { tripId: t.id }))} style={{ ...btn(T.ok), flex: 1, color: "#000" }}>✅ أنهيت الرحلة</button>}
      </div>
    </div>
  );
}

function PublishTrip({ T, card, btn, regions, myCode, estimate, run, busy, onDone }) {
  const list = WILAYA_LIST.filter((w) => isEnabled(regions, w.c));
  const [from, setFrom] = useState(myCode && isEnabled(regions, myCode) ? myCode : list[0]?.c || "");
  const [to, setTo] = useState("");
  const [dt, setDt] = useState("");
  const [seats, setSeats] = useState(3);
  const km = from && to && from !== to ? roadKm(from, to) : 0;
  const base = km && estimate ? estimate(km) : 0;
  const sel = { width: "100%", background: T.soft, color: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, fontFamily: FONT, fontSize: 14, marginBottom: 10 };
  const ok = from && to && from !== to && dt && new Date(dt).getTime() > Date.now() - 300000;
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>من</div>
      <select value={from} onChange={(e) => setFrom(e.target.value)} style={sel}>{list.map((w) => <option key={w.c} value={w.c}>{w.c} - {w.n}</option>)}</select>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>إلى</div>
      <select value={to} onChange={(e) => setTo(e.target.value)} style={sel}><option value="">اختر الوجهة</option>{list.filter((w) => w.c !== from).map((w) => <option key={w.c} value={w.c}>{w.c} - {w.n}</option>)}</select>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>موعد الانطلاق</div>
      <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} style={sel} />
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>أقصى عدد للركاب</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>{Array.from({ length: (regions.maxSeatsLimit || 6) - 1 }, (_, i) => i + 2).map((n) => <button key={n} onClick={() => setSeats(n)} style={{ width: 48, height: 48, borderRadius: 12, border: `2px solid ${seats === n ? T.brand : T.border}`, background: seats === n ? T.brand : "transparent", color: "#fff", fontWeight: 900, fontSize: 18, cursor: "pointer", fontFamily: FONT }}>{n}</button>)}</div>
      {base > 0 && <div style={{ background: T.soft, borderRadius: 14, padding: 12, fontSize: 13, lineHeight: 1.9, marginBottom: 12 }}>
        المسافة التقريبية {km} كم · سعر الرحلة {base} DA<br />
        راكبان: <b>{sharedPrice(base, 2, regions.uplift)}</b> لكل فرد (مجموعك {sharedPrice(base, 2, regions.uplift) * 2}) · {seats} ركاب: <b>{sharedPrice(base, seats, regions.uplift)}</b> لكل فرد (مجموعك {sharedPrice(base, seats, regions.uplift) * seats})
      </div>}
      <button disabled={!ok || busy === "pub"} onClick={() => run("pub", async () => { await call("publishSharedTrip", { fromCode: from, toCode: to, seats, departureAtMs: new Date(dt).getTime() }); onDone(); })} style={{ ...btn(ok ? T.brand : "#555"), width: "100%" }}>نشر الرحلة</button>
    </div>
  );
}
