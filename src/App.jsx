import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Autocomplete } from "@react-google-maps/api";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let auth, db;
try {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) { console.log("Firebase error:", e); }

const LIBRARIES = ["places"];
const ALGERIA_CENTER = { lat: 36.737, lng: 3.086 };
const PRICE_PER_KM = 30;
const MIN_PRICE = 100;

const calcPrice = (km, multiplier = 1.0) => {
  if (!km || km <= 0) return MIN_PRICE;
  return Math.max(Math.round(km * PRICE_PER_KM * multiplier), MIN_PRICE);
};

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
  yellow: "#f59e0b",
  text: "#1a1a2e", textMuted: "#64748b", textLight: "#94a3b8",
  border: "#e8e3db", shadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const RIDE_TYPES = [
  { id: "economy", label: "اقتصادي", icon: "🚗", multiplier: 1.0, time: "3 دق" },
  { id: "comfort", label: "مريح", icon: "🚙", multiplier: 1.4, time: "5 دق" },
  { id: "xl", label: "XL كبير", icon: "🚐", multiplier: 1.8, time: "7 دق" },
];

const DRIVERS = [
  { id: 1, name: "كريم بن علي", rating: 4.9, car: "رونو سيمبول 2021", plate: "213-01-DZ", avatar: "👨‍✈️", position: { lat: 36.752, lng: 3.042 } },
  { id: 2, name: "يوسف مزياني", rating: 4.7, car: "بيجو 301 2020", plate: "107-16-DZ", avatar: "🧔", position: { lat: 36.720, lng: 3.110 } },
  { id: 3, name: "أمين شريف", rating: 4.8, car: "داسيا لوغان 2022", plate: "445-09-DZ", avatar: "👨‍🦱", position: { lat: 36.745, lng: 3.060 } },
];

// ===== MAP =====
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
  const makeMarker = (emoji, color) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='${color}' stroke='white' stroke-width='3'/><text x='20' y='27' text-anchor='middle' font-size='18'>${emoji}</text></svg>`);

  return (
    <div style={{ margin: "0 20px", borderRadius: 20, overflow: "hidden" }}>
      <GoogleMap mapContainerStyle={{ width: "100%", height: `${height}px` }} center={origin || userLocation} zoom={13} onLoad={onLoad} options={{ styles: MAP_STYLE, disableDefaultUI: true, zoomControl: true }}>
        {!origin && <Marker position={userLocation} />}
        {origin && !directions && <Marker position={origin} icon={{ url: makeMarker("📍", C.green), scaledSize: new window.google.maps.Size(40, 40) }} />}
        {destination && !directions && <Marker position={destination} icon={{ url: makeMarker("🏁", C.orange), scaledSize: new window.google.maps.Size(40, 40) }} />}
        {directions && <DirectionsRenderer directions={directions} options={{ polylineOptions: { strokeColor: C.green, strokeWeight: 4, strokeOpacity: 0.8 } }} />}
        {showDrivers && DRIVERS.map(d => <Marker key={d.id} position={d.position} icon={{ url: makeMarker("🚕", C.dark), scaledSize: new window.google.maps.Size(40, 40) }} />)}
      </GoogleMap>
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
          <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, fontSize: 18 }}>راكب</div><div style={{ fontSize: 13, opacity: 0.85 }}>أبحث عن سيارة أجرة</div></div>
        </button>
        <button onClick={() => onSelect("driver")} style={{ background: `linear-gradient(135deg,${C.orange},#ea580c)`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 40 }}>👨‍✈️</span>
          <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, fontSize: 18 }}>سائق</div><div style={{ fontSize: 13, opacity: 0.85 }}>أقدم خدمة النقل</div></div>
        </button>
      </div>
    </div>
  );
}

// ===== AUTH =====
function AuthForm({ role, onSuccess, onBack }) {
  const [mode, setMode] = useState("login"); // login | register | phone
  const [loginType, setLoginType] = useState("email"); // email | phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const accent = role === "driver" ? C.orange : C.green;
  const accentDark = role === "driver" ? "#ea580c" : C.greenDark;

  const handleEmail = async () => {
    if (!email || !password) { setError("أدخل البريد وكلمة المرور"); return; }
    setLoading(true); setError("");
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Save to Firestore
        await addDoc(collection(db, role === "driver" ? "drivers" : "passengers"), {
          uid: cred.user.uid, email, role,
          status: role === "driver" ? "pending" : "active",
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess(role);
    } catch (e) {
      const m = { "auth/email-already-in-use": "البريد مستخدم مسبقاً", "auth/wrong-password": "كلمة المرور خاطئة", "auth/user-not-found": "المستخدم غير موجود", "auth/weak-password": "كلمة المرور قصيرة جداً", "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة", "auth/network-request-failed": "تحقق من اتصالك بالإنترنت" };
      setError(m[e.code] || e.code || "حدث خطأ");
    }
    setLoading(false);
  };

  const handleSendOTP = async () => {
    if (!phone) { setError("أدخل رقم الهاتف"); return; }
    setLoading(true); setError("");
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      const fullPhone = phone.startsWith("+") ? phone : `+213${phone.replace(/^0/, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      setOtpStep(true);
    } catch (e) {
      setError("خطأ في إرسال الرمز — تأكد من رقم الهاتف");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp) { setError("أدخل رمز التحقق"); return; }
    setLoading(true); setError("");
    try {
      await confirmResult.confirm(otp);
      onSuccess(role);
    } catch { setError("رمز التحقق خاطئ"); }
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
        {/* Login type toggle */}
        <div style={{ background: "#e2ddd8", borderRadius: 14, padding: 4, display: "flex", marginBottom: 14 }}>
          {[{ id: "email", label: "📧 بريد إلكتروني" }, { id: "phone", label: "📱 هاتف" }].map(t => (
            <button key={t.id} onClick={() => { setLoginType(t.id); setError(""); setOtpStep(false); }} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: loginType === t.id ? C.card : "transparent", color: loginType === t.id ? C.text : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>{t.label}</button>
          ))}
        </div>

        {loginType === "email" && (
          <>
            <div style={{ background: "#e2ddd8", borderRadius: 14, padding: 4, display: "flex", marginBottom: 20 }}>
              {[{ id: "login", label: "دخول" }, { id: "register", label: "حساب جديد" }].map(m => (
                <button key={m.id} onClick={() => { setMode(m.id); setError(""); }} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: mode === m.id ? C.card : "transparent", color: mode === m.id ? C.text : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>{m.label}</button>
              ))}
            </div>
            <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
              {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
              <button onClick={handleEmail} disabled={loading} style={{ background: `linear-gradient(135deg,${accent},${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "جارٍ..." : mode === "register" ? "✅ إنشاء الحساب" : "🔑 تسجيل الدخول"}
              </button>
            </div>
          </>
        )}

        {loginType === "phone" && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 12 }}>
            {!otpStep ? (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 12px", fontSize: 14, color: C.textMuted, whiteSpace: "nowrap" }}>🇩🇿 +213</div>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xxxxxxxxx" type="tel" style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
                </div>
                <div id="recaptcha-container" />
                {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
                <button onClick={handleSendOTP} disabled={loading} style={{ background: `linear-gradient(135deg,${accent},${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "جارٍ الإرسال..." : "📱 إرسال رمز التحقق"}
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 36 }}>📲</div>
                  <div style={{ fontWeight: 700, color: C.text, marginTop: 8 }}>أدخل رمز التحقق</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>تم إرسال رمز SMS إلى {phone}</div>
                </div>
                <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="- - - - - -" maxLength={6} style={{ background: C.bg, border: `2px solid ${accent}`, borderRadius: 14, padding: "16px", fontFamily: "inherit", fontSize: 24, color: C.text, outline: "none", textAlign: "center", letterSpacing: 12, fontWeight: 800 }} />
                {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
                <button onClick={handleVerifyOTP} disabled={loading} style={{ background: `linear-gradient(135deg,${accent},${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                  {loading ? "جارٍ التحقق..." : "✅ تأكيد الرمز"}
                </button>
                <button onClick={() => setOtpStep(false)} style={{ background: "none", border: "none", color: C.textMuted, fontFamily: "inherit", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>إعادة إرسال الرمز</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== DRIVER REGISTRATION =====
function DriverRegistration({ user, onComplete }) {
  const [step, setStep] = useState(1); // 1=info, 2=selfie, 3=car
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carColor, setCarColor] = useState("");
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [carPhotoPreview, setCarPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const selfieRef = useRef(null);
  const carRef = useRef(null);

  const handlePhoto = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (type === "selfie") setSelfiePreview(ev.target.result);
      else setCarPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await addDoc(collection(db, "drivers"), {
        uid: user?.uid, name, phone, email: user?.email || "",
        carModel, carPlate, carColor,
        selfieUrl: selfiePreview || null,
        carPhotoUrl: carPhotoPreview || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch (e) { console.log(e); }
    setLoading(false);
    onComplete();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: C.dark, padding: "48px 24px 24px" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>توثيق حساب السائق</div>
        <div style={{ fontSize: 13, color: "#ffffff77" }}>الخطوة {step} من 3</div>
        <div style={{ marginTop: 12, height: 4, background: "#ffffff22", borderRadius: 4 }}>
          <div style={{ width: `${(step / 3) * 100}%`, height: "100%", background: C.orange, borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ padding: "24px 20px" }}>
        {step === 1 && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 4 }}>📋 معلوماتك الشخصية</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", textAlign: "right" }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الهاتف" type="tel" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
            <input value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="نوع السيارة (مثال: رونو سيمبول 2021)" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", textAlign: "right" }} />
            <input value={carPlate} onChange={e => setCarPlate(e.target.value)} placeholder="رقم اللوحة (مثال: 213-01-DZ)" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
            <input value={carColor} onChange={e => setCarColor(e.target.value)} placeholder="لون السيارة" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", textAlign: "right" }} />
            <button onClick={() => { if (name && phone && carModel && carPlate) setStep(2); }} style={{ background: name && phone && carModel && carPlate ? `linear-gradient(135deg,${C.orange},#ea580c)` : C.border, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              التالي ›
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>🤳 صورة سيلفي</div>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>التقط صورة واضحة لوجهك. تأكد من أن وجهك ظاهر بوضوح في الإضاءة الجيدة.</div>

            <div onClick={() => selfieRef.current?.click()} style={{ height: 200, background: selfiePreview ? "none" : C.bg, borderRadius: 16, border: `2px dashed ${selfiePreview ? C.green : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
              {selfiePreview ? <img src={selfiePreview} alt="selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontSize: 48 }}>🤳</div><div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>اضغط لالتقاط صورة</div></div>}
            </div>
            <input ref={selfieRef} type="file" accept="image/*" capture="user" onChange={e => handlePhoto(e, "selfie")} style={{ display: "none" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>‹ رجوع</button>
              <button onClick={() => { if (selfiePreview) setStep(3); }} style={{ flex: 2, background: selfiePreview ? `linear-gradient(135deg,${C.orange},#ea580c)` : C.border, border: "none", borderRadius: 14, padding: 14, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>التالي ›</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>🚗 صورة السيارة</div>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>التقط صورة للسيارة تظهر لونها ولوحة ترقيمها بوضوح.</div>

            <div onClick={() => carRef.current?.click()} style={{ height: 200, background: carPhotoPreview ? "none" : C.bg, borderRadius: 16, border: `2px dashed ${carPhotoPreview ? C.green : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
              {carPhotoPreview ? <img src={carPhotoPreview} alt="car" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center" }}><div style={{ fontSize: 48 }}>🚗</div><div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>اضغط لالتقاط صورة السيارة</div></div>}
            </div>
            <input ref={carRef} type="file" accept="image/*" capture="environment" onChange={e => handlePhoto(e, "car")} style={{ display: "none" }} />

            {carPhotoPreview && (
              <div style={{ background: C.greenLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.greenDark }}>
                ✅ تأكد أن لوحة الترقيم ({carPlate}) ظاهرة بوضوح في الصورة
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>‹ رجوع</button>
              <button onClick={handleSubmit} disabled={!carPhotoPreview || loading} style={{ flex: 2, background: carPhotoPreview ? `linear-gradient(135deg,${C.orange},#ea580c)` : C.border, border: "none", borderRadius: 14, padding: 14, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, opacity: loading ? 0.7 : 1 }}>
                {loading ? "جارٍ الإرسال..." : "✅ إرسال للمراجعة"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== DRIVER PENDING =====
function DriverPending({ onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
      <div style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 8 }}>طلبك قيد المراجعة</div>
      <div style={{ fontSize: 14, color: C.textMuted, textAlign: "center", lineHeight: 1.8, marginBottom: 32 }}>
        شكراً على تسجيلك! تتم مراجعة وثائقك من قِبل فريقنا.
        ستتلقى إشعاراً عند الموافقة على حسابك خلال 24 ساعة.
      </div>
      <div style={{ background: C.card, borderRadius: 20, padding: 20, width: "100%", boxShadow: C.shadow, marginBottom: 20 }}>
        {["✅ تم استلام طلبك", "🔍 جارٍ مراجعة وثائقك", "⏳ انتظار الموافقة"].map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? C.green : i === 1 ? C.orange : C.border }} />
            <span style={{ fontSize: 14, color: i === 2 ? C.textMuted : C.text }}>{s}</span>
          </div>
        ))}
      </div>
      <button onClick={onLogout} style={{ background: C.redLight, border: "none", borderRadius: 14, padding: "12px 24px", color: C.red, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🚪 تسجيل الخروج</button>
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
  const [distanceKm, setDistanceKm] = useState(0);
  const [myPrice, setMyPrice] = useState(MIN_PRICE);
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(null);
  const [drivers, setDrivers] = useState(DRIVERS.map(d => ({ ...d, status: "pending", offerPrice: null })));
  const [timer, setTimer] = useState(0);
  const [phase, setPhase] = useState(0);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [noDrivers, setNoDrivers] = useState(false);
  const originRef = useRef(null);
  const destRef = useRef(null);

  const currentType = RIDE_TYPES.find(t => t.id === rideType) || RIDE_TYPES[0];
  const base = calcPrice(distanceKm, currentType.multiplier);

  useEffect(() => { setMyPrice(base); }, [distanceKm, rideType]);

  useEffect(() => {
    if (screen !== "searching") return;
    const t = setInterval(() => setTimer(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [screen]);

  useEffect(() => {
    if (screen !== "searching") return;
    if (timer === 3) setPhase(1);
    if (timer === 5) setDrivers(p => p.map((d, i) => i === 0 ? { ...d, status: "accepted", offerPrice: booking?.price } : d));
    if (timer === 8) setDrivers(p => p.map((d, i) => i === 1 ? { ...d, status: "accepted", offerPrice: booking?.price } : d));
    if (timer === 12) setDrivers(p => p.map((d, i) => i === 2 ? { ...d, status: "accepted", offerPrice: booking?.price } : d));
    // If price is too low, no drivers accept
    if (timer === 15 && booking?.price < 150) setNoDrivers(true);
  }, [timer, screen, booking]);

  useEffect(() => {
    if (screen !== "ride" || done) return;
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [screen, done]);

  const handleGPS = () => {
    setGpsLoading(true);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const latlng = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        setOriginPlace(latlng);
        new window.google.maps.Geocoder().geocode({ location: latlng }, (results, status) => {
          setOriginText(status === "OK" && results[0] ? results[0].formatted_address : `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
          setGpsLoading(false);
        });
      },
      () => { setGpsLoading(false); alert("لم نتمكن من تحديد موقعك."); }
    );
  };

  const getRouteDistance = (origin, destination, cb) => {
    new window.google.maps.DistanceMatrixService().getDistanceMatrix(
      { origins: [origin], destinations: [destination], travelMode: "DRIVING" },
      (res, status) => {
        if (status === "OK") {
          const el = res.rows[0].elements[0];
          if (el.status === "OK") cb(el.distance.value / 1000, el.distance.text, el.duration.text);
        }
      }
    );
  };

  const onOriginChanged = () => {
    if (originRef.current) { const p = originRef.current.getPlace(); if (p?.geometry) { setOriginPlace(p.geometry.location); setOriginText(p.formatted_address || p.name); } }
  };
  const onDestChanged = () => {
    if (destRef.current) {
      const p = destRef.current.getPlace();
      if (p?.geometry) {
        setDestPlace(p.geometry.location);
        setDestText(p.formatted_address || p.name);
        if (originPlace) {
          getRouteDistance(originPlace, p.geometry.location, (km) => setDistanceKm(km));
        }
      }
    }
  };

  const startSearch = (price) => {
    setBooking({ originPlace, destPlace, originText, destText, rideType, price, distanceKm });
    setDrivers(DRIVERS.map(d => ({ ...d, status: "pending", offerPrice: null })));
    setTimer(0); setPhase(0); setNoDrivers(false);
    setScreen("searching");
  };

  // HOME
  if (screen === "home") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ padding: "48px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 13, color: C.textMuted }}>موقعك 📍</div><div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>الجزائر العاصمة</div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: C.textMuted }}>مرحباً</div><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{user?.email?.split("@")[0] || "مستخدم"}</div></div>
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
    </div>
  );

  // BOOKING
  if (screen === "booking") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "48px 20px 12px", gap: 12 }}>
        <button onClick={() => setScreen("home")} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>تفاصيل الرحلة</div>
      </div>
      <TaxiMap origin={originPlace} destination={destPlace} showDrivers={false} />

      {distanceKm > 0 && (
        <div style={{ display: "flex", gap: 8, margin: "10px 20px 0", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ background: C.greenLight, borderRadius: 20, padding: "6px 14px", fontSize: 13, color: C.greenDark, fontWeight: 700 }}>📏 {distanceKm.toFixed(1)} كم</div>
          <div style={{ background: C.orangeLight, borderRadius: 20, padding: "6px 14px", fontSize: 13, color: C.orange, fontWeight: 700 }}>💰 {base} دج</div>
        </div>
      )}

      <div style={{ margin: "14px 20px", background: C.card, borderRadius: 24, padding: 20, boxShadow: C.shadow }}>
        <button onClick={handleGPS} disabled={gpsLoading} style={{ width: "100%", background: gpsLoading ? C.border : C.greenLight, border: `1px solid ${C.green}44`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", marginBottom: 12, fontFamily: "inherit", fontWeight: 700, fontSize: 14, color: gpsLoading ? C.textMuted : C.greenDark }}>
          <span style={{ fontSize: 18 }}>📍</span>
          {gpsLoading ? "جارٍ تحديد موقعك..." : "استخدم موقعي الحالي كنقطة انطلاق"}
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div style={{ background: C.greenLight, borderRadius: 14, padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
            <Autocomplete onLoad={ac => originRef.current = ac} onPlaceChanged={onOriginChanged} options={{ componentRestrictions: { country: "dz" } }}>
              <input value={originText} onChange={e => setOriginText(e.target.value)} placeholder="نقطة الانطلاق..." style={{ background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: C.text, width: "100%", textAlign: "right" }} />
            </Autocomplete>
          </div>
          <div style={{ background: C.orangeLight, borderRadius: 14, padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange, flexShrink: 0 }} />
            <Autocomplete onLoad={ac => destRef.current = ac} onPlaceChanged={onDestChanged} options={{ componentRestrictions: { country: "dz" } }}>
              <input value={destText} onChange={e => setDestText(e.target.value)} placeholder="إلى أين؟ مثال: حيدرة..." style={{ background: "none", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: C.text, width: "100%", textAlign: "right" }} />
            </Autocomplete>
          </div>
        </div>

        <div style={{ fontWeight: 700, marginBottom: 10, color: C.text }}>نوع السيارة</div>
        {RIDE_TYPES.map(t => {
          const price = calcPrice(distanceKm, t.multiplier);
          return (
            <div key={t.id} onClick={() => setRideType(t.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 14, border: `2px solid ${rideType === t.id ? C.green : C.border}`, background: rideType === t.id ? C.greenLight : C.bg, cursor: "pointer", marginBottom: 8, transition: "all 0.2s" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <div><div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{t.label}</div><div style={{ fontSize: 11, color: C.textMuted }}>⏱ {t.time}</div></div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: rideType === t.id ? C.greenDark : C.text }}>{price} دج</div>
              </div>
            </div>
          );
        })}

        <button onClick={() => { if (originPlace && destPlace) setScreen("negotiate"); }} style={{ width: "100%", marginTop: 8, background: originPlace && destPlace ? `linear-gradient(135deg,${C.green},${C.greenDark})` : C.border, border: "none", borderRadius: 16, padding: 16, color: originPlace && destPlace ? "#fff" : C.textMuted, fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: originPlace && destPlace ? "pointer" : "default" }}>
          {originPlace && destPlace ? `التالي: اقتراح السعر (${base} دج) 💰` : "اختر نقطة الانطلاق والوجهة"}
        </button>
      </div>
    </div>
  );

  // NEGOTIATE
  if (screen === "negotiate") {
    const maxAllowed = Math.round(base * 2);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "48px 20px 16px", gap: 12 }}>
          <button onClick={() => setScreen("booking")} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>اقتراح السعر 💰</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{distanceKm.toFixed(1)} كم · {currentType.label}</div>
          </div>
        </div>

        <div style={{ margin: "0 20px 14px", background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>السعر المقترح بناءً على المسافة</div>
          <div style={{ fontSize: 64, fontWeight: 900, color: myPrice === base ? C.green : myPrice < base ? C.orange : C.blue, lineHeight: 1 }}>{myPrice}</div>
          <div style={{ fontSize: 18, color: C.textMuted, marginBottom: 20 }}>دينار جزائري</div>

          <input type="range" min={MIN_PRICE} max={maxAllowed} step={10} value={myPrice}
            onChange={e => setMyPrice(Number(e.target.value))}
            style={{ width: "100%", accentColor: C.green, cursor: "pointer", marginBottom: 8, height: 6 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textLight }}>
            <span>{MIN_PRICE} دج</span>
            <span style={{ color: C.green, fontWeight: 700 }}>محسوب: {base} دج</span>
            <span>{maxAllowed} دج</span>
          </div>
        </div>

        <div style={{ margin: "0 20px 14px", background: C.card, borderRadius: 20, padding: 18, boxShadow: C.shadow }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 10 }}>اقتراحات</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "الحد الأدنى", value: MIN_PRICE, color: C.blue },
              { label: "السعر المحسوب ⭐", value: base, color: C.green },
              { label: "زيادة 20%", value: Math.round(base * 1.2), color: C.orange },
            ].map((s, i) => (
              <button key={i} onClick={() => setMyPrice(s.value)} style={{ flex: 1, minWidth: "30%", padding: "10px 6px", borderRadius: 12, border: `2px solid ${myPrice === s.value ? s.color : C.border}`, background: myPrice === s.value ? s.color + "15" : C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: myPrice === s.value ? s.color : C.text }}>{s.value} دج</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ margin: "0 20px 14px", background: C.card, borderRadius: 20, padding: 16, boxShadow: C.shadow }}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="رسالة للسائق (اختياري)..." style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, resize: "none", outline: "none", height: 60, direction: "rtl" }} />
        </div>

        <div style={{ margin: "0 20px" }}>
          <button onClick={() => startSearch(myPrice)} style={{ width: "100%", background: `linear-gradient(135deg,${C.dark},#2d1b69)`, border: "none", borderRadius: 16, padding: 18, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer" }}>
            🚀 إرسال العرض للسائقين — {myPrice} دج
          </button>
        </div>
      </div>
    );
  }

  // SEARCHING
  if (screen === "searching") return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: 40 }}>
      <TaxiMap origin={booking?.originPlace} destination={booking?.destPlace} showDrivers={true} />
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{phase === 0 ? "📡 يتم إرسال عرضك للسائقين..." : "📨 ردود السائقين"}</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>عرضك: {booking?.price} دج · {booking?.distanceKm?.toFixed(1)} كم · ⏱ {timer}ث</div>
      </div>

      {phase === 0 && (
        <div style={{ margin: "20px auto", width: 100, height: 100, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ position: "absolute", width: 30+i*25, height: 30+i*25, borderRadius: "50%", border: `2px solid ${C.green}`, animation: "pg 1.5s ease-out infinite", animationDelay: `${i*0.4}s` }} />)}
          <div style={{ fontSize: 32, zIndex: 1 }}>🚕</div>
          <style>{`@keyframes pg{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(1.5);opacity:0}}`}</style>
        </div>
      )}

      {/* No drivers alert */}
      {noDrivers && (
        <div style={{ margin: "14px 20px", background: C.orangeLight, borderRadius: 20, padding: 20, border: `1px solid ${C.orange}44`, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>😔</div>
          <div style={{ fontWeight: 700, color: C.orange, marginBottom: 8 }}>لم يقبل أي سائق عرضك</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>السعر منخفض — جرّب زيادة العرض لجذب السائقين</div>
          <button onClick={() => { setScreen("negotiate"); setMyPrice(Math.round(booking.price * 1.2)); }}
            style={{ background: `linear-gradient(135deg,${C.orange},#ea580c)`, border: "none", borderRadius: 14, padding: "12px 24px", color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
            💰 زيادة العرض ({Math.round(booking.price * 1.2)} دج)
          </button>
        </div>
      )}

      {phase === 1 && !noDrivers && (
        <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {drivers.map(d => (
            <div key={d.id} style={{ background: C.card, borderRadius: 18, padding: 16, boxShadow: C.shadow, border: d.status === "accepted" ? `2px solid ${C.green}` : `1px solid ${C.border}`, opacity: d.status === "pending" ? 0.5 : 1, transition: "all 0.4s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.avatar}</div>
                  <div><div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{d.name}</div><div style={{ fontSize: 12, color: C.textMuted }}>⭐ {d.rating} · {d.car}</div></div>
                </div>
                <div>
                  {d.status === "pending" && <span style={{ color: C.textLight, fontSize: 12 }}>ينتظر...</span>}
                  {d.status === "accepted" && <div style={{ fontWeight: 900, fontSize: 18, color: C.green }}>{d.offerPrice} دج ✅</div>}
                </div>
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

  // FOUND
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
              <div style={{ fontSize: 11, color: C.blue }}>دقائق للوصول</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.dark, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#ffffff88", marginBottom: 6 }}>رمز التحقق — أعطه للسائق</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: 8 }}>4782</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setScreen("home")} style={{ flex: 1, background: C.redLight, border: "none", borderRadius: 12, padding: 14, color: C.red, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>❌ إلغاء</button>
          <button onClick={() => { setElapsed(0); setDone(false); setScreen("ride"); }} style={{ flex: 2, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 12, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}>📱 تتبع الرحلة</button>
        </div>
      </div>
    </div>
  );

  // RIDE
  if (screen === "ride") {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (done) return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <div style={{ fontSize: 64 }}>🏁</div>
        <div style={{ fontWeight: 900, fontSize: 24, color: C.text }}>وصلت بسلام!</div>
        <div style={{ background: C.card, borderRadius: 24, padding: 24, width: "100%", boxShadow: C.shadow, textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: C.text }}>قيّم رحلتك مع {selectedDriver?.name}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
            {[1,2,3,4,5].map(s => <div key={s} onClick={() => setRating(s)} style={{ fontSize: 34, cursor: "pointer", opacity: s <= rating ? 1 : 0.25, transition: "all 0.2s" }}>⭐</div>)}
          </div>
          <div style={{ background: C.greenLight, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.greenDark }}>{selectedDriver?.offerPrice} دج</div>
            <div style={{ fontSize: 13, color: C.green }}>المبلغ المدفوع</div>
          </div>
          <button onClick={() => { setScreen("home"); setRating(0); setDistanceKm(0); }} style={{ width: "100%", background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>✅ إنهاء وتقييم</button>
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
    { id: 1, name: "أحمد سليم", from: "باب الزوار", to: "حيدرة", offer: 280, km: 9.3, avatar: "👨" },
    { id: 2, name: "نور الهدى", from: "القبة", to: "المطار", offer: 630, km: 21, avatar: "👩" },
  ]);
  const stats = [
    { label: "أرباح اليوم", value: "4,550 دج", icon: "💰", color: C.green },
    { label: "رحلات اليوم", value: "3", icon: "🚕", color: C.blue },
    { label: "التقييم", value: "4.9 ⭐", icon: "🏆", color: C.yellow },
    { label: "معدل القبول", value: "94%", icon: "📊", color: C.orange },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: "#1a1d27", padding: "48px 20px 20px", borderBottom: "1px solid #2a2d3e" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg,${C.orange},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👨‍✈️</div>
            <div><div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>كريم بن علي</div><div style={{ fontSize: 12, color: "#94a3b8" }}>⭐ 4.9 · رونو سيمبول 2021</div></div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2a2d3e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{r.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{r.from} ← {r.to} · {r.km} كم</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>{r.offer} دج</div>
                        <div style={{ fontSize: 11, color: r.offer >= calcPrice(r.km) ? C.green : C.red }}>
                          {r.offer >= calcPrice(r.km) ? "✅ مقبول" : "⚠️ أقل من المعيار"}
                        </div>
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
                <button onClick={() => setOnline(true)} style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: "14px 32px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>🟢 تفعيل الاتصال</button>
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

// ===== MAIN =====
export default function App() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || "",
    libraries: LIBRARIES, language: "ar", region: "DZ",
  });

  const [screen, setScreen] = useState("welcome");
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [driverStatus, setDriverStatus] = useState(null); // null | pending | approved | needsReg

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        // Restore session
        const savedRole = localStorage.getItem("taxidz_role");
        if (savedRole) {
          setRole(savedRole);
          setScreen("app");
        }
      } else {
        setUser(null);
        setRole(null);
        setScreen("welcome");
        localStorage.removeItem("taxidz_role");
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    if (auth) { try { await signOut(auth); } catch(e) {} }
    setUser(null); setRole(null); setScreen("welcome");
    localStorage.removeItem("taxidz_role");
  };

  const handleAuthSuccess = (selectedRole) => {
    setRole(selectedRole);
    localStorage.setItem("taxidz_role", selectedRole);
    if (selectedRole === "driver") {
      setDriverStatus("needsReg");
      setScreen("driver_reg");
    } else {
      setScreen("app");
    }
  };

  if (loadError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>خطأ في تحميل الخريطة</div>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'Cairo',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontWeight: 700, color: C.text }}>جارٍ تحميل التطبيق...</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      {screen === "welcome" && <WelcomeScreen onSelect={r => { setRole(r); setScreen("auth"); }} />}
      {screen === "auth" && <AuthForm role={role} onSuccess={handleAuthSuccess} onBack={() => { setRole(null); setScreen("welcome"); }} />}
      {screen === "driver_reg" && <DriverRegistration user={user} onComplete={() => setScreen("driver_pending")} />}
      {screen === "driver_pending" && <DriverPending onLogout={handleLogout} />}
      {screen === "app" && role === "passenger" && <PassengerApp onLogout={handleLogout} user={user} />}
      {screen === "app" && role === "driver" && <DriverDashboard onLogout={handleLogout} />}
    </div>
  );
}
