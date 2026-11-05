/* eslint-disable */
// لوحة الإدارة المتقدمة: لوحة معلومات حقيقية، عمليات مباشرة، سجل الرحلات، الطوارئ، بحث شامل
import { useState, useMemo, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { doc, updateDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

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

export const adminProStyles = `
  @keyframes adminPulse{0%,100%{box-shadow:0 0 0 0 rgba(248,81,73,.45)}50%{box-shadow:0 0 0 8px rgba(248,81,73,0)}}
  @keyframes adminSlide{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}
`;
