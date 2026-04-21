import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Autocomplete } from "@react-google-maps/api";

// ===== FIREBASE =====
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let auth;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) { console.log("Firebase error:", e); }

// ===== CONSTANTS =====
const LIBRARIES = ["places"];
const ALGERIA_CENTER = { lat: 36.737, lng: 3.086 };
const MAP_STYLE = [
  { featureType: "all", elementType: "geometry", stylers: [{ color: "#f5f0eb" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffe0c2" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffb347" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#aad3df" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
];

const C = {
  bg: "#f7f3ee", card: "#ffffff", dark: "#1a1a2e",
  green: "#00b37e", greenLight: "#e6f9f3", greenDark: "#007a55",
  orange: "#f97316", orangeLight: "#fff4ed",
  red: "#ef4444", redLight: "#fef2f2",
  blue: "#3b82f6", blueLight: "#eff6ff",
  text: "#1a1a2e", textMuted: "#64748b", textLight: "#94a3b8",
  border: "#e8e3db", shadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const DRIVERS = [
  { id: 1, name: "كريم بن علي", rating: 4.9, car: "رونو سيمبول 2021", plate: "213-01-DZ", avatar: "👨‍✈️", position: { lat: 36.752, lng: 3.042 } },
  { id: 2, name: "يوسف مزياني", rating: 4.7, car: "بيجو 301 2020", plate: "107-16-DZ", avatar: "🧔", position: { lat: 36.720, lng: 3.110 } },
  { id: 3, name: "أمين شريف", rating: 4.8, car: "داسيا لوغان 2022", plate: "445-09-DZ", avatar: "👨‍🦱", position: { lat: 36.745, lng: 3.060 } },
];

// ===== GOOGLE MAP COMPONENT =====
function TaxiMap({ origin, destination, showDrivers, height = 220 }) {
  const [directions, setDirections] = useState(null);
  const [userLocation, setUserLocation] = useState(ALGERIA_CENTER);
  const mapRef = useRef(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(ALGERIA_CENTER)
    );
  }, []);

  useEffect(() => {
    if (!origin || !destination) { setDirections(null); return; }
    const service = new window.google.maps.DirectionsService();
    service.route({ origin, destination, travelMode: window.google.maps.TravelMode.DRIVING },
      (result, status) => { if (status === "OK") setDirections(result); }
    );
  }, [origin, destination]);

  const onLoad = useCallback(map => { mapRef.current = map; }, []);

  const makeMarker = (emoji, color) =>
    "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='${color}' stroke='white' stroke-width='3'/><text x='20' y='27' text-anchor='middle' font-size='18'>${emoji}</text></svg>`
    );

  return (
    <div style={{ margin: "0 20px", borderRadius: 20, overflow: "hidden" }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: `${height}px` }}
        center={origin || userLocation}
        zoom={13}
        onLoad={onLoad}
        options={{ styles: MAP_STYLE, disableDefaultUI: true, zoomControl: true }}
      >
        {!origin && <Marker position={userLocation} />}
        {origin && !directions && (
          <Marker position={origin} icon={{ url: makeMarker("📍", C.green), scaledSize: new window.google.maps.Size(40, 40) }} />
        )}
        {destination && !directions && (
          <Marker position={destination} icon={{ url: makeMarker("🏁", C.orange), scaledSize: new window.google.maps.Size(40, 40) }} />
        )}
        {directions && (
          <DirectionsRenderer directions={directions} options={{ polylineOptions: { strokeColor: C.green, strokeWeight: 4, strokeOpacity: 0.8 } }} />
        )}
        {showDrivers && DRIVERS.map(d => (
          <Marker key={d.id} position={d.position} icon={{ url: makeMarker("🚕", C.dark), scaledSize: new window.google.maps.Size(40, 40) }} />
        ))}
      </GoogleMap>
    </div>
  );
}

// ===== ROUTE INFO =====
function RouteInfo({ origin, destination }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    if (!origin || !destination) { setInfo(null); return; }
    new window.google.maps.DistanceMatrixService().getDistanceMatrix(
      { origins: [origin], destinations: [destination], travelMode: "DRIVING" },
      (res, status) => {
        if (status === "OK") {
          const el = res.rows[0].elements[0];
          if (el.status === "OK") setInfo({ distance: el.distance.text, duration: el.duration.text });
        }
      }
    );
  }, [origin, destination]);
  if (!info) return null;
  return (
    <div style={{ display: "flex", gap: 8, margin: "10px 20px 0", justifyContent: "center" }}>
      <div style={{ background: C.greenLight, borderRadius: 20, padding: "6px 14px", fontSize: 13, color: C.greenDark, fontWeight: 700 }}>📏 {info.distance}</div>
      <div style={{ background: C.blueLight, borderRadius: 20, padding: "6px 14px", fontSize: 13, color: C.blue, fontWeight: 700 }}>⏱ {info.duration}</div>
    </div>
  );
}

// ===== WELCOME =====
function WelcomeScreen({ onSelect }) {
  return (
    <div style={{ minHeight: "100vh", background: C.dark, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 72, marginBottom: 12 }}>🚕</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 6 }}>TaxiDZ</div>
      <div style={{ fontSize: 14, color: "#ffffff77", marginBottom: 48 }}>تاكسي الجزائر 🇩🇿 — فاوض على سعرك</div>
      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => onSelect("passenger")} style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 40 }}>🧑</span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>راكب</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>أبحث عن سيارة أجرة</div>
          </div>
        </button>
        <button onClick={() => onSelect("driver")} style={{ background: `linear-gradient(135deg,${C.orange},#ea580c)`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 40 }}>👨‍✈️</span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>سائق</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>أقدم خدمة النقل</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ===== AUTH =====
function AuthForm({ role, onSuccess, onBack }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const accent = role === "driver" ? C.orange : C.green;
  const accentDark = role === "driver" ? "#ea580c" : C.greenDark;

  const handle = async () => {
    if (!email || !password) { setError("أدخل البريد وكلمة المرور"); return; }
    setLoading(true); setError("");
    try {
      if (mode === "register") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (e) {
      const m = { "auth/email-already-in-use": "البريد مستخدم", "auth/wrong-password": "كلمة المرور خاطئة", "auth/user-not-found": "المستخدم غير موجود", "auth/weak-password": "كلمة المرور قصيرة", "auth/invalid-credential": "بيانات غير صحيحة" };
      setError(m[e.code] || "حدث خطأ");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: C.dark, padding: "48px 24px 32px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 48, right: 20, width: 36, height: 36, borderRadius: 10, background: "#ffffff22", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>←</button>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{role === "driver" ? "👨‍✈️" : "🧑"}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{role === "driver" ? "بوابة السائق" : "بوابة الراكب"}</div>
      </div>
      <div style={{ padding: "24px 20px" }}>
        <div style={{ background: "#e2ddd8", borderRadius: 14, padding: 4, display: "flex", marginBottom: 20 }}>
          {[{ id: "login", label: "دخول" }, { id: "register", label: "حساب جديد" }].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setError(""); }} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: mode === m.id ? C.card : "transparent", color: mode === m.id ? C.text : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>{m.label}</button>
          ))}
        </div>
        <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
          {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
          <button onClick={handle} disabled={loading} style={{ background: `linear-gradient(135deg,${accent},${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "جارٍ..." : mode === "register" ? "✅ إنشاء الحساب" : "🔑 تسجيل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== PASSENGER APP =====
function PassengerApp({ onLogout, user }) {
  const [screen, setScreen] = useState("home");
  const [originPlace, setOriginPlace] = useState(null);
  const [destPlace, setDestPlace] = useState(null);
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [rideType, setRideType] = useState("economy");
  const [myPrice, setMyPrice] = useState(750);
  const [mode, setMode] = useState("suggested");
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(null);
  const [drivers, setDrivers] = useState(DRIVERS.map(d => ({ ...d, status: "pending", offerPrice: null })));
  const [timer, setTimer] = useState(0);
  const [phase, setPhase] = useState(0);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const originRef = useRef(null);
  const destRef = useRef(null);

  const types = [
    { id: "economy", label: "اقتصادي", icon: "🚗", price: "600-900", time: "3 دق", base: 750 },
    { id: "comfort", label: "مريح", icon: "🚙", price: "900-1400", time: "5 دق", base: 1150 },
    { id: "xl", label: "XL", icon: "🚐", price: "1200-1800", time: "7 دق", base: 1500 },
  ];
  const base = types.find(t => t.id === rideType)?.base || 750;

  useEffect(() => {
    if (screen !== "searching") return;
    const t = setInterval(() => setTimer(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [screen]);

  useEffect(() => {
    if (screen !== "searching") return;
    if (timer === 3) setPhase(1);
    if (timer === 4) setDrivers(p => p.map((d, i) => i === 0 ? { ...d, status: "accepted", offerPrice: booking?.price } : d));
    if (timer === 7) setDrivers(p => p.map((d, i) => i === 1 ? { ...d, status: "accepted", offerPrice: booking?.price } : d));
    if (timer === 10) setDrivers(p => p.map((d, i) => i === 2 ? { ...d, status: "accepted", offerPrice: booking?.price } : d));
  }, [timer, screen, booking]);

  useEffect(() => {
    if (screen !== "ride" || done) return;
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [screen, done]);

  const onOriginChanged = () => {
    if (originRef.current) {
      const place = originRef.current.getPlace();
      if (place?.geometry) { setOriginPlace(place.geometry.location); setOriginText(place.formatted_address || place.name); }
    }
  };

  const onDestChanged = () => {
    if (destRef.current) {
      const place = destRef.current.getPlace();
      if (place?.geometry) { setDestPlace(place.geometry.location); setDestText(place.formatted_address || place.name); }
    }
  };

  if (screen === "home") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ padding: "48px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: C.textMuted }}>موقعك 📍</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>الجزائر العاصمة</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.textMuted }}>مرحباً</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{user?.email?.split("@")[0] || "مستخدم"}</div>
          </div>
          <button onClick={onLogout} style={{ width: 40, height: 40, borderRadius: 12, background: C.redLight, border: "none", cursor: "pointer", fontSize: 16 }}>🚪</button>
        </div>
      </div>
      <TaxiMap origin={null} destination={null} showDrivers={true} />
      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: C.text }}>إلى أين تريد الذهاب؟ 🚕</div>
        <div onClick={() => setScreen("booking")} style={{ background: C.dark, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange }} />
          <span style={{ color: "#ffffff88", fontSize: 14 }}>ابحث عن وجهتك...</span>
        </div>
        <button onClick={() => setScreen("booking")} style={{ width: "100%", marginTop: 12, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 16, padding: "16px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>🚀 ابحث عن سيارة</button>
      </div>
      <div style={{ margin: "0 20px", background: `linear-gradient(135deg,${C.dark},#2d1b69)`, borderRadius: 20, padding: "18px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>ميزة حصرية</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>فاوض على السعر! 🤝</div>
        </div>
        <div style={{ fontSize: 48 }}>💰</div>
      </div>
    </div>
  );

  if (screen === "booking") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "48px 20px 12px", gap: 12 }}>
        <button onClick={() => setScreen("home")} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>تفاصيل الرحلة</div>
      </div>
      <TaxiMap origin={originPlace} destination={destPlace} showDrivers={false} />
      <RouteInfo origin={originPlace} destination={destPlace} />
      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.greenLight, borderRadius: 14, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
            <Autocomplete onLoad={ac => originRef.current = ac} onPlaceChanged={onOriginChanged} options={{ componentRestrictions: { country: "dz" } }}>
              <input value={originText} onChange={e => setOriginText(e.target.value)} placeholder="نقطة الانطلاق..." style={{ background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: C.text, width: "100%", textAlign: "right" }} />
            </Autocomplete>
          </div>
          <div style={{ background: C.orangeLight, borderRadius: 14, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange, flexShrink: 0 }} />
            <Autocomplete onLoad={ac => destRef.current = ac} onPlaceChanged={onDestChanged} options={{ componentRestrictions: { country: "dz" } }}>
              <input value={destText} onChange={e => setDestText(e.target.value)} placeholder="إلى أين؟ مثال: حيدرة..." style={{ background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: C.text, width: "100%", textAlign: "right" }} />
            </Autocomplete>
          </div>
        </div>
        <div style={{ fontWeight: 700, marginBottom: 10, color: C.text }}>نوع السيارة</div>
        {types.map(t => (
          <div key={t.id} onClick={() => { setRideType(t.id); setMyPrice(t.base); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 14, border: `2px solid ${rideType === t.id ? C.green : C.border}`, background: rideType === t.id ? C.greenLight : C.bg, cursor: "pointer", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{t.label}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>⏱ {t.time}</div>
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: rideType === t.id ? C.greenDark : C.text }}>{t.price} دج</div>
          </div>
        ))}
        <button
          onClick={() => { if (originPlace && destPlace) { setBooking({ originPlace, destPlace, originText, destText, rideType, price: base, negotiated: false }); setScreen("negotiate"); } }}
          style={{ width: "100%", marginTop: 8, background: originPlace && destPlace ? `linear-gradient(135deg,${C.green},${C.greenDark})` : C.border, border: "none", borderRadius: 16, padding: 16, color: originPlace && destPlace ? "#fff" : C.textMuted, fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: originPlace && destPlace ? "pointer" : "default" }}>
          {originPlace && destPlace ? "التالي: تحديد السعر 💰" : "اختر نقطة الانطلاق والوجهة"}
        </button>
      </div>
    </div>
  );

  if (screen === "negotiate") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "48px 20px 16px", gap: 12 }}>
        <button onClick={() => setScreen("booking")} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18 }}>←</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>حدد سعرك 💰</div>
          <div style={{ fontSize: 12, color: C.textMuted, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{originText} ← {destText}</div>
        </div>
      </div>
      <div style={{ margin: "0 20px 14px", background: C.card, borderRadius: 18, padding: 6, display: "flex", boxShadow: C.shadow }}>
        {[{ id: "suggested", label: "✅ السعر المقترح" }, { id: "negotiate", label: "🤝 فاوض" }].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, border: "none", background: mode === m.id ? C.dark : "transparent", color: mode === m.id ? "#fff" : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>{m.label}</button>
        ))}
      </div>
      {mode === "suggested" ? (
        <div style={{ margin: "0 20px" }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>السعر المقترح</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: C.green }}>{base}</div>
            <div style={{ fontSize: 18, color: C.textMuted }}>دينار جزائري</div>
          </div>
          <button onClick={() => { setBooking(b => ({ ...b, price: base, negotiated: false })); setDrivers(DRIVERS.map(d => ({ ...d, status: "pending", offerPrice: null }))); setTimer(0); setPhase(0); setScreen("searching"); }} style={{ width: "100%", background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 16, padding: 18, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer" }}>
            ✅ قبول السعر — {base} دج
          </button>
        </div>
      ) : (
        <div style={{ margin: "0 20px" }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, marginBottom: 14 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: myPrice < base * 0.6 ? C.red : C.dark, lineHeight: 1 }}>{myPrice}</div>
            <div style={{ fontSize: 16, color: C.textMuted, marginBottom: 16 }}>دينار جزائري</div>
            <input type="range" min={Math.round(base * 0.5)} max={Math.round(base * 1.5)} value={myPrice} onChange={e => setMyPrice(Number(e.target.value))} style={{ width: "100%", accentColor: C.green, cursor: "pointer", marginBottom: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textLight }}>
              <span>{Math.round(base * 0.5)} دج</span>
              <span style={{ color: C.green, fontWeight: 700 }}>مقترح: {base}</span>
              <span>{Math.round(base * 1.5)} دج</span>
            </div>
            {myPrice < base * 0.6 && <div style={{ marginTop: 10, background: C.redLight, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.red }}>⚠️ السعر منخفض جداً</div>}
          </div>
          <div style={{ background: C.card, borderRadius: 20, padding: 16, boxShadow: C.shadow, marginBottom: 14 }}>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="رسالة للسائق (اختياري)..." style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, resize: "none", outline: "none", height: 60, direction: "rtl" }} />
          </div>
          <button onClick={() => { setBooking(b => ({ ...b, price: myPrice, negotiated: true, note })); setDrivers(DRIVERS.map(d => ({ ...d, status: "pending", offerPrice: null }))); setTimer(0); setPhase(0); setScreen("searching"); }} style={{ width: "100%", background: `linear-gradient(135deg,${C.dark},#2d1b69)`, border: "none", borderRadius: 16, padding: 18, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer" }}>
            🤝 إرسال العرض — {myPrice} دج
          </button>
        </div>
      )}
    </div>
  );

  if (screen === "searching") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: 40 }}>
      <TaxiMap origin={booking?.originPlace} destination={booking?.destPlace} showDrivers={true} />
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{phase === 0 ? "📡 يتم بث طلبك..." : "📨 ردود السائقين"}</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>عرضك: {booking?.price} دج · ⏱ {timer}ث</div>
      </div>
      {phase === 0 && (
        <div style={{ margin: "20px auto", width: 100, height: 100, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ position: "absolute", width: 30+i*25, height: 30+i*25, borderRadius: "50%", border: `2px solid ${C.green}`, animation: "pg 1.5s ease-out infinite", animationDelay: `${i*0.4}s` }} />)}
          <div style={{ fontSize: 32, zIndex: 1 }}>🚕</div>
          <style>{`@keyframes pg{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(1.5);opacity:0}}`}</style>
        </div>
      )}
      {phase === 1 && (
        <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {drivers.map(d => (
            <div key={d.id} style={{ background: C.card, borderRadius: 18, padding: 16, boxShadow: C.shadow, border: d.status === "accepted" ? `2px solid ${C.green}` : `1px solid ${C.border}`, opacity: d.status === "pending" ? 0.5 : 1, transition: "all 0.4s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>⭐ {d.rating} · {d.car}</div>
                  </div>
                </div>
                {d.status === "pending" && <span style={{ color: C.textLight, fontSize: 12 }}>ينتظر...</span>}
                {d.status === "accepted" && <div style={{ fontWeight: 900, fontSize: 18, color: C.green }}>{d.offerPrice} دج ✅</div>}
              </div>
              {d.status === "accepted" && (
                <button onClick={() => { setSelectedDriver(d); setScreen("found"); }} style={{ width: "100%", marginTop: 10, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 12, padding: 12, color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  ✅ اختيار هذا السائق
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (screen === "found") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <TaxiMap origin={booking?.originPlace} destination={booking?.destPlace} showDrivers={false} />
      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 22, boxShadow: C.shadow }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: C.text }}>تم قبول طلبك!</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>السائق في طريقه إليك</div>
        </div>
        <div style={{ background: C.bg, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{selectedDriver?.avatar}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{selectedDriver?.name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>⭐ {selectedDriver?.rating} · {selectedDriver?.car}</div>
              <div style={{ fontSize: 11, color: C.textLight }}>{selectedDriver?.plate}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: C.greenLight, borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.greenDark }}>{selectedDriver?.offerPrice} دج</div>
              <div style={{ fontSize: 11, color: C.green }}>السعر المتفق</div>
            </div>
            <div style={{ flex: 1, background: C.blueLight, borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.blue }}>~3</div>
              <div style={{ fontSize: 11, color: C.blue }}>دقائق</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.dark, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#ffffff88", marginBottom: 6 }}>رمز التحقق</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: 8 }}>4782</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setScreen("home")} style={{ flex: 1, background: C.redLight, border: "none", borderRadius: 12, padding: 14, color: C.red, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>❌ إلغاء</button>
          <button onClick={() => { setElapsed(0); setDone(false); setScreen("ride"); }} style={{ flex: 2, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 12, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>📱 تتبع الرحلة</button>
        </div>
      </div>
    </div>
  );

  if (screen === "ride") {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (done) return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <div style={{ fontSize: 64 }}>🏁</div>
        <div style={{ fontWeight: 900, fontSize: 24, color: C.text }}>وصلت بسلام!</div>
        <div style={{ background: C.card, borderRadius: 24, padding: 24, width: "100%", boxShadow: C.shadow, textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: C.text }}>قيّم رحلتك</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
            {[1,2,3,4,5].map(s => <div key={s} onClick={() => setRating(s)} style={{ fontSize: 34, cursor: "pointer", opacity: s <= rating ? 1 : 0.25 }}>⭐</div>)}
          </div>
          <div style={{ background: C.greenLight, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.greenDark }}>{selectedDriver?.offerPrice} دج</div>
          </div>
          <button onClick={() => { setScreen("home"); setRating(0); }} style={{ width: "100%", background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>✅ إنهاء</button>
        </div>
      </div>
    );
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
        <TaxiMap origin={booking?.originPlace} destination={booking?.destPlace} showDrivers={false} />
        <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ background: C.greenLight, borderRadius: 12, padding: "8px 14px" }}>
              <div style={{ fontSize: 10, color: C.green }}>الوقت</div>
              <div style={{ fontWeight: 800, color: C.greenDark }}>{mins}:{secs.toString().padStart(2,"0")}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.textMuted }}>الوجهة</div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 13, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{destText}</div>
            </div>
            <div style={{ background: C.dark, borderRadius: 12, padding: "8px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#ffffff88" }}>السعر</div>
              <div style={{ fontWeight: 800, color: "#fff" }}>{selectedDriver?.offerPrice} دج</div>
            </div>
          </div>
          <button onClick={() => setDone(true)} style={{ width: "100%", background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>🏁 محاكاة الوصول</button>
        </div>
      </div>
    );
  }

  return null;
}

// ===== DRIVER DASHBOARD =====
function DriverDashboard({ onLogout }) {
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState("home");
  const [reqs, setReqs] = useState([
    { id: 1, name: "أحمد سليم", from: "باب الزوار", to: "حيدرة", offer: 700, suggested: 850, avatar: "👨" },
    { id: 2, name: "نور الهدى", from: "القبة", to: "المطار", offer: 2000, suggested: 2500, avatar: "👩" },
  ]);
  const stats = [
    { label: "أرباح اليوم", value: "4,550 دج", icon: "💰", color: C.green },
    { label: "رحلات اليوم", value: "3", icon: "🚕", color: C.blue },
    { label: "التقييم", value: "4.9 ⭐", icon: "🏆", color: "#f59e0b" },
    { label: "القبول", value: "94%", icon: "📊", color: C.orange },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: "#1a1d27", padding: "48px 20px 20px", borderBottom: "1px solid #2a2d3e" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg,${C.orange},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👨‍✈️</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>كريم بن علي</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>⭐ 4.9 · رونو سيمبول 2021</div>
            </div>
          </div>
          <div onClick={() => setOnline(!online)} style={{ width: 56, height: 28, borderRadius: 14, background: online ? C.green : "#2a2d3e", position: "relative", cursor: "pointer", transition: "all 0.3s" }}>
            <div style={{ position: "absolute", top: 3, right: online ? 3 : "auto", left: online ? "auto" : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "all 0.3s" }} />
          </div>
        </div>
        {online && <div style={{ marginTop: 12, background: "#00b37e22", border: "1px solid #00b37e44", borderRadius: 12, padding: "8px 14px", fontSize: 13, color: C.green }}>🟢 متصل — تلقّي الطلبات</div>}
      </div>
      <div style={{ paddingBottom: 100 }}>
        {tab === "home" && (
          <>
            <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ background: "#1a1d27", borderRadius: 16, padding: 16, border: "1px solid #2a2d3e" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {online && reqs.length > 0 && (
              <div style={{ padding: "16px 20px 0" }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", marginBottom: 12 }}>🔔 طلبات جديدة</div>
                {reqs.map(r => (
                  <div key={r.id} style={{ background: "#1a1d27", borderRadius: 18, padding: 16, marginBottom: 10, border: `1px solid ${C.orange}44` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2a2d3e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{r.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{r.from} ← {r.to}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>{r.offer} دج</div>
                        <div style={{ fontSize: 11, color: "#4a5568" }}>مقترح: {r.suggested}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setReqs(p => p.filter(x => x.id !== r.id))} style={{ flex: 1, background: "#ef444422", border: "none", borderRadius: 10, padding: 10, color: C.red, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>❌ رفض</button>
                      <button onClick={() => setReqs(p => p.filter(x => x.id !== r.id))} style={{ flex: 2, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 10, padding: 10, color: "#fff", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>✅ قبول {r.offer} دج</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!online && (
              <div style={{ margin: "16px 20px", background: "#1a1d27", borderRadius: 20, padding: 24, border: "1px solid #2a2d3e", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>😴</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 8 }}>أنت غير متصل</div>
                <button onClick={() => setOnline(true)} style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: "14px 32px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>🟢 تفعيل</button>
              </div>
            )}
          </>
        )}
        {tab === "profile" && (
          <div style={{ padding: "20px 20px 100px" }}>
            <div style={{ background: "#1a1d27", borderRadius: 20, padding: 24, border: "1px solid #2a2d3e", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>👨‍✈️</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>كريم بن علي</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>رونو سيمبول 2021 · 213-01-DZ</div>
              <div style={{ display: "inline-block", background: "#00b37e22", color: C.green, padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 8 }}>✅ سائق معتمد</div>
            </div>
            <button onClick={onLogout} style={{ width: "100%", background: "#ef444422", border: "1px solid #ef444444", borderRadius: 16, padding: 16, color: C.red, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>🚪 تسجيل الخروج</button>
          </div>
        )}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#1a1d27", borderTop: "1px solid #2a2d3e", display: "flex", padding: "8px 0 20px" }}>
        {[{ id: "home", label: "الرئيسية", icon: "🏠" }, { id: "profile", label: "حسابي", icon: "👤" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0" }}>
            <div style={{ fontSize: 22, opacity: tab === t.id ? 1 : 0.4 }}>{t.icon}</div>
            <div style={{ fontSize: 10, color: tab === t.id ? C.green : "#4a5568", fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== MAIN APP =====
export default function App() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || "",
    libraries: LIBRARIES,
    language: "ar",
    region: "DZ",
  });

  const [screen, setScreen] = useState("welcome");
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, u => setUser(u || null));
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    if (auth) { try { await signOut(auth); } catch(e) {} }
    setUser(null); setRole(null); setScreen("welcome");
  };

  if (loadError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>خطأ في تحميل الخريطة</div>
        <div style={{ fontSize: 14, color: C.textMuted, marginTop: 8 }}>تحقق من مفتاح Google Maps</div>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'Cairo',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontWeight: 700, color: C.text }}>جارٍ تحميل الخريطة...</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      {screen === "welcome" && <WelcomeScreen onSelect={r => { setRole(r); setScreen("auth"); }} />}
      {screen === "auth" && <AuthForm role={role} onSuccess={() => setScreen("app")} onBack={() => { setRole(null); setScreen("welcome"); }} />}
      {screen === "app" && role === "passenger" && <PassengerApp onLogout={handleLogout} user={user} />}
      {screen === "app" && role === "driver" && <DriverDashboard onLogout={handleLogout} />}
    </div>
  );
}
