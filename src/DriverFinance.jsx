/* eslint-disable */
// السائق: أرباح (يومي/أسبوعي/شهري) + دفتر نقدي ومصاريف، المهام والحوافز، خريطة الطلب المرتفع
import { useState, useEffect, useMemo, useRef } from "react";
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { GoogleMap, Marker, Circle } from "@react-google-maps/api";
import { db } from "./firebase";

const fns = getFunctions(undefined, "europe-west1");
const dOf = (t) => t?.toDate?.() || (t?.seconds ? new Date(t.seconds * 1000) : null);
const pad = (n) => String(n).padStart(2, "0");
const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DA = (n) => `${Math.round(n || 0).toLocaleString("en-US")} دج`;
const rideDate = (r) => dOf(r.completedAt) || dOf(r.createdAt);
const kmBetween = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lng - a.lng) * r; const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };

// آخر رحلات السائق المكتملة (نفس شكل الاستعلام الموجود أصلاً فلا يلزم فهرس جديد)
function useDriverRides(uid) {
  const [rides, setRides] = useState(null);
  useEffect(() => {
    if (!uid) return;
    getDocs(query(collection(db, "bookings"), where("driverId", "==", uid), where("status", "in", ["completed", "rated"]), orderBy("createdAt", "desc"), limit(500)))
      .then((s) => setRides(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setRides([]));
  }, [uid]);
  return rides;
}

const Head = ({ C, title, onBack }) => (
  <div style={{ display: "flex", alignItems: "center", padding: "48px 20px 16px", gap: 12 }}>
    <button onClick={onBack} style={{ width: 42, height: 42, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontSize: 18 }}>→</button>
    <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{title}</div>
  </div>
);
const Shell = ({ C, children }) => <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: "rtl", paddingBottom: 40 }}>{children}</div>;

// ================= الأرباح + الدفتر النقدي =================
const EXP_TYPES = [["fuel", "⛽", "وقود"], ["repair", "🔧", "صيانة"], ["wash", "🧼", "غسيل"], ["other", "🧾", "أخرى"]];

export function EarningsPro({ C, uid, driverData, onBack }) {
  const rides = useDriverRides(uid);
  const [period, setPeriod] = useState("today");
  const [exps, setExps] = useState([]);
  const [form, setForm] = useState({ type: "fuel", amount: "", note: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, "driver_expenses"), where("driverId", "==", uid)), (s) => setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), [uid]);

  const range = useMemo(() => {
    const today = sod(new Date());
    // الأسبوع يبدأ السبت (الأسبوع الجزائري)
    const weekStart = addD(today, -((today.getDay() + 1) % 7));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return { today: [today, addD(today, 1)], week: [weekStart, addD(weekStart, 7)], month: [monthStart, new Date(today.getFullYear(), today.getMonth() + 1, 1)], all: [new Date(0), addD(today, 1)] }[period];
  }, [period]);
  const inR = (d) => d && d >= range[0] && d < range[1];
  const fr = (rides || []).filter((r) => inR(rideDate(r)));
  const fe = exps.filter((e) => inR(dOf(e.createdAt)));
  const income = fr.reduce((s, r) => s + (r.price || 0), 0);
  const spent = fe.reduce((s, e) => s + (e.amount || 0), 0);
  const km = fr.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const comp = fr.reduce((s, r) => s + (r.discount || 0), 0);

  // مخطط
  const chart = useMemo(() => {
    if (period === "today") {
      const a = Array.from({ length: 24 }, (_, h) => ({ l: h % 4 === 0 ? String(h) : "", v: 0 }));
      fr.forEach((r) => { a[rideDate(r).getHours()].v += r.price || 0; });
      return a;
    }
    const n = period === "week" ? 7 : period === "month" ? new Date(range[1] - 1).getDate() : 30;
    const start = period === "all" ? addD(sod(new Date()), -29) : range[0];
    const a = Array.from({ length: n }, (_, i) => { const d = addD(start, i); return { l: period === "week" ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"][d.getDay()] : (i % 5 === 0 ? String(d.getDate()) : ""), k: d.toDateString(), v: 0 }; });
    (rides || []).forEach((r) => { const d = rideDate(r); const x = d && a.find((y) => y.k === d.toDateString()); if (x) x.v += r.price || 0; });
    return a;
  }, [fr, rides, period, range]);
  const max = Math.max(1, ...chart.map((c) => c.v));

  const addExp = async () => {
    const amount = Number(form.amount);
    if (!(amount > 0)) return;
    try { await addDoc(collection(db, "driver_expenses"), { driverId: uid, type: form.type, amount, note: form.note.trim(), createdAt: serverTimestamp() }); setForm({ type: "fuel", amount: "", note: "" }); setAdding(false); } catch (e) { alert("تعذر الحفظ"); }
  };
  const credit = driverData?.compensationCredit || 0;
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 };

  return (
    <Shell C={C}>
      <Head C={C} title="📊 الأرباح والدفتر النقدي" onBack={onBack} />
      <div style={{ display: "flex", gap: 8, padding: "0 20px", marginBottom: 16 }}>
        {[["today", "اليوم"], ["week", "الأسبوع"], ["month", "الشهر"], ["all", "الكل"]].map(([id, l]) => (
          <button key={id} onClick={() => setPeriod(id)} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${period === id ? C.green : C.border}`, background: period === id ? C.greenLight : C.card, color: period === id ? C.green : C.textMuted, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      <div style={{ margin: "0 20px 14px", background: `linear-gradient(135deg,${C.green},${C.greenDark})`, borderRadius: 24, padding: 22 }}>
        <div style={{ fontSize: 12, color: "#ffffffaa" }}>صافي الربح (بعد المصاريف)</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: "#fff", margin: "4px 0 14px" }}>{DA(income - spent)}</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div><div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{DA(income)}</div><div style={{ fontSize: 11, color: "#ffffffaa" }}>💵 نقد محصَّل</div></div>
          <div style={{ width: 1, background: "#ffffff33" }} />
          <div><div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{DA(spent)}</div><div style={{ fontSize: 11, color: "#ffffffaa" }}>🧾 مصاريف</div></div>
          <div style={{ width: 1, background: "#ffffff33" }} />
          <div><div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{fr.length}</div><div style={{ fontSize: 11, color: "#ffffffaa" }}>🚕 رحلة</div></div>
        </div>
      </div>

      <div style={{ ...card, margin: "0 20px 14px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 14 }}>الدخل {period === "today" ? "بالساعة" : "باليوم"}</div>
        {rides === null ? <div style={{ textAlign: "center", color: C.textMuted, padding: 30 }}>⏳</div> : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120, direction: "ltr" }}>
            {chart.map((c, i) => (
              <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: `${Math.max(c.v ? 6 : 2, (c.v / max) * 100)}%`, background: c.v ? C.gold : C.border, borderRadius: "4px 4px 2px 2px", opacity: c.v ? 1 : 0.5 }} />
                <div style={{ fontSize: 8, color: C.textLight, height: 10, whiteSpace: "nowrap" }}>{c.l}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: C.textMuted }}>
          <span>📏 {km.toFixed(1)} كم</span><span>متوسط الرحلة {fr.length ? DA(income / fr.length) : "—"}</span>
          <span>للكم {km ? DA(income / km) : "—"}</span>
        </div>
      </div>

      {(credit > 0 || comp > 0) && (
        <div style={{ margin: "0 20px 14px", background: "#2a2410", border: "1px solid #6b5a1a", borderRadius: 20, padding: 16 }}>
          <div style={{ fontWeight: 800, color: "#ffd24d", fontSize: 14 }}>🎁 تعويض الخصومات</div>
          <div style={{ fontSize: 12, color: C.textMuted, margin: "6px 0 8px", lineHeight: 1.7 }}>حين يستعمل الراكب كود خصم تعوّضك المنصة بقيمته، وتُخصم من سعر اشتراكك القادم.</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.text, fontWeight: 900, fontSize: 18 }}>{DA(credit)} <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>رصيدك الحالي</span></span>
            {comp > 0 && <span style={{ color: "#ffd24d", fontSize: 12 }}>+{DA(comp)} في هذه الفترة</span>}
          </div>
        </div>
      )}

      <div style={{ margin: "0 20px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>🧾 المصاريف</div>
          <button onClick={() => setAdding(!adding)} style={{ background: C.green, border: "none", color: "#fff", borderRadius: 12, padding: "8px 16px", fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{adding ? "إلغاء" : "＋ مصروف"}</button>
        </div>
        {adding && (
          <div style={{ ...card, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {EXP_TYPES.map(([k, ic, l]) => <button key={k} onClick={() => setForm({ ...form, type: k })} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${form.type === k ? C.green : C.border}`, background: form.type === k ? C.greenLight : "transparent", color: C.text, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{ic}<br />{l}</button>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="المبلغ دج" style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 12px", color: C.text, fontFamily: "inherit", fontSize: 15, outline: "none" }} />
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ملاحظة" style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 12px", color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
            </div>
            <button onClick={addExp} style={{ width: "100%", marginTop: 10, background: C.green, border: "none", color: "#fff", borderRadius: 12, padding: 12, fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>حفظ</button>
          </div>
        )}
        {fe.length === 0 && !adding && <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13, padding: 14 }}>لا مصاريف في هذه الفترة</div>}
        {fe.sort((a, b) => (dOf(b.createdAt) || 0) - (dOf(a.createdAt) || 0)).map((e) => {
          const t = EXP_TYPES.find((x) => x[0] === e.type) || EXP_TYPES[3];
          return (
            <div key={e.id} style={{ ...card, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>{t[1]}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{t[2]}{e.note ? ` — ${e.note}` : ""}</div><div style={{ fontSize: 11, color: C.textLight }}>{dOf(e.createdAt)?.toLocaleDateString("ar-DZ")}</div></div>
              <div style={{ fontWeight: 900, color: C.red }}>-{DA(e.amount)}</div>
              <button onClick={() => deleteDoc(doc(db, "driver_expenses", e.id))} style={{ background: "none", border: "none", color: C.textLight, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ margin: "0 20px" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 10 }}>الرحلات</div>
        {rides && fr.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13, padding: 14 }}>لا توجد رحلات في هذه الفترة</div>}
        {fr.slice(0, 40).map((r) => (
          <div key={r.id} style={{ ...card, padding: 14, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{rideDate(r)?.toLocaleDateString("ar-DZ")} {pad(rideDate(r)?.getHours())}:{pad(rideDate(r)?.getMinutes())}</span>
              <span style={{ fontWeight: 900, color: C.gold }}>{r.price} دج</span>
            </div>
            <div style={{ fontSize: 12, color: C.text }}>📍 {r.originText?.slice(0, 32)}</div>
            <div style={{ fontSize: 12, color: C.text, margin: "2px 0 6px" }}>🏁 {r.destText?.slice(0, 32)}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ background: C.bg, borderRadius: 8, padding: "3px 9px", fontSize: 11, color: C.textMuted }}>{r.distanceKm?.toFixed?.(1)} كم</span>
              {r.discount > 0 && <span style={{ background: "#2a2410", borderRadius: 8, padding: "3px 9px", fontSize: 11, color: "#ffd24d" }}>🎁 تعويض +{r.discount}</span>}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ================= المهام والحوافز =================
const periodKey = (p, now = new Date()) => {
  const t = sod(now);
  if (p === "daily") return `d${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`;
  if (p === "weekly") { const s = addD(t, -((t.getDay() + 1) % 7)); return `w${s.getFullYear()}${pad(s.getMonth() + 1)}${pad(s.getDate())}`; }
  return `m${t.getFullYear()}${pad(t.getMonth() + 1)}`;
};
const periodStart = (p, now = new Date()) => {
  const t = sod(now);
  if (p === "daily") return t;
  if (p === "weekly") return addD(t, -((t.getDay() + 1) % 7));
  return new Date(t.getFullYear(), t.getMonth(), 1);
};
const PERIOD_L = { daily: "يومية", weekly: "أسبوعية", monthly: "شهرية" };

export function MissionsScreen({ C, uid, onBack }) {
  const rides = useDriverRides(uid);
  const [missions, setMissions] = useState(null);
  const [claims, setClaims] = useState({});
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => onSnapshot(collection(db, "missions"), (s) => setMissions(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.active !== false && !(dOf(m.expiresAt) && dOf(m.expiresAt) < new Date()))), () => setMissions([])), []);
  useEffect(() => onSnapshot(query(collection(db, "mission_claims"), where("driverId", "==", uid)), (s) => { const o = {}; s.docs.forEach((d) => (o[d.id] = true)); setClaims(o); }, () => {}), [uid]);

  const progressOf = (m) => {
    const start = periodStart(m.period);
    const rs = (rides || []).filter((r) => { const d = rideDate(r); return d && d >= start; });
    return m.metric === "earnings" ? rs.reduce((s, r) => s + (r.price || 0), 0) : rs.length;
  };
  const claim = async (m) => {
    setBusy(m.id);
    try { const r = await httpsCallable(fns, "claimMission")({ missionId: m.id }); setToast(`🎉 تم استلام المكافأة: ${r.data.label}`); }
    catch (e) { setToast("❌ " + ((e?.message || "").replace(/^.*?: /, "") || "تعذر الاستلام")); }
    setBusy(""); setTimeout(() => setToast(""), 3500);
  };
  return (
    <Shell C={C}>
      <Head C={C} title="🎯 المهام والحوافز" onBack={onBack} />
      {toast && <div style={{ position: "fixed", top: 16, left: 16, right: 16, zIndex: 50, background: "#fff", color: "#111", borderRadius: 14, padding: "12px 16px", fontWeight: 800, textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,.4)" }}>{toast}</div>}
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14, lineHeight: 1.7 }}>أكمل المهمة قبل نهاية فترتها واستلم مكافأتك نقاطاً أو رصيداً يُخصم من اشتراكك.</div>
        {missions === null && <div style={{ textAlign: "center", color: C.textMuted, padding: 40 }}>⏳</div>}
        {missions && !missions.length && <div style={{ textAlign: "center", color: C.textMuted, padding: 40 }}><div style={{ fontSize: 36 }}>🎯</div>لا توجد مهام الآن، ترقّب مهام جديدة قريباً</div>}
        {(missions || []).map((m) => {
          const prog = progressOf(m), pct = Math.min(100, (prog / m.target) * 100), done = prog >= m.target;
          const cid = `${uid}_${m.id}_${periodKey(m.period)}`, claimed = !!claims[cid];
          const rewardL = m.reward?.type === "credit" ? `${m.reward.amount} دج خصم من الاشتراك` : `${m.reward?.amount} نقطة`;
          return (
            <div key={m.id} style={{ background: C.card, border: `1px solid ${done && !claimed ? C.green : C.border}`, borderRadius: 20, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div><div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{m.title}</div>{m.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{m.description}</div>}</div>
                <span style={{ background: C.bg, color: C.textMuted, borderRadius: 20, padding: "3px 10px", fontSize: 11, whiteSpace: "nowrap" }}>{PERIOD_L[m.period]}</span>
              </div>
              <div style={{ height: 10, background: C.bg, borderRadius: 6, overflow: "hidden", margin: "14px 0 6px" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${C.green},${C.gold})`, borderRadius: 6, transition: "width .6s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
                <span>{m.metric === "earnings" ? DA(prog) : prog} / {m.metric === "earnings" ? DA(m.target) : m.target} {m.metric === "rides" ? "رحلة" : ""}</span>
                <span style={{ color: C.gold, fontWeight: 800 }}>🎁 {rewardL}</span>
              </div>
              {claimed ? <div style={{ marginTop: 12, textAlign: "center", color: "#3fb950", fontWeight: 800, fontSize: 13 }}>✅ تم استلام المكافأة</div>
                : <button disabled={!done || busy === m.id} onClick={() => claim(m)} style={{ width: "100%", marginTop: 12, background: done ? C.green : C.border, border: "none", color: done ? "#fff" : C.textLight, borderRadius: 12, padding: 12, fontFamily: "inherit", fontWeight: 800, cursor: done ? "pointer" : "default" }}>{busy === m.id ? "…" : done ? "استلم المكافأة" : "لم تكتمل بعد"}</button>}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// ================= مناطق الطلب المرتفع =================
const CELL = 0.012; // ≈ 1.3 كم
export function DemandMap({ C, driverLocation, onBack }) {
  const [rows, setRows] = useState(null);
  const mapRef = useRef(null);
  useEffect(() => onSnapshot(query(collection(db, "bookings"), where("createdAt", ">=", Timestamp.fromMillis(Date.now() - 3 * 3600000)), orderBy("createdAt", "desc"), limit(400)),
    (s) => setRows(s.docs.map((d) => d.data())), () => setRows([])), []);

  const zones = useMemo(() => {
    const m = {};
    (rows || []).forEach((b) => {
      if (!b.originLat) return;
      const k = `${Math.round(b.originLat / CELL)}_${Math.round(b.originLng / CELL)}`;
      const age = (Date.now() - (dOf(b.createdAt)?.getTime() || 0)) / 60000;
      const w = age < 30 ? 3 : age < 90 ? 2 : 1; // الأحدث أثقل
      const z = (m[k] = m[k] || { lat: Math.round(b.originLat / CELL) * CELL, lng: Math.round(b.originLng / CELL) * CELL, n: 0, score: 0, name: "" });
      z.n++; z.score += w; if (!z.name && b.originText) z.name = b.originText;
    });
    const arr = Object.values(m).sort((a, b) => b.score - a.score).slice(0, 12);
    const top = arr[0]?.score || 1;
    return arr.map((z) => ({ ...z, level: z.score / top, dist: driverLocation ? kmBetween(driverLocation, z) : null }));
  }, [rows, driverLocation]);
  const color = (l) => (l > 0.66 ? "#ef4444" : l > 0.33 ? "#f59e0b" : "#facc15");
  const center = driverLocation || zones[0] || { lat: 36.737, lng: 3.086 };
  const go = (z) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${z.lat},${z.lng}&travelmode=driving`, "_blank");

  return (
    <Shell C={C}>
      <Head C={C} title="🔥 مناطق الطلب المرتفع" onBack={onBack} />
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>طلبات آخر 3 ساعات، والأحدث أثقل. الأحمر = الأكثر طلباً.</div>
        <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${C.border}`, height: 340, marginBottom: 14 }}>
          {window.google?.maps ? (
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={center} zoom={12} onLoad={(m) => (mapRef.current = m)} options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: false }}>
              {zones.map((z, i) => <Circle key={i} center={{ lat: z.lat, lng: z.lng }} radius={650 + z.level * 350} options={{ fillColor: color(z.level), fillOpacity: 0.28 + z.level * 0.3, strokeColor: color(z.level), strokeOpacity: 0.7, strokeWeight: 1, clickable: false }} />)}
              {driverLocation && <Marker position={driverLocation} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 }} />}
            </GoogleMap>
          ) : <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>الخريطة غير متاحة</div>}
        </div>
        <div style={{ fontWeight: 800, color: C.text, marginBottom: 10 }}>أفضل المناطق الآن</div>
        {rows === null && <div style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>⏳</div>}
        {rows && !zones.length && <div style={{ textAlign: "center", color: C.textMuted, padding: 24, fontSize: 13 }}>لا طلبات في آخر 3 ساعات</div>}
        {zones.slice(0, 6).map((z, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: color(z.level) + "33", color: color(z.level), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.name || "منطقة"}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{z.n} طلب{z.dist !== null ? ` · على بعد ${z.dist.toFixed(1)} كم` : ""}</div>
            </div>
            <button onClick={() => go(z)} style={{ background: C.green, border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>اذهب</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}
