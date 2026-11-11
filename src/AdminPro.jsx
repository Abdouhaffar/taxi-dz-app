/* eslint-disable */
// لوحة الإدارة المتقدمة: لوحة معلومات حقيقية، عمليات مباشرة، سجل الرحلات، الطوارئ، بحث شامل
import { WILAYA_LIST } from "./Wilayas";
import { useState, useMemo, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { doc, updateDoc, setDoc, deleteDoc, addDoc, collection, Timestamp, serverTimestamp, onSnapshot, arrayUnion, increment } from "firebase/firestore";

// ===== الثيم =====
export const T = {
  bg: "#0f0b0d", panel: "#161113", panel2: "#1d1619", border: "#2c2126",
  text: "#fff5f6", muted: "#c7a9ae", dim: "#7a5c62",
  brand: "#c4001d", brandL: "#ff5a70",
  ok: "#3fb950", warn: "#e3a008", bad: "#f85149", info: "#58a6ff",
};
const FONT = "'IBM Plex Sans Arabic',Cairo,sans-serif";
const MAP_LIBS = ["places"];
const ALGERIA = { lat: 28.0339, lng: 1.6596 };

// ===== أدوات =====
export const toDate = (v) => v?.toDate?.() || (v?.seconds ? new Date(v.seconds * 1000) : null);
const DA = (n) => `${Math.round(n || 0).toLocaleString("en-US")} دج`;
const num = (n) => Math.round(n || 0).toLocaleString("en-US");
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ago = (d) => {
  if (!d) return "—";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  return `منذ ${Math.floor(s / 86400)} يوم`;
};
const fmtDT = (d) => d ? `${d.toLocaleDateString("ar-DZ")} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—";

export const ACTIVE = ["accepted", "arrived", "started", "ongoing", "picked_up"];
export const DONE = ["completed", "rated"];
export const STATUS = {
  pending: { label: "بانتظار سائق", color: T.warn },
  accepted: { label: "مقبولة", color: T.info },
  arrived: { label: "السائق وصل", color: T.info },
  started: { label: "جارية", color: T.info },
  ongoing: { label: "جارية", color: T.info },
  picked_up: { label: "جارية", color: T.info },
  completed: { label: "مكتملة", color: T.ok },
  rated: { label: "مكتملة", color: T.ok },
  cancelled: { label: "ملغاة", color: T.bad },
};
const st = (s) => STATUS[s] || { label: s || "—", color: T.muted };

function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useIsMobile(bp = 900) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

// ===== مكوّنات صغيرة =====
const Card = ({ children, style, pad: p = 20 }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 18, padding: p, ...style }}>{children}</div>
);
const Pill = ({ color, children }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>
);
const PageTitle = ({ title, sub, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: T.text, letterSpacing: -0.3 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
    {right}
  </div>
);
const Seg = ({ value, onChange, options }) => (
  <div style={{ display: "inline-flex", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: 3 }}>
    {options.map((o) => (
      <button key={o.v} onClick={() => onChange(o.v)} style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, padding: "7px 14px", borderRadius: 9, background: value === o.v ? T.brand : "transparent", color: value === o.v ? "#fff" : T.muted, transition: "all .2s" }}>{o.l}</button>
    ))}
  </div>
);
const Empty = ({ icon = "📭", text }) => (
  <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "28px 0" }}><div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>{text}</div>
);

// ===== مخططات SVG =====
function Spark({ data, color = T.brandL, w = 90, h = 30 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(1, ...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function AreaChart({ data, color = T.brandL, height = 200, fmt = num }) {
  const [hi, setHi] = useState(null);
  const W = 640, H = height, padL = 8, padR = 8, padT = 16, padB = 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i) => padL + (i / Math.max(1, data.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const gid = "ag" + color.replace("#", "");
  const step = Math.ceil(data.length / 7);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", direction: "ltr" }} onMouseLeave={() => setHi(null)}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.38" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => <line key={i} x1={padL} x2={W - padR} y1={padT + p * (H - padT - padB)} y2={padT + p * (H - padT - padB)} stroke={T.border} strokeDasharray="3 5" />)}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (i % step === 0 || i === data.length - 1) && <text key={i} x={x(i)} y={H - 7} fontSize="10" fill={T.dim} textAnchor="middle">{d.label}</text>)}
        {data.map((d, i) => <rect key={i} x={x(i) - (W / data.length) / 2} y={0} width={W / data.length} height={H} fill="transparent" onMouseEnter={() => setHi(i)} onTouchStart={() => setHi(i)} />)}
        {hi !== null && <g><line x1={x(hi)} x2={x(hi)} y1={padT} y2={H - padB} stroke={color} strokeOpacity="0.4" /><circle cx={x(hi)} cy={y(data[hi].value)} r="5" fill={color} stroke="#fff" strokeWidth="2" /></g>}
      </svg>
      {hi !== null && (
        <div style={{ position: "absolute", top: 0, left: `${(x(hi) / W) * 100}%`, transform: "translateX(-50%)", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", fontSize: 12, color: T.text, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 8px 20px rgba(0,0,0,.4)" }}>
          <div style={{ color: T.muted, fontSize: 10 }}>{data[hi].full || data[hi].label}</div><b>{fmt(data[hi].value)}</b>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, color = T.brand, height = 150, hl }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, direction: "ltr" }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.value}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ width: "100%", height: `${Math.max(d.value ? 4 : 1, (d.value / max) * 100)}%`, background: i === hl ? T.brandL : color, opacity: d.value ? 1 : 0.25, borderRadius: "4px 4px 2px 2px", transition: "height .6s cubic-bezier(.2,.8,.2,1)" }} />
          <div style={{ fontSize: 9, color: T.dim }}>{d.tick ? d.label : ""}</div>
        </div>
      ))}
    </div>
  );
}

function HBars({ items, color = T.brand, fmt = num }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <Empty text="لا توجد بيانات بعد" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
            <span style={{ color: T.text, fontWeight: 600 }}>{it.label}</span><span style={{ color: T.muted }}>{it.sub || fmt(it.value)}</span>
          </div>
          <div style={{ height: 7, background: T.panel2, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(it.value / max) * 100}%`, height: "100%", background: `linear-gradient(90deg,${color},${T.brandL})`, borderRadius: 4, transition: "width .8s cubic-bezier(.2,.8,.2,1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function KPI({ icon, label, value, sub, delta, spark, color = T.brandL, onClick }) {
  const up = delta > 0, flat = delta === 0 || delta === null || delta === undefined || Number.isNaN(delta);
  return (
    <Card pad={18} style={{ position: "relative", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}>
      <div onClick={onClick}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{label}</div>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: T.text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, gap: 8 }}>
          <div style={{ fontSize: 11, color: T.muted, minWidth: 0 }}>
            {!flat && <span style={{ color: up ? T.ok : T.bad, fontWeight: 800, marginInlineEnd: 6 }}>{up ? "▲" : "▼"} {Math.abs(delta)}%</span>}
            {sub}
          </div>
          <Spark data={spark} color={color} />
        </div>
      </div>
    </Card>
  );
}

// ================================================================
// لوحة المعلومات
// ================================================================
export function DashboardPro({ bookings, drivers, passengers, reports, sos, onNav, isMobile }) {
  const [days, setDays] = useState(14);

  const m = useMemo(() => {
    const today = startOfDay(new Date());
    const curStart = addDays(today, -(days - 1));
    const prevStart = addDays(curStart, -days);
    const dayOf = (b) => toDate(b.completedAt) || toDate(b.createdAt);
    const inRange = (d, a, b) => d && d >= a && d < b;
    const curEnd = addDays(today, 1);

    const created = bookings.map((b) => ({ b, d: toDate(b.createdAt) })).filter((x) => x.d);
    const curC = created.filter((x) => inRange(x.d, curStart, curEnd));
    const prevC = created.filter((x) => inRange(x.d, prevStart, curStart));
    const done = (arr) => arr.filter((x) => DONE.includes(x.b.status));
    const curDone = done(curC), prevDone = done(prevC);
    const sum = (arr) => arr.reduce((s, x) => s + (x.b.price || 0), 0);
    const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

    const labels = Array.from({ length: days }, (_, i) => addDays(curStart, i));
    const rev = labels.map((d) => ({ label: `${d.getDate()}/${d.getMonth() + 1}`, full: d.toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" }), value: 0 }));
    const rides = labels.map((d) => ({ label: `${d.getDate()}`, value: 0 }));
    const idx = {}; labels.forEach((d, i) => (idx[dayKey(d)] = i));
    curDone.forEach(({ b }) => { const k = dayKey(dayOf(b)); if (idx[k] !== undefined) { rev[idx[k]].value += b.price || 0; rides[idx[k]].value += 1; } });

    const hours = Array.from({ length: 24 }, (_, h) => ({ label: `${h}`, value: 0, tick: h % 3 === 0 }));
    curC.forEach(({ d }) => hours[d.getHours()].value++);
    const peak = hours.reduce((p, h, i) => (h.value > hours[p].value ? i : p), 0);

    const cancelled = curC.filter((x) => x.b.status === "cancelled").length;
    const waits = curC.map(({ b, d }) => { const a = toDate(b.acceptedAt); return a && d ? (a - d) / 60000 : null; }).filter((v) => v !== null && v >= 0 && v < 120);
    const avgWait = waits.length ? waits.reduce((s, v) => s + v, 0) / waits.length : null;

    const byDriver = {};
    curDone.forEach(({ b }) => {
      const id = b.driverId || b.driverInfo?.uid; if (!id) return;
      byDriver[id] = byDriver[id] || { name: b.driverInfo?.name || "سائق", rides: 0, revenue: 0 };
      byDriver[id].rides++; byDriver[id].revenue += b.price || 0;
    });
    const top = Object.values(byDriver).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const byWilaya = {};
    drivers.forEach((d) => { if (d.wilaya) byWilaya[d.wilaya] = (byWilaya[d.wilaya] || 0) + 1; });
    const wilayas = Object.entries(byWilaya).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value, sub: `${value} سائق` }));

    const newUsers = [...passengers, ...drivers].filter((u) => inRange(toDate(u.createdAt), curStart, curEnd)).length;
    const newUsersPrev = [...passengers, ...drivers].filter((u) => inRange(toDate(u.createdAt), prevStart, curStart)).length;
    const hasUserDates = [...passengers, ...drivers].some((u) => toDate(u.createdAt));

    const activeNow = bookings.filter((b) => ACTIVE.includes(b.status)).length;
    const waitingNow = bookings.filter((b) => b.status === "pending" && (toDate(b.createdAt) || 0) > Date.now() - 30 * 60000).length;
    const online = drivers.filter((d) => d.isOnline && d.verificationStatus === "approved").length;

    return {
      revenue: sum(curDone), revenueDelta: pct(sum(curDone), sum(prevDone)),
      ridesDone: curDone.length, ridesDelta: pct(curDone.length, prevDone.length),
      requests: curC.length,
      completion: curC.length ? Math.round((curDone.length / curC.length) * 100) : 0,
      cancelRate: curC.length ? Math.round((cancelled / curC.length) * 100) : 0,
      avgFare: curDone.length ? sum(curDone) / curDone.length : 0,
      avgWait, rev, rides, hours, peak, top, wilayas, newUsers, newUsersDelta: pct(newUsers, newUsersPrev), hasUserDates,
      activeNow, waitingNow, online,
    };
  }, [bookings, drivers, passengers, days]);

  // تنبيهات تحتاج تدخلاً
  const openSos = sos.filter((s) => !s.resolved).length;
  const pendingDrivers = drivers.filter((d) => d.verificationStatus === "pending").length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const pendingSubs = drivers.filter((d) => d.subscriptionRequest?.status === "pending").length;
  const stale = bookings.filter((b) => b.status === "pending" && (toDate(b.createdAt) || new Date()) < new Date(Date.now() - 5 * 60000) && (toDate(b.createdAt) || 0) > Date.now() - 30 * 60000).length;
  const alerts = [
    openSos > 0 && { icon: "🆘", text: `${openSos} نداء طوارئ مفتوح`, tab: "safety", color: T.bad, hot: true },
    stale > 0 && { icon: "⏱️", text: `${stale} طلب ينتظر سائقاً منذ أكثر من 5 دقائق`, tab: "live", color: T.warn },
    pendingDrivers > 0 && { icon: "🪪", text: `${pendingDrivers} سائق بانتظار التوثيق`, tab: "drivers", color: T.warn },
    pendingReports > 0 && { icon: "🚨", text: `${pendingReports} تبليغ لم يُعالج`, tab: "complaints", color: T.warn },
    pendingSubs > 0 && { icon: "💳", text: `${pendingSubs} طلب اشتراك`, tab: "subscriptions", color: T.info },
  ].filter(Boolean);

  // سجل النشاط الحقيقي
  const feed = useMemo(() => {
    const ev = [];
    bookings.forEach((b) => {
      const c = toDate(b.createdAt), a = toDate(b.acceptedAt), f = toDate(b.completedAt);
      if (f) ev.push({ t: f, icon: "✅", color: T.ok, text: `اكتملت رحلة ${b.passengerName || ""} — ${DA(b.price)}` });
      else if (b.status === "cancelled" && c) ev.push({ t: c, icon: "❌", color: T.bad, text: `أُلغي طلب ${b.passengerName || "راكب"}` });
      else if (a) ev.push({ t: a, icon: "🚕", color: T.info, text: `قبل ${b.driverInfo?.name || "سائق"} طلب ${b.passengerName || "راكب"}` });
      else if (c) ev.push({ t: c, icon: "📍", color: T.warn, text: `طلب جديد من ${b.passengerName || "راكب"} — ${DA(b.price)}` });
    });
    sos.forEach((s) => { const t = toDate(s.createdAt); if (t) ev.push({ t, icon: "🆘", color: T.bad, text: `نداء طوارئ من ${s.driverName || s.passengerName || "مستخدم"}` }); });
    reports.forEach((r) => { const t = toDate(r.createdAt); if (t) ev.push({ t, icon: "🚨", color: T.warn, text: `تبليغ عن ${r.targetName || "مستخدم"}` }); });
    [...drivers.map((d) => ({ ...d, k: "سائق" })), ...passengers.map((p) => ({ ...p, k: "راكب" }))].forEach((u) => {
      const t = toDate(u.createdAt); if (t) ev.push({ t, icon: u.k === "سائق" ? "🪪" : "👤", color: T.info, text: `${u.k} جديد: ${u.name || "—"}` });
    });
    return ev.sort((a, b) => b.t - a.t).slice(0, 14);
  }, [bookings, drivers, passengers, sos, reports]);

  const g = isMobile ? "1fr" : undefined;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء النور";

  return (
    <div>
      <PageTitle title={`${greet} 👋`} sub="نظرة حيّة على أداء AL-BURAQ"
        right={<Seg value={days} onChange={setDays} options={[{ v: 7, l: "7 أيام" }, { v: 14, l: "14 يوماً" }, { v: 30, l: "30 يوماً" }]} />} />

      {/* تنبيهات تتطلب تدخلاً */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {alerts.map((a, i) => (
            <button key={i} onClick={() => onNav(a.tab)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: a.color + "18", border: `1px solid ${a.color}55`, color: T.text, borderRadius: 14, padding: "10px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", animation: a.hot ? "adminPulse 1.6s ease-in-out infinite" : "none" }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>{a.text}<span style={{ color: a.color }}>←</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI icon="💰" label="الإيرادات" value={DA(m.revenue)} delta={m.revenueDelta} sub="مقابل الفترة السابقة" spark={m.rev.map((r) => r.value)} color={T.brandL} />
        <KPI icon="🚕" label="رحلات مكتملة" value={num(m.ridesDone)} delta={m.ridesDelta} sub={`من ${m.requests} طلب`} spark={m.rides.map((r) => r.value)} color={T.ok} />
        <KPI icon="🟢" label="سائقون متصلون الآن" value={num(m.online)} sub={`${num(m.activeNow)} رحلة جارية`} color={T.ok} onClick={() => onNav("live")} />
        <KPI icon="⏳" label="طلبات تنتظر الآن" value={num(m.waitingNow)} sub="خلال آخر 30 دقيقة" color={T.warn} onClick={() => onNav("live")} />
        <KPI icon="🎯" label="معدل الإنجاز" value={`${m.completion}%`} sub="مكتملة ÷ كل الطلبات" color={T.info} />
        <KPI icon="🚫" label="معدل الإلغاء" value={`${m.cancelRate}%`} sub={m.cancelRate > 20 ? "مرتفع — راجع الأسباب" : "ضمن الحد الطبيعي"} color={m.cancelRate > 20 ? T.bad : T.warn} />
        <KPI icon="🧾" label="متوسط قيمة الرحلة" value={DA(m.avgFare)} sub={m.avgWait !== null ? `انتظار ${m.avgWait.toFixed(1)} د` : "—"} color={T.brandL} />
        <KPI icon="🆕" label="مستخدمون جدد" value={m.hasUserDates ? num(m.newUsers) : "—"} delta={m.hasUserDates ? m.newUsersDelta : null} sub={m.hasUserDates ? "ركاب + سائقون" : "لا يوجد تاريخ تسجيل"} color={T.info} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: g || "2fr 1fr", gap: 14, marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: T.text }}>💰 الإيرادات اليومية</div>
            <div style={{ fontSize: 12, color: T.muted }}>الإجمالي: <b style={{ color: T.text }}>{DA(m.revenue)}</b></div>
          </div>
          {m.revenue === 0 ? <Empty icon="📈" text="لا توجد رحلات مكتملة في هذه الفترة" /> : <AreaChart data={m.rev} fmt={DA} />}
        </Card>
        <Card>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>🕒 ساعات الذروة</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>{m.requests ? <>أعلى طلب عند الساعة <b style={{ color: T.brandL }}>{m.peak}:00</b></> : "لا طلبات بعد"}</div>
          <BarChart data={m.hours} hl={m.requests ? m.peak : -1} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: g || "1fr 1fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 14 }}>🏆 أفضل السائقين</div>
          <HBars items={m.top.map((t) => ({ label: t.name, value: t.revenue, sub: `${t.rides} رحلة · ${DA(t.revenue)}` }))} />
        </Card>
        <Card>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 14 }}>📍 السائقون حسب الولاية</div>
          <HBars items={m.wilayas} color={T.info} />
        </Card>
        <Card>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 10 }}>⚡ النشاط المباشر</div>
          {feed.length === 0 && <Empty text="لا نشاط بعد" />}
          <div style={{ maxHeight: 290, overflowY: "auto" }}>
            {feed.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < feed.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: e.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{e.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{e.text}</div>
                  <div style={{ fontSize: 10, color: T.dim }}>{ago(e.t)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ================================================================
// العمليات المباشرة (خريطة)
// ================================================================
const DARK_MAP = [
  { elementType: "geometry", stylers: [{ color: "#1d1619" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a7f85" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1619" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#33262b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a3036" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f0b0d" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export function LiveOps({ bookings, drivers, sos, isMobile }) {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || "", libraries: MAP_LIBS, language: "ar", region: "DZ" });
  const mapRef = useRef(null);
  const [sel, setSel] = useState(null);

  const onlineDrivers = drivers.filter((d) => d.isOnline && d.verificationStatus === "approved" && d.location?.lat);
  const live = bookings.filter((b) => (b.status === "pending" && (toDate(b.createdAt) || 0) > Date.now() - 30 * 60000) || ACTIVE.includes(b.status)).filter((b) => b.originLat);
  const openSos = sos.filter((s) => !s.resolved && s.location?.lat);

  const focus = (lat, lng, item) => { setSel(item); mapRef.current?.panTo({ lat, lng }); mapRef.current?.setZoom(15); };
  const center = onlineDrivers[0]?.location || live[0] && { lat: live[0].originLat, lng: live[0].originLng } || ALGERIA;

  const dot = (color, scale = 9) => ({ path: window.google.maps.SymbolPath.CIRCLE, scale, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 });

  const sidebar = (
    <div style={{ width: isMobile ? "100%" : 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, maxHeight: isMobile ? "none" : "calc(100vh - 150px)", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[[onlineDrivers.length, "سائق متصل", T.ok], [live.filter((b) => b.status === "pending").length, "ينتظرون", T.warn], [live.filter((b) => ACTIVE.includes(b.status)).length, "رحلة جارية", T.info]].map(([v, l, c], i) => (
          <Card key={i} pad={12} style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: c }}>{v}</div><div style={{ fontSize: 10, color: T.muted }}>{l}</div></Card>
        ))}
      </div>
      {openSos.length > 0 && <Card pad={12} style={{ borderColor: T.bad, background: T.bad + "14" }}>{openSos.map((s) => <div key={s.id} onClick={() => focus(s.location.lat, s.location.lng, { type: "sos", ...s })} style={{ cursor: "pointer", fontSize: 13, color: T.text, fontWeight: 700 }}>🆘 {s.driverName || s.passengerName} — {ago(toDate(s.createdAt))}</div>)}</Card>}
      <Card pad={14}>
        <div style={{ fontWeight: 800, fontSize: 13, color: T.text, marginBottom: 8 }}>الرحلات الحية ({live.length})</div>
        {live.length === 0 && <Empty icon="🌙" text="لا رحلات حية الآن" />}
        {live.map((b) => (
          <div key={b.id} onClick={() => focus(b.originLat, b.originLng, { type: "trip", ...b })} style={{ padding: "9px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{b.passengerName || "راكب"}</span><Pill color={st(b.status).color}>{st(b.status).label}</Pill></div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{b.originText?.slice(0, 28)} ← {b.destText?.slice(0, 22)}</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{DA(b.price)} · {ago(toDate(b.createdAt))}</div>
          </div>
        ))}
      </Card>
      <Card pad={14}>
        <div style={{ fontWeight: 800, fontSize: 13, color: T.text, marginBottom: 8 }}>السائقون المتصلون ({onlineDrivers.length})</div>
        {onlineDrivers.length === 0 && <Empty icon="🚗" text="لا سائقين متصلين" />}
        {onlineDrivers.map((d) => (
          <div key={d.id} onClick={() => focus(d.location.lat, d.location.lng, { type: "driver", ...d })} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontSize: 13 }}>
            <span style={{ color: T.text }}>🟢 {d.name}</span><span style={{ color: T.muted, fontSize: 11 }}>{d.carBrand} {d.carModel}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  return (
    <div>
      <PageTitle title="🗺️ العمليات المباشرة" sub="السائقون والرحلات على الخريطة لحظة بلحظة" />
      <div style={{ display: "flex", gap: 14, flexDirection: isMobile ? "column-reverse" : "row" }}>
        {sidebar}
        <div style={{ flex: 1, minHeight: isMobile ? 380 : "calc(100vh - 150px)", borderRadius: 18, overflow: "hidden", border: `1px solid ${T.border}`, background: T.panel }}>
          {loadError || !process.env.REACT_APP_GOOGLE_MAPS_KEY ? (
            <Empty icon="🗺️" text="تعذر تحميل الخريطة — تحقق من مفتاح Google Maps وقيود النطاق" />
          ) : !isLoaded ? <Empty icon="⏳" text="جارٍ تحميل الخريطة…" /> : (
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%", minHeight: isMobile ? 380 : "calc(100vh - 150px)" }} center={center} zoom={onlineDrivers.length || live.length ? 12 : 5}
              onLoad={(m) => (mapRef.current = m)} options={{ styles: DARK_MAP, disableDefaultUI: true, zoomControl: true, clickableIcons: false }}>
              {onlineDrivers.map((d) => <Marker key={d.id} position={d.location} icon={dot("#3fb950")} onClick={() => setSel({ type: "driver", ...d })} />)}
              {live.map((b) => <Marker key={b.id} position={{ lat: b.originLat, lng: b.originLng }} icon={dot(b.status === "pending" ? "#e3a008" : "#58a6ff", 8)} onClick={() => setSel({ type: "trip", ...b })} />)}
              {openSos.map((s) => <Marker key={s.id} position={s.location} icon={dot("#f85149", 12)} onClick={() => setSel({ type: "sos", ...s })} />)}
              {sel && (() => {
                const pos = sel.type === "driver" ? sel.location : sel.type === "sos" ? sel.location : { lat: sel.originLat, lng: sel.originLng };
                return (
                  <InfoWindow position={pos} onCloseClick={() => setSel(null)}>
                    <div style={{ direction: "rtl", fontFamily: FONT, color: "#1c1a1d", minWidth: 170, fontSize: 12, lineHeight: 1.7 }}>
                      {sel.type === "driver" && <><b>🚕 {sel.name}</b><br />{sel.carBrand} {sel.carModel} · {sel.plateNumber || ""}<br />📞 {sel.phone}</>}
                      {sel.type === "trip" && <><b>👤 {sel.passengerName}</b><br />{st(sel.status).label} · {DA(sel.price)}<br />من: {sel.originText}<br />إلى: {sel.destText}<br />{sel.driverInfo?.name && <>🚕 {sel.driverInfo.name}</>}</>}
                      {sel.type === "sos" && <><b>🆘 {sel.driverName || sel.passengerName}</b><br />{sel.driverPhone && <>📞 {sel.driverPhone}</>}</>}
                    </div>
                  </InfoWindow>
                );
              })()}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// سجل الرحلات
// ================================================================
export function RidesPanel({ bookings, isMobile }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("30");
  const [sel, setSel] = useState(null);

  const rows = useMemo(() => {
    const from = range === "all" ? null : addDays(startOfDay(new Date()), -(Number(range) - 1));
    const s = q.trim().toLowerCase();
    return bookings
      .map((b) => ({ ...b, _c: toDate(b.createdAt) }))
      .filter((b) => !from || (b._c && b._c >= from))
      .filter((b) => status === "all" || (status === "active" ? ACTIVE.includes(b.status) : status === "done" ? DONE.includes(b.status) : b.status === status))
      .filter((b) => !s || [b.id, b.passengerName, b.passengerPhone, b.driverInfo?.name, b.driverInfo?.phone, b.originText, b.destText].some((v) => String(v || "").toLowerCase().includes(s)))
      .sort((a, b) => (b._c || 0) - (a._c || 0));
  }, [bookings, q, status, range]);

  const total = rows.filter((b) => DONE.includes(b.status)).reduce((s, b) => s + (b.price || 0), 0);

  const exportCsv = () => downloadCSV(`rides-${dayKey(new Date())}.csv`, [
    ["المعرّف", "التاريخ", "الحالة", "الراكب", "هاتف الراكب", "السائق", "من", "إلى", "المسافة كم", "السعر دج"],
    ...rows.map((b) => [b.id, fmtDT(b._c), st(b.status).label, b.passengerName, b.passengerPhone, b.driverInfo?.name, b.originText, b.destText, b.distanceKm?.toFixed?.(1), b.price]),
  ]);

  return (
    <div>
      <PageTitle title="🧾 الرحلات" sub={`${rows.length} رحلة · إيرادات مكتملة ${DA(total)}`}
        right={<button onClick={exportCsv} style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: "9px 16px", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>⬇️ تصدير CSV</button>} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 بحث: اسم، هاتف، عنوان، معرّف…" style={{ flex: "1 1 240px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", color: T.text, fontFamily: "inherit", fontSize: 14, outline: "none" }} />
        <Seg value={range} onChange={setRange} options={[{ v: "1", l: "اليوم" }, { v: "7", l: "7 أيام" }, { v: "30", l: "30 يوماً" }, { v: "all", l: "الكل" }]} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[["all", "الكل"], ["pending", "بانتظار سائق"], ["active", "جارية"], ["done", "مكتملة"], ["cancelled", "ملغاة"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} style={{ border: `1px solid ${status === v ? T.brand : T.border}`, background: status === v ? T.brand + "22" : "transparent", color: status === v ? T.brandL : T.muted, borderRadius: 20, padding: "6px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      <Card pad={0} style={{ overflow: "hidden" }}>
        {rows.length === 0 && <Empty text="لا توجد رحلات مطابقة" />}
        {rows.slice(0, 200).map((b) => (
          <div key={b.id} onClick={() => setSel(b)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", flexWrap: isMobile ? "wrap" : "nowrap" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: st(b.status).color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{DONE.includes(b.status) ? "✅" : b.status === "cancelled" ? "❌" : b.status === "pending" ? "⏳" : "🚕"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{b.passengerName || "راكب"} <span style={{ color: T.dim, fontWeight: 400, fontSize: 12 }}>→ {b.driverInfo?.name || "بدون سائق"}</span></div>
              <div style={{ fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.originText} ← {b.destText}</div>
            </div>
            <div style={{ textAlign: "left", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>{DA(b.price)}</div>
              <div style={{ fontSize: 11, color: T.dim }}>{fmtDT(b._c)}</div>
            </div>
            <Pill color={st(b.status).color}>{st(b.status).label}</Pill>
          </div>
        ))}
      </Card>
      {rows.length > 200 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12, marginTop: 10 }}>يعرض أحدث 200 — استخدم التصدير للقائمة الكاملة</div>}

      {sel && <RideDrawer b={sel} onClose={() => setSel(null)} isMobile={isMobile} />}
    </div>
  );
}

function RideDrawer({ b, onClose, isMobile }) {
  const steps = [
    { l: "تم إنشاء الطلب", t: toDate(b.createdAt), c: T.warn },
    { l: `قبل السائق ${b.driverInfo?.name || ""}`, t: toDate(b.acceptedAt), c: T.info },
    { l: b.status === "cancelled" ? "أُلغيت الرحلة" : "اكتملت الرحلة", t: toDate(b.completedAt), c: b.status === "cancelled" ? T.bad : T.ok, show: b.status === "cancelled" || DONE.includes(b.status) },
  ].filter((s) => s.t || s.show);
  const row = (k, v) => v ? <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}><span style={{ color: T.muted }}>{k}</span><span style={{ color: T.text, fontWeight: 600, textAlign: "left" }}>{v}</span></div> : null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: isMobile ? "100%" : 440, background: T.bg, borderRight: `1px solid ${T.border}`, overflowY: "auto", padding: 24, animation: "adminSlide .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>تفاصيل الرحلة</div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: T.panel, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: T.text }}>{DA(b.price)}</div><Pill color={st(b.status).color}>{st(b.status).label}</Pill>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{b.distanceKm ? `${b.distanceKm.toFixed(1)} كم` : ""} {b.rideType ? `· ${b.rideType}` : ""}</div>
        </Card>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.ok }} /><div style={{ flex: 1, width: 2, background: T.border, margin: "4px 0" }} /><div style={{ width: 10, height: 10, borderRadius: 2, background: T.brandL }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, marginBottom: 14 }}>{b.originText || "—"}</div>
              <div style={{ fontSize: 13, color: T.text }}>{b.destText || "—"}</div>
            </div>
          </div>
        </Card>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 6 }}>الأطراف</div>
          {row("الراكب", b.passengerName)}{row("هاتف الراكب", b.passengerPhone && <a href={`tel:${b.passengerPhone}`} style={{ color: T.brandL }}>{b.passengerPhone}</a>)}
          {row("السائق", b.driverInfo?.name)}{row("هاتف السائق", b.driverInfo?.phone && <a href={`tel:${b.driverInfo.phone}`} style={{ color: T.brandL }}>{b.driverInfo.phone}</a>)}
          {row("السيارة", [b.driverInfo?.carBrand, b.driverInfo?.carModel, b.driverInfo?.carColor].filter(Boolean).join(" "))}{row("اللوحة", b.driverInfo?.plateNumber)}
          {row("الركاب", b.passengers)}{row("الأمتعة", b.luggageDesc)}
        </Card>
        <Card>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 12 }}>المسار الزمني</div>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.c, marginTop: 5, boxShadow: `0 0 0 4px ${s.c}22` }} />
              <div><div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{s.l}</div><div style={{ fontSize: 11, color: T.dim }}>{fmtDT(s.t)}</div></div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: T.dim, direction: "ltr", textAlign: "left", marginTop: 6 }}>ID: {b.id}</div>
        </Card>
      </div>
    </div>
  );
}

// ================================================================
// الطوارئ
// ================================================================
export function SafetyPanel({ sos, db, isMobile }) {
  const sorted = [...sos].sort((a, b) => (a.resolved === b.resolved ? (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0) : a.resolved ? 1 : -1));
  const open = sos.filter((s) => !s.resolved).length;
  const resolve = async (id) => {
    try { await updateDoc(doc(db, "sos_alerts", id), { resolved: true, resolvedAt: serverTimestamp() }); }
    catch (e) { alert("❌ تعذر التحديث: " + (e.code === "permission-denied" ? "قواعد Firestore تمنع الأدمن من تعديل sos_alerts" : e.message)); }
  };
  return (
    <div>
      <PageTitle title="🆘 الطوارئ والسلامة" sub={open ? `${open} نداء مفتوح يحتاج تدخلاً فورياً` : "لا نداءات مفتوحة ✅"} />
      {sorted.length === 0 && <Card><Empty icon="🛡️" text="لم يصل أي نداء طوارئ" /></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((s) => {
          const loc = s.location;
          return (
            <Card key={s.id} style={{ borderColor: s.resolved ? T.border : T.bad, background: s.resolved ? T.panel : T.bad + "10" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{s.resolved ? "✅" : "🆘"} {s.driverName || s.passengerName || "مستخدم"} <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>({s.driverId ? "سائق" : "راكب"})</span></div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{fmtDT(toDate(s.createdAt))} · {ago(toDate(s.createdAt))}</div>
                  {s.bookingId && <div style={{ fontSize: 11, color: T.dim, marginTop: 2, direction: "ltr", textAlign: "right" }}>رحلة: {s.bookingId}</div>}
                </div>
                <Pill color={s.resolved ? T.ok : T.bad}>{s.resolved ? "تمت المعالجة" : "مفتوح"}</Pill>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {s.driverPhone && <a href={`tel:${s.driverPhone}`} style={{ textDecoration: "none", background: T.panel2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>📞 اتصال</a>}
                {loc?.lat && <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", background: T.panel2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>📍 الموقع</a>}
                {!s.resolved && <button onClick={() => resolve(s.id)} style={{ background: T.ok, border: "none", color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>✓ تمت المعالجة</button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================
// بحث شامل
// ================================================================
export function GlobalSearch({ drivers, passengers, bookings, onNav }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const res = useMemo(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return [];
    const has = (...v) => v.some((x) => String(x || "").toLowerCase().includes(s));
    return [
      ...drivers.filter((d) => has(d.name, d.phone, d.plateNumber, d.email)).slice(0, 4).map((d) => ({ k: "سائق", icon: "🚕", t: d.name, s: `${d.phone || ""} · ${d.carBrand || ""}`, tab: "drivers" })),
      ...passengers.filter((p) => has(p.name, p.phone, p.email)).slice(0, 4).map((p) => ({ k: "راكب", icon: "👤", t: p.name, s: p.phone, tab: "passengers" })),
      ...bookings.filter((b) => has(b.id, b.passengerName, b.passengerPhone, b.driverInfo?.name)).slice(0, 4).map((b) => ({ k: "رحلة", icon: "🧾", t: `${b.passengerName || "راكب"} — ${DA(b.price)}`, s: `${b.originText || ""}`, tab: "rides" })),
    ];
  }, [q, drivers, passengers, bookings]);
  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 460 }}>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="🔎 ابحث عن سائق، راكب، رحلة، رقم هاتف…" style={{ width: "100%", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", color: T.text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
      {open && res.length > 0 && (
        <div style={{ position: "absolute", top: 46, right: 0, left: 0, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,.5)", zIndex: 60 }}>
          {res.map((r, i) => (
            <div key={i} onMouseDown={() => { onNav(r.tab); setQ(""); }} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: i < res.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{r.t}</div><div style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.s}</div></div>
              <Pill color={T.info}>{r.k}</Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ================================================================
// التسعير (settings/pricing) — يقرأه تطبيق الراكب مباشرة
// ================================================================
const DEF_PRICE = { perKm: 30, base: 40, min: 100, mult: { economy: 1, comfort: 1.4, xl: 1.8 } };
export function PricingPanel({ db, adminName, canEdit }) {
  const [p, setP] = useState(DEF_PRICE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [km, setKm] = useState(10);
  useEffect(() => onSnapshot(doc(db, "settings", "pricing"), (s) => {
    if (s.exists()) setP({ ...DEF_PRICE, ...s.data(), mult: { ...DEF_PRICE.mult, ...(s.data().mult || {}) } });
    setLoaded(true);
  }, () => setLoaded(true)), [db]);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setM = (k, v) => setP((x) => ({ ...x, mult: { ...x.mult, [k]: v } }));
  const price = (mult) => { const r = Math.round((p.base + km * p.perKm) * mult); return km < 2 ? Math.max(r, p.min) : r; };
  const valid = p.perKm > 0 && p.base >= 0 && p.min > 0 && Object.values(p.mult).every((m) => m >= 1 && m <= 5);
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await setDoc(doc(db, "settings", "pricing"), { perKm: +p.perKm, base: +p.base, min: +p.min, mult: { economy: +p.mult.economy, comfort: +p.mult.comfort, xl: +p.mult.xl }, updatedAt: serverTimestamp(), updatedBy: adminName || "admin" }, { merge: true });
      setMsg("✅ تم الحفظ — يطبَّق فوراً على الطلبات الجديدة");
    } catch (e) { setMsg("❌ " + (e.code === "permission-denied" ? "قواعد Firestore تمنع الكتابة في settings" : e.message)); }
    setSaving(false);
  };
  const Field = ({ label, k, unit, step = 1, mult }) => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "0 12px" }}>
        <input type="number" step={step} min="0" disabled={!canEdit} value={mult ? p.mult[k] : p[k]} onChange={(e) => (mult ? setM(k, e.target.value) : set(k, e.target.value))}
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontFamily: "inherit", fontSize: 18, fontWeight: 800, padding: "11px 0", direction: "ltr", textAlign: "right" }} />
        <span style={{ color: T.dim, fontSize: 12 }}>{unit}</span>
      </div>
    </label>
  );
  return (
    <div>
      <PageTitle title="💰 التسعير" sub="غيّر الأسعار دون تحديث التطبيق — تنعكس فوراً عند الركاب" />
      {!loaded ? <Empty icon="⏳" text="جارٍ التحميل…" /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
          <Card>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 16 }}>الأسعار الأساسية</div>
            <Field label="سعر الانطلاق" k="base" unit="دج" />
            <Field label="السعر لكل كيلومتر" k="perKm" unit="دج / كم" />
            <Field label="الحد الأدنى للرحلة (أقل من 2 كم)" k="min" unit="دج" />
            <div style={{ fontWeight: 800, color: T.text, margin: "18px 0 12px" }}>معاملات الفئات</div>
            <Field label="اقتصادي" k="economy" unit="×" step={0.1} mult />
            <Field label="مريح" k="comfort" unit="×" step={0.1} mult />
            <Field label="XL" k="xl" unit="×" step={0.1} mult />
            {canEdit ? <button onClick={save} disabled={saving || !valid} style={{ width: "100%", background: valid ? T.brand : T.border, border: "none", color: "#fff", borderRadius: 12, padding: "13px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: valid ? "pointer" : "default" }}>{saving ? "جارٍ الحفظ…" : "حفظ الأسعار"}</button>
              : <div style={{ color: T.muted, fontSize: 12 }}>التعديل للأدمن الرئيسي فقط</div>}
            {!valid && <div style={{ color: T.bad, fontSize: 12, marginTop: 8 }}>تحقق من القيم (المعاملات بين 1 و5)</div>}
            {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("✅") ? T.ok : T.bad }}>{msg}</div>}
          </Card>
          <Card>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 12 }}>معاينة السعر</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>المسافة: <b style={{ color: T.text }}>{km} كم</b></div>
            <input type="range" min="1" max="100" value={km} onChange={(e) => setKm(+e.target.value)} style={{ width: "100%", accentColor: T.brand, marginBottom: 18 }} />
            {[["اقتصادي", "economy", "🚗"], ["مريح", "comfort", "🚙"], ["XL", "xl", "🚐"]].map(([l, k, ic]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.text, fontWeight: 700 }}>{ic} {l}</span><span style={{ fontSize: 20, fontWeight: 900, color: T.brandL }}>{DA(price(+p.mult[k] || 1))}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ================================================================
// العروض وأكواد الخصم (promos) — تُتحقق وتُسجَّل من الخادم
// ================================================================
export function PromosPanel({ db, canEdit }) {
  const [rows, setRows] = useState([]);
  const empty = { code: "", title: "", type: "percent", value: 10, maxDiscount: 0, minPrice: 0, maxUses: 0, perUser: 1, days: 30, public: true };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => onSnapshot(collection(db, "promos"), (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0))), () => {}), [db]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const create = async () => {
    const code = f.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (code.length < 3) return setErr("الكود 3 أحرف/أرقام على الأقل (إنجليزية)");
    if (!(+f.value > 0) || (f.type === "percent" && +f.value > 100)) return setErr("قيمة الخصم غير صحيحة");
    try {
      await setDoc(doc(db, "promos", code), {
        title: f.title.trim(), type: f.type, value: +f.value, maxDiscount: +f.maxDiscount || 0, minPrice: +f.minPrice || 0, maxUses: +f.maxUses || 0, perUser: +f.perUser || 1,
        active: true, public: !!f.public, usedCount: 0, totalDiscount: 0,
        expiresAt: +f.days > 0 ? Timestamp.fromDate(new Date(Date.now() + f.days * 86400000)) : null, createdAt: serverTimestamp(),
      });
      setF(empty); setOpen(false); setErr("");
    } catch (e) { setErr(e.code === "permission-denied" ? "قواعد Firestore تمنع الكتابة في promos" : e.message); }
  };
  const toggle = (r) => updateDoc(doc(db, "promos", r.id), { active: r.active === false }).catch((e) => alert(e.message));
  const del = (r) => window.confirm(`حذف الكود ${r.id}؟`) && deleteDoc(doc(db, "promos", r.id)).catch((e) => alert(e.message));
  const inp = { width: "100%", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontFamily: "inherit", fontSize: 14, outline: "none" };
  const F = ({ l, children }) => <label style={{ display: "block" }}><div style={{ fontSize: 11, color: T.muted, marginBottom: 5, fontWeight: 600 }}>{l}</div>{children}</label>;
  const totalDisc = rows.reduce((s, r) => s + (r.totalDiscount || 0), 0);
  const totalUse = rows.reduce((s, r) => s + (r.usedCount || 0), 0);
  return (
    <div>
      <PageTitle title="🎟️ العروض وأكواد الخصم" sub={`${totalUse} استعمال · كلفة الخصومات ${DA(totalDisc)}`}
        right={canEdit && <button onClick={() => setOpen(!open)} style={{ background: T.brand, border: "none", color: "#fff", borderRadius: 12, padding: "10px 18px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>{open ? "إلغاء" : "＋ كود جديد"}</button>} />
      {open && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <F l="الكود (إنجليزي)"><input style={{ ...inp, direction: "ltr", letterSpacing: 2, fontWeight: 800 }} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="WELCOME20" /></F>
            <F l="العنوان الظاهر للراكب"><input style={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="خصم الترحيب" /></F>
            <F l="النوع"><select style={inp} value={f.type} onChange={(e) => set("type", e.target.value)}><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت (دج)</option></select></F>
            <F l={f.type === "percent" ? "النسبة %" : "المبلغ دج"}><input type="number" style={inp} value={f.value} onChange={(e) => set("value", e.target.value)} /></F>
            {f.type === "percent" && <F l="سقف الخصم دج (0 = بدون)"><input type="number" style={inp} value={f.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} /></F>}
            <F l="أقل سعر للرحلة دج"><input type="number" style={inp} value={f.minPrice} onChange={(e) => set("minPrice", e.target.value)} /></F>
            <F l="أقصى عدد استعمالات (0 = مفتوح)"><input type="number" style={inp} value={f.maxUses} onChange={(e) => set("maxUses", e.target.value)} /></F>
            <F l="مرات الاستعمال لكل راكب"><input type="number" style={inp} value={f.perUser} onChange={(e) => set("perUser", e.target.value)} /></F>
            <F l="الصلاحية بالأيام (0 = دائم)"><input type="number" style={inp} value={f.days} onChange={(e) => set("days", e.target.value)} /></F>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "14px 0", color: T.text, fontSize: 13 }}><input type="checkbox" checked={f.public} onChange={(e) => set("public", e.target.checked)} /> إظهاره كعرض في الصفحة الرئيسية للركاب</label>
          {err && <div style={{ color: T.bad, fontSize: 13, marginBottom: 8 }}>{err}</div>}
          <button onClick={create} style={{ background: T.brand, border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>إنشاء</button>
        </Card>
      )}
      {rows.length === 0 && <Card><Empty icon="🎟️" text="لا توجد أكواد بعد" /></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const exp = toDate(r.expiresAt), expired = exp && exp < new Date(), full = r.maxUses > 0 && (r.usedCount || 0) >= r.maxUses;
          const live = r.active !== false && !expired && !full;
          return (
            <Card key={r.id} pad={16}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 900, fontSize: 18, color: T.text, letterSpacing: 2, direction: "ltr" }}>{r.id}</span>
                    <Pill color={live ? T.ok : T.dim}>{live ? "فعّال" : expired ? "منتهي" : full ? "مستنفد" : "متوقف"}</Pill>
                    {r.public && <Pill color={T.info}>عرض عام</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
                    {r.title && <>{r.title} · </>}{r.type === "percent" ? `${r.value}%${r.maxDiscount ? ` (حتى ${r.maxDiscount} دج)` : ""}` : `${r.value} دج`}
                    {r.minPrice ? ` · من ${r.minPrice} دج` : ""}{exp ? ` · حتى ${exp.toLocaleDateString("ar-DZ")}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{r.usedCount || 0}{r.maxUses ? ` / ${r.maxUses}` : ""} استعمال</div>
                  <div style={{ fontSize: 11, color: T.muted }}>كلفة {DA(r.totalDiscount)}</div>
                </div>
              </div>
              {canEdit && <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => toggle(r)} style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "7px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{r.active === false ? "تفعيل" : "إيقاف"}</button>
                <button onClick={() => del(r)} style={{ background: "none", border: `1px solid ${T.bad}55`, color: T.bad, borderRadius: 10, padding: "7px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>حذف</button>
              </div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================
// المهام والحوافز للسائقين (missions) — الاستلام يتحقق منه الخادم
// ================================================================
export function MissionsAdmin({ db, canEdit }) {
  const [rows, setRows] = useState([]);
  const empty = { title: "", description: "", metric: "rides", target: 10, period: "weekly", rtype: "points", amount: 100, days: 30 };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => onSnapshot(collection(db, "missions"), (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0))), () => {}), [db]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const create = async () => {
    if (!f.title.trim() || !(+f.target > 0) || !(+f.amount > 0)) return setErr("أكمل العنوان والهدف والمكافأة");
    try {
      await setDoc(doc(collection(db, "missions")), { title: f.title.trim(), description: f.description.trim(), metric: f.metric, target: +f.target, period: f.period, reward: { type: f.rtype, amount: +f.amount }, active: true,
        expiresAt: +f.days > 0 ? Timestamp.fromDate(new Date(Date.now() + f.days * 86400000)) : null, createdAt: serverTimestamp() });
      setF(empty); setOpen(false); setErr("");
    } catch (e) { setErr(e.code === "permission-denied" ? "قواعد Firestore تمنع الكتابة في missions" : e.message); }
  };
  const inp = { width: "100%", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontFamily: "inherit", fontSize: 14, outline: "none" };
  const F = ({ l, children }) => <label style={{ display: "block" }}><div style={{ fontSize: 11, color: T.muted, marginBottom: 5, fontWeight: 600 }}>{l}</div>{children}</label>;
  const PL = { daily: "يومية", weekly: "أسبوعية", monthly: "شهرية" };
  return (
    <div>
      <PageTitle title="🎯 المهام والحوافز" sub="حوافز للسائقين تزيد النشاط وقت الحاجة"
        right={canEdit && <button onClick={() => setOpen(!open)} style={{ background: T.brand, border: "none", color: "#fff", borderRadius: 12, padding: "10px 18px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>{open ? "إلغاء" : "＋ مهمة جديدة"}</button>} />
      {open && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <F l="العنوان"><input style={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="أكمل 20 رحلة هذا الأسبوع" /></F>
            <F l="وصف قصير"><input style={inp} value={f.description} onChange={(e) => set("description", e.target.value)} /></F>
            <F l="المقياس"><select style={inp} value={f.metric} onChange={(e) => set("metric", e.target.value)}><option value="rides">عدد الرحلات</option><option value="earnings">قيمة الدخل (دج)</option></select></F>
            <F l="الهدف"><input type="number" style={inp} value={f.target} onChange={(e) => set("target", e.target.value)} /></F>
            <F l="الفترة"><select style={inp} value={f.period} onChange={(e) => set("period", e.target.value)}><option value="daily">يومية</option><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option></select></F>
            <F l="نوع المكافأة"><select style={inp} value={f.rtype} onChange={(e) => set("rtype", e.target.value)}><option value="points">نقاط</option><option value="credit">خصم من الاشتراك (دج)</option></select></F>
            <F l="قيمة المكافأة"><input type="number" style={inp} value={f.amount} onChange={(e) => set("amount", e.target.value)} /></F>
            <F l="تنتهي بعد (أيام، 0 = دائمة)"><input type="number" style={inp} value={f.days} onChange={(e) => set("days", e.target.value)} /></F>
          </div>
          {err && <div style={{ color: T.bad, fontSize: 13, margin: "10px 0" }}>{err}</div>}
          <button onClick={create} style={{ marginTop: 14, background: T.brand, border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>إنشاء</button>
        </Card>
      )}
      {rows.length === 0 && <Card><Empty icon="🎯" text="لا توجد مهام بعد" /></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <Card key={r.id} pad={16}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontWeight: 800, color: T.text }}>{r.title}</span><Pill color={r.active === false ? T.dim : T.ok}>{r.active === false ? "متوقفة" : "فعّالة"}</Pill><Pill color={T.info}>{PL[r.period]}</Pill></div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>الهدف: {r.target} {r.metric === "rides" ? "رحلة" : "دج"} · المكافأة: {r.reward?.amount} {r.reward?.type === "credit" ? "دج خصم اشتراك" : "نقطة"}</div>
              </div>
              {canEdit && <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => updateDoc(doc(db, "missions", r.id), { active: r.active === false })} style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "7px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{r.active === false ? "تفعيل" : "إيقاف"}</button>
                <button onClick={() => window.confirm("حذف المهمة؟") && deleteDoc(doc(db, "missions", r.id))} style={{ background: "none", border: `1px solid ${T.bad}55`, color: T.bad, borderRadius: 10, padding: "7px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>حذف</button>
              </div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ================================================================
// إجراءات الحسابات (تحذير / إيقاف مؤقت / حظر دائم / إعادة تفعيل) + سجل التدقيق
// ================================================================
const colOf = (type) => (type === "driver" ? "drivers" : "passengers");
const ACT_L = { warn: "⚠️ تحذير", suspend: "⏸️ إيقاف مؤقت", ban: "⛔ حظر دائم", reinstate: "✅ إعادة تفعيل", note: "📝 ملاحظة" };
export function accountState(u) {
  const until = toDate(u.suspendedUntil);
  if (u.accountStatus === "banned") return { k: "banned", label: "محظور نهائياً", color: T.bad };
  if (u.accountStatus === "suspended" && (!until || until > new Date())) return { k: "suspended", label: until ? `موقوف حتى ${until.toLocaleDateString("ar-DZ")}` : "موقوف", color: T.warn };
  return { k: "active", label: "نشط", color: T.ok };
}
async function applyAction({ db, adminName, type, target, action, days, reason, reportId }) {
  const ref = doc(db, colOf(type), target.id);
  if (action === "warn") await updateDoc(ref, { warnings: increment(1) });
  if (action === "suspend") await updateDoc(ref, { accountStatus: "suspended", suspendedUntil: Timestamp.fromDate(new Date(Date.now() + days * 86400000)), suspendReason: reason || "", isOnline: false });
  if (action === "ban") await updateDoc(ref, { accountStatus: "banned", suspendedUntil: null, suspendReason: reason || "", isOnline: false });
  if (action === "reinstate") await updateDoc(ref, { accountStatus: "active", suspendedUntil: null, suspendReason: "" });
  await addDoc(collection(db, "admin_actions"), { adminName: adminName || "admin", targetId: target.id, targetType: type, targetName: target.name || "", action, days: days || null, reason: reason || "", reportId: reportId || null, createdAt: serverTimestamp() });
  if (reportId) await updateDoc(doc(db, "reports", reportId), { log: arrayUnion({ at: Timestamp.now(), by: adminName || "admin", action, note: reason || "", days: days || null }) });
}

function ActionBox({ db, adminName, type, target, reportId, isSuper, onDone }) {
  const [action, setAction] = useState("");
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const st = accountState(target);
  const go = async () => {
    if ((action === "suspend" || action === "ban") && !reason.trim()) return setErr("اكتب السبب (يظهر للمستخدم)");
    if (action === "ban" && !window.confirm(`حظر ${target.name} نهائياً؟`)) return;
    setBusy(true); setErr("");
    try { await applyAction({ db, adminName, type, target, action, days, reason, reportId }); setAction(""); setReason(""); onDone && onDone(); }
    catch (e) { setErr(e.code === "permission-denied" ? "قواعد Firestore تمنع هذا الإجراء" : e.message); }
    setBusy(false);
  };
  const b = (a, c) => <button key={a} onClick={() => setAction(action === a ? "" : a)} style={{ border: `1px solid ${action === a ? c : T.border}`, background: action === a ? c + "22" : T.panel2, color: action === a ? c : T.text, borderRadius: 10, padding: "8px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{ACT_L[a]}</button>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, color: T.text }}>إجراء على الحساب</div><Pill color={st.color}>{st.label}</Pill>
      </div>
      {target.suspendReason && st.k !== "active" && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>السبب: {target.suspendReason}</div>}
      {(target.warnings || 0) > 0 && <div style={{ fontSize: 12, color: T.warn, marginBottom: 10 }}>⚠️ {target.warnings} تحذير سابق</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {b("warn", T.warn)}{b("suspend", T.warn)}{isSuper && b("ban", T.bad)}{st.k !== "active" && b("reinstate", T.ok)}
      </div>
      {action && (
        <div style={{ marginTop: 12 }}>
          {action === "suspend" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {[1, 3, 7, 30].map((d) => <button key={d} onClick={() => setDays(d)} style={{ border: `1px solid ${days === d ? T.brand : T.border}`, background: days === d ? T.brand + "22" : "transparent", color: days === d ? T.brandL : T.muted, borderRadius: 20, padding: "5px 14px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{d === 1 ? "يوم" : `${d} أيام`}</button>)}
            </div>
          )}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={action === "reinstate" ? "ملاحظة (اختياري)" : "السبب (يظهر للمستخدم عند الإيقاف)"} style={{ width: "100%", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, color: T.text, fontFamily: "inherit", fontSize: 13, outline: "none", resize: "vertical" }} />
          {err && <div style={{ color: T.bad, fontSize: 12, marginTop: 6 }}>{err}</div>}
          <button onClick={go} disabled={busy} style={{ marginTop: 10, background: T.brand, border: "none", color: "#fff", borderRadius: 10, padding: "10px 22px", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>{busy ? "…" : "تنفيذ"}</button>
        </div>
      )}
    </div>
  );
}

// ================================================================
// إدارة الشكاوى (سجل كامل + إجراءات)
// ================================================================
const R_ST = { pending: ["معلقة", T.warn], resolved: ["معالجة", T.ok], dismissed: ["مُهملة", T.dim] };
export function ComplaintsPro({ reports, drivers, passengers, bookings, db, adminName, isSuper, isMobile }) {
  const [filter, setFilter] = useState("pending");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const counts = {}; reports.forEach((r) => (counts[r.targetId] = (counts[r.targetId] || 0) + 1));
  const rows = reports.filter((r) => filter === "all" || r.status === filter)
    .filter((r) => !q.trim() || [r.targetName, r.reporterName, r.reason].some((v) => String(v || "").includes(q.trim())))
    .sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
  const selected = sel && reports.find((r) => r.id === sel);
  return (
    <div>
      <PageTitle title="🚨 الشكاوى والبلاغات" sub={`${reports.length} بلاغ · ${reports.filter((r) => r.status === "pending").length} معلّق`} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 اسم أو سبب…" style={{ flex: "1 1 220px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", color: T.text, fontFamily: "inherit", fontSize: 14, outline: "none" }} />
        <Seg value={filter} onChange={setFilter} options={[{ v: "pending", l: "معلقة" }, { v: "resolved", l: "معالجة" }, { v: "dismissed", l: "مُهملة" }, { v: "all", l: "الكل" }]} />
      </div>
      <Card pad={0} style={{ overflow: "hidden" }}>
        {rows.length === 0 && <Empty icon="✅" text="لا توجد بلاغات" />}
        {rows.map((r) => (
          <div key={r.id} onClick={() => setSel(r.id)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 18px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: R_ST[r.status]?.[1] + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>{r.targetType === "driver" ? "🚕" : "👤"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.targetName} {counts[r.targetId] > 1 && <Pill color={T.bad}>{counts[r.targetId]} بلاغات</Pill>}</div>
              <div style={{ fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</div>
              <div style={{ fontSize: 11, color: T.dim }}>من {r.reporterName} · {ago(toDate(r.createdAt))}</div>
            </div>
            <Pill color={R_ST[r.status]?.[1] || T.muted}>{R_ST[r.status]?.[0] || r.status}</Pill>
          </div>
        ))}
      </Card>
      {selected && <ComplaintDrawer r={selected} reports={reports} drivers={drivers} passengers={passengers} bookings={bookings} db={db} adminName={adminName} isSuper={isSuper} isMobile={isMobile} onClose={() => setSel(null)} />}
    </div>
  );
}

function ComplaintDrawer({ r, reports, drivers, passengers, bookings, db, adminName, isSuper, isMobile, onClose }) {
  const [note, setNote] = useState("");
  const target = (r.targetType === "driver" ? drivers : passengers).find((u) => u.id === r.targetId);
  const others = reports.filter((x) => x.targetId === r.targetId && x.id !== r.id).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
  const rides = bookings.filter((b) => (r.targetType === "driver" ? b.driverId : b.passengerId) === r.targetId).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
  const cancelled = rides.filter((b) => b.status === "cancelled").length;
  const log = [...(r.log || [])].sort((a, b) => (toDate(b.at) || 0) - (toDate(a.at) || 0));
  const setStatus = async (status, label) => {
    try {
      await updateDoc(doc(db, "reports", r.id), { status, [status + "At"]: serverTimestamp(), log: arrayUnion({ at: Timestamp.now(), by: adminName || "admin", action: status, note: note.trim(), days: null }) });
      await addDoc(collection(db, "admin_actions"), { adminName: adminName || "admin", targetId: r.targetId, targetType: r.targetType, targetName: r.targetName || "", action: status, reason: note.trim(), reportId: r.id, createdAt: serverTimestamp() });
      setNote("");
    } catch (e) { alert("تعذر: " + e.message); }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    try { await updateDoc(doc(db, "reports", r.id), { log: arrayUnion({ at: Timestamp.now(), by: adminName || "admin", action: "note", note: note.trim(), days: null }) }); setNote(""); } catch (e) { alert("تعذر: " + e.message); }
  };
  const AL = { ...ACT_L, resolved: "✅ تمت المعالجة", dismissed: "🚫 إهمال البلاغ" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: isMobile ? "100%" : 480, background: T.bg, borderRight: `1px solid ${T.border}`, overflowY: "auto", padding: 22, animation: "adminSlide .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>تفاصيل البلاغ</div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: T.panel, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer" }}>✕</button>
        </div>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><b style={{ color: T.text }}>{r.targetType === "driver" ? "🚕" : "👤"} {r.targetName}</b><Pill color={R_ST[r.status]?.[1] || T.muted}>{R_ST[r.status]?.[0]}</Pill></div>
          <div style={{ fontSize: 13, color: T.text, margin: "10px 0", lineHeight: 1.8, background: T.panel2, borderRadius: 10, padding: 12 }}>{r.reason}</div>
          <div style={{ fontSize: 12, color: T.muted }}>المُبلِّغ: {r.reporterName} ({r.reporterType === "driver" ? "سائق" : "راكب"}) · {fmtDT(toDate(r.createdAt))}</div>
          {r.bookingId && <div style={{ fontSize: 11, color: T.dim, marginTop: 4, direction: "ltr", textAlign: "right" }}>رحلة: {r.bookingId}</div>}
        </Card>

        {target ? (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 8 }}>ملف {r.targetType === "driver" ? "السائق" : "الراكب"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[[rides.length, "رحلة"], [cancelled, "ملغاة"], [target.rating || "—", "تقييم"]].map(([v, l], i) => <div key={i} style={{ background: T.panel2, borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontWeight: 900, color: T.text, fontSize: 18 }}>{v}</div><div style={{ fontSize: 10, color: T.muted }}>{l}</div></div>)}
            </div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.9 }}>📞 {target.phone ? <a href={`tel:${target.phone}`} style={{ color: T.brandL }}>{target.phone}</a> : "—"}{target.carBrand ? ` · 🚗 ${target.carBrand} ${target.carModel || ""} ${target.plateNumber || ""}` : ""}</div>
          </Card>
        ) : <Card style={{ marginBottom: 12 }}><Empty icon="🗑️" text="الحساب محذوف أو غير موجود" /></Card>}

        {target && <Card style={{ marginBottom: 12 }}><ActionBox db={db} adminName={adminName} type={r.targetType} target={target} reportId={r.id} isSuper={isSuper} /></Card>}

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 8 }}>إغلاق البلاغ</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ملاحظة داخلية (تُحفظ في السجل)" style={{ width: "100%", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, color: T.text, fontFamily: "inherit", fontSize: 13, outline: "none", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={addNote} style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "9px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📝 إضافة ملاحظة</button>
            {r.status !== "resolved" && <button onClick={() => setStatus("resolved")} style={{ background: T.ok, border: "none", color: "#fff", borderRadius: 10, padding: "9px 14px", fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>✅ تمت المعالجة</button>}
            {r.status === "pending" && <button onClick={() => setStatus("dismissed")} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "9px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🚫 إهمال</button>}
          </div>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: T.text, marginBottom: 10 }}>📜 سجل البلاغ</div>
          {log.length === 0 && <div style={{ fontSize: 12, color: T.dim }}>لا إجراءات بعد</div>}
          {log.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: T.brandL, marginTop: 5, flexShrink: 0 }} />
              <div><div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{AL[l.action] || l.action}{l.days ? ` (${l.days} يوم)` : ""}</div>{l.note && <div style={{ fontSize: 12, color: T.muted }}>{l.note}</div>}<div style={{ fontSize: 10, color: T.dim }}>{l.by} · {fmtDT(toDate(l.at))}</div></div>
            </div>
          ))}
        </Card>

        {others.length > 0 && (
          <Card>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 10 }}>بلاغات أخرى ضد نفس الحساب ({others.length})</div>
            {others.slice(0, 6).map((o) => <div key={o.id} style={{ fontSize: 12, color: T.muted, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}><b style={{ color: T.text }}>{o.reason?.slice(0, 60)}</b><br />{o.reporterName} · {ago(toDate(o.createdAt))} · {R_ST[o.status]?.[0]}</div>)}
          </Card>
        )}
      </div>
    </div>
  );
}

// ================================================================
// الحسابات والإيقاف + سجل الإجراءات
// ================================================================
export function AccountsPanel({ drivers, passengers, db, adminName, isSuper, isMobile }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [stF, setStF] = useState("all");
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("users");
  const [logs, setLogs] = useState([]);
  useEffect(() => onSnapshot(collection(db, "admin_actions"), (s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0)).slice(0, 100)), () => {}), [db]);
  const all = useMemo(() => [...drivers.map((d) => ({ ...d, _t: "driver" })), ...passengers.map((p) => ({ ...p, _t: "passenger" }))], [drivers, passengers]);
  const s = q.trim().toLowerCase();
  const rows = all.filter((u) => (kind === "all" || u._t === kind) && (stF === "all" || accountState(u).k === stF) && (!s || [u.name, u.phone, u.email, u.plateNumber].some((v) => String(v || "").toLowerCase().includes(s))))
    .sort((a, b) => (accountState(a).k === "active") - (accountState(b).k === "active")).slice(0, 80);
  const bad = all.filter((u) => accountState(u).k !== "active").length;
  const selected = sel && all.find((u) => u.id === sel.id && u._t === sel.t);
  return (
    <div>
      <PageTitle title="⛔ الحسابات والإيقاف" sub={`${bad} حساب موقوف أو محظور`} right={<Seg value={tab} onChange={setTab} options={[{ v: "users", l: "الحسابات" }, { v: "log", l: "سجل الإجراءات" }]} />} />
      {tab === "users" ? (<>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 اسم، هاتف، لوحة…" style={{ flex: "1 1 220px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", color: T.text, fontFamily: "inherit", fontSize: 14, outline: "none" }} />
          <Seg value={kind} onChange={setKind} options={[{ v: "all", l: "الكل" }, { v: "driver", l: "سائقون" }, { v: "passenger", l: "ركاب" }]} />
          <Seg value={stF} onChange={setStF} options={[{ v: "all", l: "كل الحالات" }, { v: "suspended", l: "موقوف" }, { v: "banned", l: "محظور" }]} />
        </div>
        <Card pad={0} style={{ overflow: "hidden" }}>
          {rows.length === 0 && <Empty text="لا نتائج" />}
          {rows.map((u) => { const st = accountState(u); return (
            <div key={u._t + u.id} onClick={() => setSel({ id: u.id, t: u._t })} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.panel2, display: "flex", alignItems: "center", justifyContent: "center" }}>{u._t === "driver" ? "🚕" : "👤"}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{u.name || "—"}</div><div style={{ fontSize: 12, color: T.muted, direction: "ltr", textAlign: "right" }}>{u.phone}</div></div>
              {(u.warnings || 0) > 0 && <Pill color={T.warn}>⚠️ {u.warnings}</Pill>}
              <Pill color={st.color}>{st.label}</Pill>
            </div>); })}
        </Card>
      </>) : (
        <Card pad={0} style={{ overflow: "hidden" }}>
          {logs.length === 0 && <Empty icon="📜" text="لا إجراءات مسجلة" />}
          {logs.map((l) => (
            <div key={l.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{ACT_L[l.action] || l.action} — {l.targetName}</span><span style={{ fontSize: 11, color: T.dim }}>{ago(toDate(l.createdAt))}</span></div>
              <div style={{ fontSize: 12, color: T.muted }}>{l.adminName}{l.days ? ` · ${l.days} يوم` : ""}{l.reason ? ` · ${l.reason}` : ""}</div>
            </div>
          ))}
        </Card>
      )}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div onClick={() => setSel(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: isMobile ? "100%" : 440, background: T.bg, borderRight: `1px solid ${T.border}`, overflowY: "auto", padding: 22, animation: "adminSlide .3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{selected._t === "driver" ? "🚕" : "👤"} {selected.name}</div><button onClick={() => setSel(null)} style={{ width: 34, height: 34, borderRadius: "50%", background: T.panel, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer" }}>✕</button></div>
            <Card style={{ marginBottom: 12, fontSize: 13, color: T.muted, lineHeight: 2 }}>📞 {selected.phone}<br />{selected.email && <>✉️ {selected.email}<br /></>}{selected.carBrand && <>🚗 {selected.carBrand} {selected.carModel} {selected.plateNumber}<br /></>}⭐ {selected.rating || "—"}</Card>
            <Card><ActionBox db={db} adminName={adminName} type={selected._t} target={selected} isSuper={isSuper} /></Card>
          </div>
        </div>
      )}
    </div>
  );
}

export const adminProStyles = `
  @keyframes adminPulse{0%,100%{box-shadow:0 0 0 0 rgba(248,81,73,.45)}50%{box-shadow:0 0 0 8px rgba(248,81,73,0)}}
  @keyframes adminSlide{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}
`;

// ============ المناطق: التحكم بالولايات التي يعمل فيها التطبيق + إعدادات بين المدن ============
export function RegionsPanel({ db, adminName, canEdit }) {
  const [s, setS] = useState({ restrict: false, enabled: [], intercityKm: 40, uplift: 20, maxSeatsLimit: 6 });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => onSnapshot(doc(db, "settings", "regions"), (d) => { if (d.exists()) setS((x) => ({ ...x, ...d.data() })); setLoaded(true); }, () => setLoaded(true)), [db]);
  const toggle = (c) => setS((x) => ({ ...x, enabled: x.enabled.includes(c) ? x.enabled.filter((y) => y !== c) : [...x.enabled, c] }));
  const START = ["55", "57", "39", "30"]; // تقرت، المغير، الوادي، ورقلة
  const valid = +s.intercityKm >= 5 && +s.uplift >= 0 && +s.uplift <= 100 && +s.maxSeatsLimit >= 2 && +s.maxSeatsLimit <= 8 && (!s.restrict || s.enabled.length > 0);
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await setDoc(doc(db, "settings", "regions"), { restrict: !!s.restrict, enabled: s.enabled, intercityKm: +s.intercityKm, uplift: +s.uplift, maxSeatsLimit: +s.maxSeatsLimit, updatedAt: serverTimestamp(), updatedBy: adminName || "" });
      setMsg("✅ تم الحفظ — يسري فوراً عند الركاب والسائقين");
    } catch (e) { setMsg("❌ " + (e.code === "permission-denied" ? "قواعد Firestore تمنع الكتابة في settings" : e.message)); }
    setSaving(false);
  };
  const list = WILAYA_LIST.filter((w) => !q || w.n.includes(q) || w.c.includes(q));
  const Num = ({ label, k, unit, min, max }) => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "0 12px" }}>
        <input type="number" min={min} max={max} disabled={!canEdit} value={s[k]} onChange={(e) => setS((x) => ({ ...x, [k]: e.target.value }))} style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontFamily: "inherit", fontSize: 18, fontWeight: 800, padding: "10px 0", direction: "ltr", textAlign: "right" }} />
        <span style={{ color: T.dim, fontSize: 12 }}>{unit}</span>
      </div>
    </label>
  );
  return (
    <div>
      <PageTitle title="🗺️ المناطق" sub="اختر الولايات التي يعمل فيها التطبيق، وأعدّ الرحلات التشاركية بين المدن" />
      {!loaded ? <Empty icon="⏳" text="جارٍ التحميل…" /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
          <Card>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: canEdit ? "pointer" : "default", marginBottom: 14 }}>
              <input type="checkbox" disabled={!canEdit} checked={!!s.restrict} onChange={(e) => setS((x) => ({ ...x, restrict: e.target.checked }))} style={{ width: 22, height: 22, accentColor: T.brand }} />
              <div><div style={{ fontWeight: 800, color: T.text }}>حصر التطبيق في الولايات المحددة</div><div style={{ fontSize: 11, color: T.muted }}>{s.restrict ? "الركاب والسائقون خارج الولايات المفعّلة لا يستطيعون الطلب أو الاتصال" : "متوقف: التطبيق يعمل في كل الولايات"}</div></div>
            </label>
            <div style={{ fontWeight: 800, color: T.text, margin: "10px 0 10px" }}>إعدادات بين المدن والتشاركية</div>
            <Num label="مسافة تعتبر «بين المدن» (إن اختلفت الولاية فهي بين مدن دائماً)" k="intercityKm" unit="كم" min={5} />
            <Num label="النسبة الإضافية في التشاركية" k="uplift" unit="%" min={0} max={100} />
            <Num label="أقصى عدد مقاعد يمكن للسائق تحديده" k="maxSeatsLimit" unit="مقعد" min={2} max={8} />
            <div style={{ background: T.panel2, borderRadius: 12, padding: 12, fontSize: 12, color: T.muted, lineHeight: 1.9, marginBottom: 12 }}>
              مثال لرحلة 3000 دج: راكب واحد = <b style={{ color: T.text }}>3000</b> · راكبان = <b style={{ color: T.text }}>{Math.round((3000 / 2) * (1 + s.uplift / 100) / 10) * 10}</b> لكل فرد · ثلاثة = <b style={{ color: T.text }}>{Math.round((3000 / 3) * (1 + s.uplift / 100) / 10) * 10}</b> لكل فرد
            </div>
            {canEdit ? <button onClick={save} disabled={saving || !valid} style={{ width: "100%", background: valid ? T.brand : T.border, border: "none", color: "#fff", borderRadius: 12, padding: 13, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button> : <div style={{ color: T.muted, fontSize: 12 }}>التعديل للأدمن الرئيسي فقط</div>}
            {s.restrict && !s.enabled.length && <div style={{ color: T.bad, fontSize: 12, marginTop: 8 }}>اختر ولاية واحدة على الأقل</div>}
            {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("✅") ? T.ok : T.bad }}>{msg}</div>}
          </Card>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: T.text }}>الولايات المفعّلة ({s.enabled.length})</div>
              {canEdit && <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setS((x) => ({ ...x, restrict: true, enabled: START }))} style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: "6px 10px", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>البداية: تقرت · المغير · الوادي · ورقلة</button>
                <button onClick={() => setS((x) => ({ ...x, enabled: [] }))} style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "6px 10px", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>مسح</button>
              </div>}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث عن ولاية" style={{ width: "100%", background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", color: T.text, fontFamily: "inherit", marginBottom: 10, outline: "none" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {list.map((w) => { const on = s.enabled.includes(w.c); return (
                <button key={w.c} disabled={!canEdit} onClick={() => toggle(w.c)} style={{ background: on ? T.brand : T.panel2, color: on ? "#fff" : T.text, border: `1px solid ${on ? T.brand : T.border}`, borderRadius: 20, padding: "7px 13px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: canEdit ? "pointer" : "default" }}>{on ? "✓ " : ""}{w.c} · {w.n}</button>
              ); })}
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 10, lineHeight: 1.7 }}>تُحدَّد ولاية الراكب من موقعه بأقرب مركز ولاية (تقريبي)، وولاية السائق من التي سجّلها في حسابه.</div>
          </Card>
        </div>
      )}
    </div>
  );
}
