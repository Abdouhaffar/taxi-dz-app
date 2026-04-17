import { useState, useEffect } from "react";

const C = {
  bg: "#0f1117",
  card: "#1a1d27",
  cardBorder: "#2a2d3e",
  green: "#00b37e",
  greenLight: "#00b37e22",
  orange: "#f97316",
  orangeLight: "#f9731622",
  red: "#ef4444",
  redLight: "#ef444422",
  blue: "#3b82f6",
  blueLight: "#3b82f622",
  yellow: "#f59e0b",
  yellowLight: "#f59e0b22",
  purple: "#8b5cf6",
  purpleLight: "#8b5cf622",
  text: "#ffffff",
  textMuted: "#94a3b8",
  textDim: "#4a5568",
  shadow: "0 4px 24px rgba(0,0,0,0.3)",
};

// ===== MOCK DATA =====
const MOCK_TRIPS = [
  { id: 1, passenger: "محمد أمين", from: "باب الزوار", to: "حيدرة", price: 850, time: "09:15", date: "اليوم", status: "completed", rating: 5, distance: "8.2 كم" },
  { id: 2, passenger: "سارة بن علي", from: "القبة", to: "بئر مراد رايس", price: 1200, time: "11:30", date: "اليوم", status: "completed", rating: 4, distance: "12.5 كم" },
  { id: 3, passenger: "يوسف حمداني", from: "الدار البيضاء", to: "المطار", price: 2500, time: "14:00", date: "اليوم", status: "completed", rating: 5, distance: "22.1 كم" },
  { id: 4, passenger: "فاطمة زهراء", from: "باب الوادي", to: "العاشور", price: 950, time: "08:20", date: "أمس", status: "completed", rating: 5, distance: "9.8 كم" },
  { id: 5, passenger: "كريم بوعلام", from: "حسين داي", to: "بن عكنون", price: 1100, time: "16:45", date: "أمس", status: "completed", rating: 3, distance: "11.2 كم" },
];

const MOCK_REQUESTS = [
  { id: 101, passenger: "أحمد سليم", from: "باب الزوار", to: "حيدرة", offeredPrice: 700, suggestedPrice: 850, distance: "8.2 كم", time: "3 دق", avatar: "👨" },
  { id: 102, passenger: "نور الهدى", from: "القبة", to: "المطار", offeredPrice: 2000, suggestedPrice: 2500, distance: "22 كم", time: "5 دق", avatar: "👩" },
];

// ===== HEADER =====
function DashboardHeader({ driver, isOnline, onToggleOnline }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.card}, #12151f)`, padding: "48px 20px 24px", borderBottom: `1px solid ${C.cardBorder}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, #ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👨‍✈️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{driver.name}</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>⭐ {driver.rating} · {driver.car}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{driver.plate}</div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{isOnline ? "متصل" : "غير متصل"}</div>
          <div onClick={onToggleOnline} style={{ width: 56, height: 28, borderRadius: 14, background: isOnline ? C.green : C.cardBorder, position: "relative", cursor: "pointer", transition: "all 0.3s" }}>
            <div style={{ position: "absolute", top: 3, right: isOnline ? 3 : "auto", left: isOnline ? "auto" : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "all 0.3s", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
          </div>
        </div>
      </div>

      {/* Online Status Banner */}
      {isOnline && (
        <div style={{ marginTop: 16, background: C.greenLight, border: `1px solid ${C.green}44`, borderRadius: 14, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>أنت متصل الآن — تلقّي الطلبات</span>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      )}
    </div>
  );
}

// ===== STATS CARDS =====
function StatsCards({ trips }) {
  const todayTrips = trips.filter(t => t.date === "اليوم");
  const todayEarnings = todayTrips.reduce((sum, t) => sum + t.price, 0);
  const weekEarnings = trips.reduce((sum, t) => sum + t.price, 0);
  const avgRating = (trips.reduce((sum, t) => sum + t.rating, 0) / trips.length).toFixed(1);

  const stats = [
    { label: "أرباح اليوم", value: `${todayEarnings.toLocaleString()}`, unit: "دج", icon: "💰", color: C.green, bg: C.greenLight },
    { label: "رحلات اليوم", value: todayTrips.length, unit: "رحلة", icon: "🚕", color: C.blue, bg: C.blueLight },
    { label: "أرباح الأسبوع", value: `${weekEarnings.toLocaleString()}`, unit: "دج", icon: "📈", color: C.purple, bg: C.purpleLight },
    { label: "تقييمك", value: avgRating, unit: "⭐", icon: "🏆", color: C.yellow, bg: C.yellowLight },
  ];

  return (
    <div style={{ padding: "20px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ background: C.card, borderRadius: 18, padding: "16px", border: `1px solid ${C.cardBorder}`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -10, left: -10, width: 60, height: 60, borderRadius: "50%", background: s.bg, opacity: 0.5 }} />
          <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value} <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{s.unit}</span></div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ===== RIDE REQUESTS =====
function RideRequests({ requests, onAccept, onReject, onCounter }) {
  const [counterPrice, setCounterPrice] = useState({});

  if (requests.length === 0) return null;

  return (
    <div style={{ padding: "20px 20px 0" }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 12 }}>
        🔔 طلبات جديدة <span style={{ background: C.red, color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 20, marginRight: 8 }}>{requests.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map(req => (
          <div key={req.id} style={{ background: C.card, borderRadius: 20, padding: 18, border: `1px solid ${C.orange}44`, boxShadow: `0 0 20px ${C.orange}22` }}>
            {/* Passenger Info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.cardBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{req.avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{req.passenger}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>📏 {req.distance} · ⏱ {req.time}</div>
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>عرض الراكب</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.orange }}>{req.offeredPrice} دج</div>
                <div style={{ fontSize: 11, color: C.textDim }}>مقترح: {req.suggestedPrice} دج</div>
              </div>
            </div>

            {/* Route */}
            <div style={{ background: C.bg, borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.text }}>{req.from}</span>
              </div>
              <div style={{ marginRight: 3, width: 2, height: 12, background: C.cardBorder, marginLeft: 3 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.text }}>{req.to}</span>
              </div>
            </div>

            {/* Counter Offer Input */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>عرض مضاد (اختياري)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  placeholder={`مثال: ${req.suggestedPrice}`}
                  value={counterPrice[req.id] || ""}
                  onChange={e => setCounterPrice(prev => ({ ...prev, [req.id]: e.target.value }))}
                  style={{ flex: 1, background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontFamily: "inherit", fontSize: 14, outline: "none", textAlign: "center" }}
                />
                <button onClick={() => onCounter(req.id, counterPrice[req.id])} style={{ background: C.purpleLight, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: "10px 14px", color: C.purple, fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  🤝 عرض
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onReject(req.id)} style={{ flex: 1, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 12, padding: "12px", color: C.red, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                ❌ رفض
              </button>
              <button onClick={() => onAccept(req.id)} style={{ flex: 2, background: `linear-gradient(135deg, ${C.green}, #007a55)`, border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                ✅ قبول {req.offeredPrice} دج
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== EARNINGS CHART =====
function EarningsChart() {
  const days = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
  const values = [3200, 4100, 2800, 5200, 3900, 4800, 4550];
  const max = Math.max(...values);

  return (
    <div style={{ margin: "20px 20px 0", background: C.card, borderRadius: 20, padding: 20, border: `1px solid ${C.cardBorder}` }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>📊 أرباح الأسبوع</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>إجمالي: {values.reduce((a,b)=>a+b,0).toLocaleString()} دج</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", background: i === 6 ? `linear-gradient(180deg, ${C.green}, ${C.greenLight})` : C.cardBorder, borderRadius: "6px 6px 0 0", height: `${(v / max) * 90}px`, transition: "height 0.5s", position: "relative" }}>
              {i === 6 && <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>{v.toLocaleString()}</div>}
            </div>
            <div style={{ fontSize: 9, color: i === 6 ? C.green : C.textDim, fontWeight: i === 6 ? 700 : 400 }}>{days[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== TRIP HISTORY =====
function TripHistory({ trips }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? trips : trips.slice(0, 3);

  return (
    <div style={{ margin: "20px 20px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>🕐 سجل الرحلات</div>
        <button onClick={() => setShowAll(!showAll)} style={{ background: "none", border: "none", color: C.blue, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          {showAll ? "عرض أقل" : "عرض الكل"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {displayed.map(trip => (
          <div key={trip.id} style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚕</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{trip.passenger}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{trip.from} ← {trip.to}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>{trip.date} · {trip.time} · {trip.distance}</div>
              </div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: C.green }}>{trip.price.toLocaleString()} دج</div>
              <div style={{ fontSize: 12, color: C.yellow, textAlign: "center" }}>{"⭐".repeat(trip.rating)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== BOTTOM NAV =====
function BottomNav({ active, onSelect }) {
  const tabs = [
    { id: "home", label: "الرئيسية", icon: "🏠" },
    { id: "trips", label: "رحلاتي", icon: "🚕" },
    { id: "earnings", label: "الأرباح", icon: "💰" },
    { id: "profile", label: "حسابي", icon: "👤" },
  ];

  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: C.card, borderTop: `1px solid ${C.cardBorder}`, display: "flex", padding: "8px 0 20px" }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onSelect(tab.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0" }}>
          <div style={{ fontSize: 22, opacity: active === tab.id ? 1 : 0.4 }}>{tab.icon}</div>
          <div style={{ fontSize: 10, color: active === tab.id ? C.green : C.textDim, fontWeight: active === tab.id ? 700 : 400 }}>{tab.label}</div>
          {active === tab.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.green }} />}
        </button>
      ))}
    </div>
  );
}

// ===== PROFILE TAB =====
function ProfileTab({ driver, onLogout }) {
  const stats = [
    { label: "إجمالي الرحلات", value: "1,240" },
    { label: "التقييم", value: "4.9 ⭐" },
    { label: "معدل القبول", value: "94%" },
    { label: "إجمالي الأرباح", value: "284,000 دج" },
  ];

  return (
    <div style={{ padding: "20px 20px 100px" }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 20, border: `1px solid ${C.cardBorder}`, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>👨‍✈️</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: C.text }}>{driver.name}</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{driver.car} · {driver.plate}</div>
        <div style={{ display: "inline-block", background: C.greenLight, color: C.green, padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 8 }}>✅ سائق معتمد</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 16, padding: "14px", border: `1px solid ${C.cardBorder}`, textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 16 }}>
        {[
          { icon: "📄", label: "وثائقي", desc: "رخصة، بطاقة، وثيقة السيارة" },
          { icon: "🏦", label: "حسابي البنكي", desc: "CIB · **** 4521" },
          { icon: "🔔", label: "الإشعارات", desc: "مفعّلة" },
          { icon: "🌙", label: "الوضع الليلي", desc: "مفعّل" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < 3 ? `1px solid ${C.cardBorder}` : "none" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{item.desc}</div>
              </div>
            </div>
            <span style={{ color: C.textDim, fontSize: 16 }}>›</span>
          </div>
        ))}
      </div>

      <button onClick={onLogout} style={{ width: "100%", background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 16, padding: 16, color: C.red, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
        🚪 تسجيل الخروج
      </button>
    </div>
  );
}

// ===== MAIN DRIVER DASHBOARD =====
export default function DriverDashboard({ onLogout }) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [trips] = useState(MOCK_TRIPS);

  const driver = {
    name: "كريم بن علي",
    rating: 4.9,
    car: "رونو سيمبول 2021",
    plate: "213-01-DZ",
  };

  const handleAccept = (id) => setRequests(prev => prev.filter(r => r.id !== id));
  const handleReject = (id) => setRequests(prev => prev.filter(r => r.id !== id));
  const handleCounter = (id, price) => {
    if (price) setRequests(prev => prev.map(r => r.id === id ? { ...r, offeredPrice: Number(price) } : r));
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", maxWidth: 390, margin: "0 auto" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:0}`}</style>

      <DashboardHeader driver={driver} isOnline={isOnline} onToggleOnline={() => setIsOnline(!isOnline)} />

      <div style={{ paddingBottom: 100, overflowY: "auto" }}>
        {activeTab === "home" && (
          <>
            <StatsCards trips={trips} />
            {isOnline && requests.length > 0 && (
              <RideRequests requests={requests} onAccept={handleAccept} onReject={handleReject} onCounter={handleCounter} />
            )}
            {!isOnline && (
              <div style={{ margin: "20px", background: C.card, borderRadius: 20, padding: 24, border: `1px solid ${C.cardBorder}`, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>😴</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>أنت غير متصل</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>فعّل الاتصال لتلقّي طلبات الرحلات</div>
                <button onClick={() => setIsOnline(true)} style={{ background: `linear-gradient(135deg, ${C.green}, #007a55)`, border: "none", borderRadius: 14, padding: "14px 32px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  🟢 تفعيل الاتصال
                </button>
              </div>
            )}
            <EarningsChart />
          </>
        )}

        {activeTab === "trips" && (
          <TripHistory trips={trips} />
        )}

        {activeTab === "earnings" && (
          <div style={{ padding: "20px" }}>
            <EarningsChart />
            <div style={{ marginTop: 16, background: C.card, borderRadius: 20, padding: 20, border: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 16 }}>💳 سحب الأرباح</div>
              <div style={{ background: C.bg, borderRadius: 14, padding: 16, marginBottom: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>الرصيد المتاح</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.green, marginTop: 4 }}>28,450 دج</div>
              </div>
              <button style={{ width: "100%", background: `linear-gradient(135deg, ${C.green}, #007a55)`, border: "none", borderRadius: 14, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                🏦 سحب إلى CIB / Dahabia
              </button>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <ProfileTab driver={driver} onLogout={onLogout} />
        )}
      </div>

      <BottomNav active={activeTab} onSelect={setActiveTab} />
    </div>
  );
}