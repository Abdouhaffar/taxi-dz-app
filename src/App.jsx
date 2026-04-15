import { useState, useEffect, useCallback, useRef } from "react";
import {
  // ===== NOTIFICATIONS =====
function useNotifications() {
  const [permitted, setPermitted] = useState(false);

  useEffect(() => {
    if (window.OneSignal) {
      window.OneSignal.Notifications.requestPermission().then(p => setPermitted(p));
    }
  }, []);

  const notify = (title, message, icon = "🚕") => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(`${icon} ${title}`, {
        body: message,
        icon: "/logo192.png",
        badge: "/logo192.png",
        dir: "rtl",
        lang: "ar",
      });
    }
  };

  const notifyDriverAccepted = (driverName, price) => {
    notify("تم قبول طلبك! 🎉", `${driverName} قبل رحلتك بـ ${price} دج`);
  };

  const notifyDriverArriving = (driverName) => {
    notify("السائق في الطريق 🚕", `${driverName} سيصل خلال 3 دقائق`);
  };

  const notifyRideStarted = () => {
    notify("بدأت رحلتك 🛣️", "استمتع برحلتك — وصولاً آمناً!");
  };

  const notifyRideCompleted = (price) => {
    notify("وصلت بسلام! 🏁", `تم الدفع ${price} دج — شكراً لاستخدامك TaxiDZ`);
  };

  const notifyNewOffer = (price) => {
    notify("عرض جديد من سائق 🤝", `سائق قريب يعرض ${price} دج`);
  };

  return { permitted, notify, notifyDriverAccepted, notifyDriverArriving, notifyRideStarted, notifyRideCompleted, notifyNewOffer };
}
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
  Autocomplete,
} from "@react-google-maps/api";

const LIBRARIES = ["places"];
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const C = {
  bg: "#f7f3ee",
  card: "#ffffff",
  dark: "#1a1a2e",
  green: "#00b37e",
  greenLight: "#e6f9f3",
  greenDark: "#007a55",
  orange: "#f97316",
  orangeLight: "#fff4ed",
  red: "#ef4444",
  redLight: "#fef2f2",
  blue: "#3b82f6",
  blueLight: "#eff6ff",
  text: "#1a1a2e",
  textMuted: "#64748b",
  textLight: "#94a3b8",
  border: "#e8e3db",
  shadow: "0 4px 24px rgba(0,0,0,0.08)",
};

// ===== ALGERIA CENTER =====
const ALGERIA_CENTER = { lat: 36.737, lng: 3.086 };

const MAP_STYLE = [
  { featureType: "all", elementType: "geometry", stylers: [{ color: "#f5f0eb" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffe0c2" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffb347" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#aad3df" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#f2f2f2" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b2a6" }] },
];

const SCREENS = {
  HOME: "home",
  BOOKING: "booking",
  NEGOTIATION: "negotiation",
  SEARCHING: "searching",
  DRIVER_FOUND: "driver_found",
  RIDE: "ride",
};

const DRIVERS = [
  { id: 1, name: "كريم بن علي", rating: 4.9, trips: 1240, car: "رونو سيمبول 2021", plate: "213-01-DZ", avatar: "👨‍✈️", offerPrice: null, status: "pending", position: { lat: 36.752, lng: 3.042 } },
  { id: 2, name: "يوسف مزياني", rating: 4.7, trips: 876, car: "بيجو 301 2020", plate: "107-16-DZ", avatar: "🧔", offerPrice: null, status: "pending", position: { lat: 36.720, lng: 3.110 } },
  { id: 3, name: "أمين شريف", rating: 4.8, trips: 2103, car: "داسيا لوغان 2022", plate: "445-09-DZ", avatar: "👨‍🦱", offerPrice: null, status: "pending", position: { lat: 36.745, lng: 3.060 } },
];

// ===== GOOGLE MAP COMPONENT =====
function TaxiMap({ origin, destination, showDrivers, driverPosition, onMapClick }) {
  const [directions, setDirections] = useState(null);
  const [userLocation, setUserLocation] = useState(ALGERIA_CENTER);
  const mapRef = useRef(null);

  // Get user GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(ALGERIA_CENTER)
      );
    }
  }, []);

  // Calculate route when origin & destination are set
  useEffect(() => {
    if (!origin || !destination) { setDirections(null); return; }
    const service = new window.google.maps.DirectionsService();
    service.route(
      { origin, destination, travelMode: window.google.maps.TravelMode.DRIVING },
      (result, status) => { if (status === "OK") setDirections(result); }
    );
  }, [origin, destination]);

  const onLoad = useCallback(map => { mapRef.current = map; }, []);

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "220px", borderRadius: 20 }}
      center={origin || userLocation}
      zoom={13}
      onLoad={onLoad}
      onClick={onMapClick}
      options={{ styles: MAP_STYLE, disableDefaultUI: true, zoomControl: true }}
    >
      {/* User location marker */}
      {!origin && (
        <Marker position={userLocation} icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='10' fill='${C.green}' stroke='white' stroke-width='3'/></svg>`), scaledSize: new window.google.maps.Size(24, 24) }} />
      )}

      {/* Origin marker */}
      {origin && !directions && (
        <Marker position={origin} icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'><path d='M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z' fill='${C.green}'/><circle cx='16' cy='16' r='8' fill='white'/></svg>`), scaledSize: new window.google.maps.Size(32, 40), anchor: new window.google.maps.Point(16, 40) }} />
      )}

      {/* Destination marker */}
      {destination && !directions && (
        <Marker position={destination} icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'><path d='M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z' fill='${C.orange}'/><circle cx='16' cy='16' r='8' fill='white'/></svg>`), scaledSize: new window.google.maps.Size(32, 40), anchor: new window.google.maps.Point(16, 40) }} />
      )}

      {/* Route */}
      {directions && (
        <DirectionsRenderer directions={directions} options={{ suppressMarkers: false, polylineOptions: { strokeColor: C.green, strokeWeight: 4, strokeOpacity: 0.8 } }} />
      )}

      {/* Driver markers */}
      {showDrivers && DRIVERS.map(d => (
        <Marker key={d.id} position={d.position} icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'><circle cx='18' cy='18' r='18' fill='${C.dark}'/><text x='18' y='24' text-anchor='middle' font-size='18'>🚕</text></svg>`), scaledSize: new window.google.maps.Size(36, 36) }} />
      ))}

      {/* Active driver position during ride */}
      {driverPosition && (
        <Marker position={driverPosition} icon={{ url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'><circle cx='22' cy='22' r='22' fill='${C.orange}'/><text x='22' y='30' text-anchor='middle' font-size='22'>🚕</text></svg>`), scaledSize: new window.google.maps.Size(44, 44) }} />
      )}
    </GoogleMap>
  );
}

// ===== ROUTE INFO BAR =====
function RouteInfo({ origin, destination }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!origin || !destination) { setInfo(null); return; }
    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
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

// ===== STATUS BAR =====
function StatusBar() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px 0", fontSize: 12, color: C.textMuted }}>
      <span style={{ fontWeight: 700 }}>9:41</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span>●●●</span><span>WiFi</span><span>🔋</span>
      </div>
    </div>
  );
}

// ===== HOME SCREEN =====
function HomeScreen({ onBook, mapOrigin }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
      <StatusBar />
      <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: C.textMuted }}>موقعك الحالي 📍</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>الجزائر العاصمة</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
      </div>

      <div style={{ margin: "0 20px" }}>
        <TaxiMap origin={mapOrigin} destination={null} showDrivers={true} />
      </div>

      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: C.text }}>إلى أين تريد الذهاب؟ 🚕</div>
        <div onClick={onBook} style={{ background: C.dark, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange, flexShrink: 0 }} />
          <span style={{ color: "#ffffff88", fontSize: 14 }}>إلى أين؟ ابحث عن وجهتك...</span>
        </div>
        <button onClick={onBook} style={{ width: "100%", marginTop: 12, background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 16, padding: "16px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: `0 6px 20px ${C.green}44` }}>
          🚀 ابحث عن سيارة
        </button>
      </div>

      <div style={{ margin: "0 20px 20px", background: `linear-gradient(135deg, ${C.dark}, #2d1b69)`, borderRadius: 20, padding: "18px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>ميزة حصرية</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>فاوض على السعر! 🤝</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>أنت تحدد ما تريد دفعه</div>
        </div>
        <div style={{ fontSize: 48 }}>💰</div>
      </div>
    </div>
  );
}

// ===== BOOKING SCREEN =====
function BookingScreen({ onNext, onBack }) {
  const [originPlace, setOriginPlace] = useState(null);
  const [destPlace, setDestPlace] = useState(null);
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [rideType, setRideType] = useState("economy");
  const originRef = useRef(null);
  const destRef = useRef(null);

  const types = [
    { id: "economy", label: "اقتصادي", icon: "🚗", time: "3 دق", pricePerKm: 80 },
    { id: "comfort", label: "مريح", icon: "🚙", time: "5 دق", pricePerKm: 120 },
    { id: "xl", label: "XL كبير", icon: "🚐", time: "7 دق", pricePerKm: 160 },
  ];

  const onOriginLoad = ac => { originRef.current = ac; };
  const onDestLoad = ac => { destRef.current = ac; };

  const onOriginChanged = () => {
    if (originRef.current) {
      const place = originRef.current.getPlace();
      if (place.geometry) {
        setOriginPlace(place.geometry.location);
        setOriginText(place.formatted_address || place.name);
      }
    }
  };

  const onDestChanged = () => {
    if (destRef.current) {
      const place = destRef.current.getPlace();
      if (place.geometry) {
        setDestPlace(place.geometry.location);
        setDestText(place.formatted_address || place.name);
      }
    }
  };

  const canProceed = originPlace && destPlace;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", paddingBottom: 30 }}>
      <StatusBar />
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px 12px", gap: 12 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>تفاصيل الرحلة</div>
      </div>

      <div style={{ margin: "0 20px" }}>
        <TaxiMap origin={originPlace} destination={destPlace} showDrivers={false} />
      </div>
      <RouteInfo origin={originPlace} destination={destPlace} />

      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
        {/* Origin Autocomplete */}
        <div style={{ background: C.greenLight, borderRadius: 14, padding: "12px 16px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
          <Autocomplete onLoad={onOriginLoad} onPlaceChanged={onOriginChanged} options={{ componentRestrictions: { country: "dz" } }}>
            <input value={originText} onChange={e => setOriginText(e.target.value)} placeholder="نقطة الانطلاق..." style={{ background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: C.text, width: "100%", textAlign: "right" }} />
          </Autocomplete>
        </div>

        {/* Destination Autocomplete */}
        <div style={{ background: C.orangeLight, borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange, flexShrink: 0 }} />
          <Autocomplete onLoad={onDestLoad} onPlaceChanged={onDestChanged} options={{ componentRestrictions: { country: "dz" } }}>
            <input value={destText} onChange={e => setDestText(e.target.value)} placeholder="إلى أين؟ مثال: حيدرة، باب الوادي..." style={{ background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: C.text, width: "100%", textAlign: "right" }} />
          </Autocomplete>
        </div>

        {/* Ride Types */}
        <div style={{ fontWeight: 700, marginBottom: 10, color: C.text }}>نوع السيارة</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {types.map(t => (
            <div key={t.id} onClick={() => setRideType(t.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 14, border: `2px solid ${rideType === t.id ? C.green : C.border}`, background: rideType === t.id ? C.greenLight : C.bg, cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 24 }}>{t.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>⏱ {t.time}</div>
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: rideType === t.id ? C.greenDark : C.text }}>{t.pricePerKm} دج/كم</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>سعر مقترح</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => canProceed && onNext({ originPlace, destPlace, originText, destText, rideType })}
          style={{ width: "100%", background: canProceed ? `linear-gradient(135deg, ${C.green}, ${C.greenDark})` : C.border, border: "none", borderRadius: 16, padding: "16px", color: canProceed ? "#fff" : C.textMuted, fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: canProceed ? "pointer" : "default", transition: "all 0.3s" }}>
          {canProceed ? "التالي: تحديد السعر 💰" : "اختر نقطة الانطلاق والوجهة"}
        </button>
      </div>
    </div>
  );
}

// ===== NEGOTIATION SCREEN =====
function NegotiationScreen({ booking, onConfirm, onBack }) {
  const basePrices = { economy: 750, comfort: 1150, xl: 1500 };
  const base = basePrices[booking.rideType] || 750;
  const [myPrice, setMyPrice] = useState(base);
  const [mode, setMode] = useState("suggested");
  const [note, setNote] = useState("");
  const discount = Math.round(((base - myPrice) / base) * 100);
  const isLow = myPrice < base * 0.6;
  const suggestions = [Math.round(base * 0.75), Math.round(base * 0.85), base, Math.round(base * 1.1)];
  const labels = ["اقتصادي 🟢", "عادل 👍", "مقترح ⭐", "مميز 🔥"];
  const colors = [C.green, C.blue, C.dark, C.orange];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", paddingBottom: 40 }}>
      <StatusBar />
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 12 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18 }}>←</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>حدد سعرك 💰</div>
          <div style={{ fontSize: 12, color: C.textMuted, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.originText} ← {booking.destText}</div>
        </div>
      </div>

      <div style={{ margin: "0 20px 14px", background: C.card, borderRadius: 18, padding: 6, display: "flex", boxShadow: C.shadow }}>
        {[{ id: "suggested", label: "✅ السعر المقترح" }, { id: "negotiate", label: "🤝 فاوض السعر" }].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, border: "none", background: mode === m.id ? C.dark : "transparent", color: mode === m.id ? "#fff" : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, transition: "all 0.2s" }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "suggested" ? (
        <div style={{ margin: "0 20px" }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>السعر المقترح</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: C.green }}>{base}</div>
            <div style={{ fontSize: 18, color: C.textMuted }}>دينار جزائري</div>
          </div>
          <button onClick={() => onConfirm({ price: base, negotiated: false, note: "" })} style={{ width: "100%", background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 16, padding: 18, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer" }}>
            ✅ قبول السعر — {base} دج
          </button>
        </div>
      ) : (
        <div style={{ margin: "0 20px" }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>سعرك المقترح {discount > 0 && `· وفّرت ${discount}%`}</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: isLow ? C.red : C.dark, lineHeight: 1 }}>{myPrice}</div>
            <div style={{ fontSize: 16, color: C.textMuted, marginBottom: 16 }}>دينار جزائري</div>
            <input type="range" min={Math.round(base * 0.5)} max={Math.round(base * 1.5)} value={myPrice} onChange={e => setMyPrice(Number(e.target.value))} style={{ width: "100%", accentColor: isLow ? C.red : C.green, cursor: "pointer", marginBottom: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textLight }}>
              <span>{Math.round(base * 0.5)} دج</span>
              <span style={{ color: C.green, fontWeight: 700 }}>مقترح: {base}</span>
              <span>{Math.round(base * 1.5)} دج</span>
            </div>
            {isLow && <div style={{ marginTop: 10, background: C.redLight, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.red }}>⚠️ السعر منخفض جداً — قد يرفضه السائقون</div>}
          </div>

          <div style={{ background: C.card, borderRadius: 20, padding: 18, boxShadow: C.shadow, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 10 }}>اقتراحات سريعة</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setMyPrice(s)} style={{ flex: 1, minWidth: "calc(50% - 4px)", padding: "10px 6px", borderRadius: 12, border: `2px solid ${myPrice === s ? colors[i] : C.border}`, background: myPrice === s ? colors[i] + "15" : C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: myPrice === s ? colors[i] : C.text }}>{s} دج</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{labels[i]}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: C.card, borderRadius: 20, padding: 18, boxShadow: C.shadow, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 8 }}>رسالة للسائق (اختياري)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="مثال: سأكون جاهزاً خلال دقيقتين..." style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, resize: "none", outline: "none", height: 70, direction: "rtl" }} />
          </div>

          <button onClick={() => onConfirm({ price: myPrice, negotiated: true, note })} style={{ width: "100%", background: `linear-gradient(135deg, ${C.dark}, #2d1b69)`, border: "none", borderRadius: 16, padding: 18, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer" }}>
            🤝 إرسال العرض — {myPrice} دج
          </button>
        </div>
      )}
    </div>
  );
}

// ===== SEARCHING SCREEN =====
function SearchingScreen({ booking, onDriverFound }) {
  const [drivers, setDrivers] = useState(DRIVERS.map(d => ({ ...d, status: "pending", offerPrice: null })));
  const [timer, setTimer] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTimer(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timer === 3) setPhase(1);
    if (timer === 4) setDrivers(p => p.map((d, i) => i === 0 ? { ...d, status: booking.negotiated ? "counter" : "accepted", offerPrice: booking.negotiated ? Math.round(booking.price * 1.1) : booking.price } : d));
    if (timer === 7) setDrivers(p => p.map((d, i) => i === 1 ? { ...d, status: "accepted", offerPrice: booking.price } : d));
    if (timer === 10) setDrivers(p => p.map((d, i) => i === 2 ? { ...d, status: booking.negotiated ? "counter" : "accepted", offerPrice: booking.negotiated ? Math.round(booking.price * 1.05) : booking.price } : d));
  }, [timer]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", paddingBottom: 40 }}>
      <StatusBar />
      <div style={{ margin: "16px 20px 0" }}>
        <TaxiMap origin={booking.originPlace} destination={booking.destPlace} showDrivers={true} />
      </div>
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{phase === 0 ? "📡 يتم بث طلبك للسائقين..." : "📨 ردود السائقين"}</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>عرضك: {booking.price} دج · ⏱ {timer}ث</div>
      </div>

      {phase === 0 && (
        <div style={{ margin: "20px auto", width: 100, height: 100, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ position: "absolute", width: 30+i*25, height: 30+i*25, borderRadius: "50%", border: `2px solid ${C.green}`, animation: "ping 1.5s ease-out infinite", animationDelay: `${i*0.4}s` }} />)}
          <div style={{ fontSize: 32, zIndex: 1 }}>🚕</div>
          <style>{`@keyframes ping{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(1.5);opacity:0}}`}</style>
        </div>
      )}

      {phase === 1 && (
        <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {drivers.map(d => (
            <div key={d.id} style={{ background: C.card, borderRadius: 18, padding: 16, boxShadow: C.shadow, border: d.status === "accepted" ? `2px solid ${C.green}` : d.status === "counter" ? `2px solid ${C.orange}` : `1px solid ${C.border}`, opacity: d.status === "pending" ? 0.5 : 1, transition: "all 0.4s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>⭐ {d.rating} · {d.car}</div>
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  {d.status === "pending" && <span style={{ color: C.textLight, fontSize: 12 }}>ينتظر...</span>}
                  {d.status === "accepted" && <div style={{ fontWeight: 900, fontSize: 18, color: C.green }}>{d.offerPrice} دج ✅</div>}
                  {d.status === "counter" && <div style={{ fontWeight: 900, fontSize: 18, color: C.orange }}>{d.offerPrice} دج 🤝</div>}
                </div>
              </div>
              {(d.status === "accepted" || d.status === "counter") && (
                <button onClick={() => onDriverFound(d)} style={{ width: "100%", marginTop: 10, background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 12, padding: 12, color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  ✅ اختيار هذا السائق
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== DRIVER FOUND SCREEN =====
function DriverFoundScreen({ driver, booking, onStart, onCancel }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
      <StatusBar />
      <div style={{ margin: "16px 20px 0" }}>
        <TaxiMap origin={booking.originPlace} destination={booking.destPlace} showDrivers={false} driverPosition={driver.position} />
      </div>
      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 22, boxShadow: C.shadow }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: C.text }}>تم قبول طلبك!</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>السائق في طريقه إليك</div>
        </div>
        <div style={{ background: C.bg, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{driver.avatar}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{driver.name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>⭐ {driver.rating} · {driver.car}</div>
              <div style={{ fontSize: 11, color: C.textLight }}>{driver.plate}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: C.greenLight, borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.greenDark }}>{driver.offerPrice} دج</div>
              <div style={{ fontSize: 11, color: C.green }}>السعر المتفق</div>
            </div>
            <div style={{ flex: 1, background: C.blueLight, borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.blue }}>~3</div>
              <div style={{ fontSize: 11, color: C.blue }}>دقائق للوصول</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.dark, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#ffffff88", marginBottom: 6 }}>رمز التحقق — أعطه للسائق</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: 8 }}>4782</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: C.redLight, border: "none", borderRadius: 12, padding: 14, color: C.red, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>❌ إلغاء</button>
          <button onClick={onStart} style={{ flex: 2, background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 12, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>📱 تتبع الرحلة</button>
        </div>
      </div>
    </div>
  );
}

// ===== RIDE SCREEN =====
function RideScreen({ driver, booking, onEnd }) {
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [driverPos, setDriverPos] = useState(driver.position);

  // Simulate driver moving toward origin
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => {
      setElapsed(p => p + 1);
      setDriverPos(prev => ({
        lat: prev.lat + (booking.originPlace.lat() - prev.lat) * 0.05,
        lng: prev.lng + (booking.originPlace.lng() - prev.lng) * 0.05,
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [done]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <div style={{ fontSize: 64 }}>🏁</div>
        <div style={{ fontWeight: 900, fontSize: 24, color: C.text }}>وصلت بسلام!</div>
        <div style={{ background: C.card, borderRadius: 24, padding: 24, width: "100%", boxShadow: C.shadow, textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: C.text }}>قيّم رحلتك مع {driver.name}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
            {[1,2,3,4,5].map(s => <div key={s} onClick={() => setRating(s)} style={{ fontSize: 34, cursor: "pointer", opacity: s <= rating ? 1 : 0.25, transition: "all 0.2s" }}>⭐</div>)}
          </div>
          <div style={{ background: C.greenLight, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.greenDark }}>{driver.offerPrice} دج</div>
            <div style={{ fontSize: 13, color: C.green }}>المبلغ المدفوع</div>
          </div>
          <button onClick={onEnd} style={{ width: "100%", background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 14, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            ✅ إنهاء وتقييم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
      <StatusBar />
      <div style={{ margin: "16px 20px 0" }}>
        <TaxiMap origin={booking.originPlace} destination={booking.destPlace} showDrivers={false} driverPosition={driverPos} />
      </div>
      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ background: C.greenLight, borderRadius: 12, padding: "8px 14px" }}>
            <div style={{ fontSize: 10, color: C.green }}>الوقت</div>
            <div style={{ fontWeight: 800, color: C.greenDark }}>{mins}:{secs.toString().padStart(2,"0")}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textMuted }}>في الطريق إلى</div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 13, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.destText}</div>
          </div>
          <div style={{ background: C.dark, borderRadius: 12, padding: "8px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#ffffff88" }}>السعر</div>
            <div style={{ fontWeight: 800, color: "#fff" }}>{driver.offerPrice} دج</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: C.bg, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 26 }}>{driver.avatar}</div>
          <div>
            <div style={{ fontWeight: 700, color: C.text }}>{driver.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{driver.car} · {driver.plate}</div>
          </div>
          <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>📱</div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>💬</div>
          </div>
        </div>
        <button onClick={() => setDone(true)} style={{ width: "100%", background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 14, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
          🏁 محاكاة الوصول
        </button>
      </div>
    </div>
  );
}

// ===== MAIN APP =====
export default function TaxiDZ() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
    language: "ar",
    region: "DZ",
  });

  const [screen, setScreen] = useState(SCREENS.HOME);
  const [booking, setBooking] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  if (loadError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo', sans-serif", direction: "rtl", background: "#f7f3ee" }}>
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: "#1a1a2e" }}>خطأ في تحميل الخريطة</div>
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>تحقق من صحة REACT_APP_GOOGLE_MAPS_KEY</div>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo', sans-serif", background: "#f7f3ee" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
        <div style={{ fontWeight: 700, color: "#1a1a2e" }}>جارٍ تحميل الخريطة...</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: "#f7f3ee" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      {screen === SCREENS.HOME && <HomeScreen onBook={() => setScreen(SCREENS.BOOKING)} />}
      {screen === SCREENS.BOOKING && <BookingScreen onBack={() => setScreen(SCREENS.HOME)} onNext={data => { setBooking(data); setScreen(SCREENS.NEGOTIATION); }} />}
      {screen === SCREENS.NEGOTIATION && <NegotiationScreen booking={booking} onBack={() => setScreen(SCREENS.BOOKING)} onConfirm={data => { setBooking({ ...booking, ...data }); setScreen(SCREENS.SEARCHING); }} />}
      {screen === SCREENS.SEARCHING && <SearchingScreen booking={booking} onDriverFound={d => { setSelectedDriver(d); setScreen(SCREENS.DRIVER_FOUND); }} />}
      {screen === SCREENS.DRIVER_FOUND && <DriverFoundScreen driver={selectedDriver} booking={booking} onCancel={() => setScreen(SCREENS.HOME)} onStart={() => setScreen(SCREENS.RIDE)} />}
      {screen === SCREENS.RIDE && <RideScreen driver={selectedDriver} booking={booking} onEnd={() => setScreen(SCREENS.HOME)} />}
    </div>
  );
}
