import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, requestNotificationPermission, onForegroundMessage } from "./firebase";
import {
  RecaptchaVerifier, signInWithPhoneNumber, signOut,
  onAuthStateChanged, updateProfile
} from "firebase/auth";
import {
  doc, setDoc, getDoc, serverTimestamp, addDoc, collection,
  onSnapshot, updateDoc, getDocs, query, where, orderBy, limit
} from "firebase/firestore";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Autocomplete } from "@react-google-maps/api";
import DriverDashboard from "./DriverDashboard";

const LIBRARIES = ["places"];
const ALGERIA_CENTER = { lat: 36.737, lng: 3.086 };
const PRICE_PER_KM = 30;
const BASE_PRICE = 40;
const MIN_PRICE = 100;

const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

const calcPrice = (km, multiplier=1.0) => {
  if (!km||km<=0) return MIN_PRICE;
  const price = Math.round((BASE_PRICE+km*PRICE_PER_KM)*multiplier);
  return km<2 ? Math.max(price,MIN_PRICE) : price;
};

const getLatLng = (place) => {
  if (!place) return { lat:0, lng:0 };
  return { lat: typeof place.lat==="function"?place.lat():place.lat, lng: typeof place.lng==="function"?place.lng():place.lng };
};

const openNavigation = (destLat, destLng) => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving&dir_action=navigate`, "_blank");
};

// إرسال إشعار FCM عبر Firebase REST API
const sendFCMNotification = async (tokens, title, body, data={}) => {
  if (!tokens||tokens.length===0) return;
  // نرسل لكل token
  for (const token of tokens) {
    try {
      await fetch(`https://fcm.googleapis.com/v1/projects/taxi-dz-ee993/messages:send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // نستخدم Firestore Cloud Function أو Server Key
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)])),
            android: { priority: "high", notification: { sound: "default", channel_id: "taxidz" } },
            webpush: { notification: { icon: "/logo192.png", badge: "/logo192.png", requireInteraction: true, vibrate: [200,100,200] } },
          }
        }),
      });
    } catch(e) { console.log("FCM send:", e); }
  }
};

const MAP_STYLE = [
  { featureType:"all", elementType:"geometry", stylers:[{color:"#f5f0eb"}] },
  { featureType:"road", elementType:"geometry", stylers:[{color:"#ffffff"}] },
  { featureType:"road.arterial", elementType:"geometry", stylers:[{color:"#ffe0c2"}] },
  { featureType:"road.highway", elementType:"geometry", stylers:[{color:"#ffb347"}] },
  { featureType:"water", elementType:"geometry", stylers:[{color:"#aad3df"}] },
  { featureType:"poi.park", elementType:"geometry", stylers:[{color:"#c8e6c9"}] },
];

const C = {
  bg:"#f7f3ee", card:"#ffffff", dark:"#1a1a2e",
  green:"#00b37e", greenLight:"#e6f9f3", greenDark:"#007a55",
  orange:"#f97316", orangeLight:"#fff4ed",
  red:"#ef4444", redLight:"#fef2f2",
  blue:"#3b82f6", blueLight:"#eff6ff",
  yellow:"#f59e0b", yellowLight:"#fef9c3",
  purple:"#8b5cf6",
  googleBlue:"#1a73e8",
  text:"#1a1a2e", textMuted:"#64748b", textLight:"#94a3b8",
  border:"#e8e3db", shadow:"0 4px 24px rgba(0,0,0,0.08)",
};

const RIDE_TYPES = [
  { id:"economy", label:"اقتصادي", icon:"🚗", multiplier:1.0, time:"3 دق" },
  { id:"comfort", label:"مريح", icon:"🚙", multiplier:1.4, time:"5 دق" },
  { id:"xl", label:"XL كبير", icon:"🚐", multiplier:1.8, time:"7 دق" },
];

// ===== FCM NOTIFICATION TOAST =====
function NotificationToast({ notification, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return ()=>clearTimeout(t); }, [onClose]);
  if (!notification) return null;
  return (
    <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", width:"calc(100% - 40px)", maxWidth:370, background:C.dark, borderRadius:16, padding:"14px 18px", boxShadow:"0 8px 32px rgba(0,0,0,0.3)", zIndex:9999, direction:"rtl", display:"flex", gap:12, alignItems:"center", animation:"slideDown 0.3s ease", border:`1px solid ${C.green}44` }}>
      <div style={{ fontSize:28 }}>🔔</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:800, fontSize:14, color:C.text, fontFamily:"'Cairo',sans-serif" }}>{notification.title}</div>
        <div style={{ fontSize:12, color:C.textMuted, fontFamily:"'Cairo',sans-serif", marginTop:2 }}>{notification.body}</div>
      </div>
      <button onClick={onClose} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer", fontSize:18 }}>✕</button>
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

// ===== OTP AUTH =====
function OTPAuth({ role, onSuccess, onBack }) {
  const [step, setStep] = useState("phone"); // phone | otp | name
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [name, setName] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];
  const recaptchaRef = useRef(null);
  const isPassenger = role === "passenger";
  const accent = isPassenger ? C.green : C.orange;

  // عداد إعادة الإرسال
  useEffect(() => {
    if (resendTimer<=0) return;
    const t = setInterval(()=>setResendTimer(p=>p-1),1000);
    return ()=>clearInterval(t);
  }, [resendTimer]);

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g,"");
    if (digits.length<9) { setError("أدخل رقم هاتف صحيح (9 أرقام على الأقل)"); return; }
    setLoading(true); setError("");
    try {
      // تنظيف القديم
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(x) {}
        window.recaptchaVerifier = null;
      }
      // إنشاء reCAPTCHA جديد
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "normal",
        callback: async () => {
          // تم التحقق — أرسل OTP
        },
        "expired-callback": () => {
          setError("انتهت صلاحية التحقق — أعد المحاولة");
          if (window.recaptchaVerifier) { try{window.recaptchaVerifier.clear();}catch(x){} window.recaptchaVerifier = null; }
        },
      });
      await window.recaptchaVerifier.render();
      const fullPhone = `+213${digits.replace(/^0/,"")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      setStep("otp");
      setResendTimer(60);
      otpRefs[0].current?.focus();
    } catch(e) {
      console.log("OTP Error:", e.code, e.message);
      if (window.recaptchaVerifier) { try{window.recaptchaVerifier.clear();}catch(x){} window.recaptchaVerifier = null; }
      const msgs = {
        "auth/invalid-phone-number": "رقم الهاتف غير صحيح",
        "auth/too-many-requests": "طلبات كثيرة — انتظر قليلاً ثم أعد المحاولة",
        "auth/captcha-check-failed": "خطأ في التحقق — أعد المحاولة",
        "auth/network-request-failed": "تحقق من اتصالك بالإنترنت",
        "auth/quota-exceeded": "تم تجاوز الحد اليومي — حاول غداً",
        "auth/missing-phone-number": "أدخل رقم الهاتف",
        "auth/invalid-app-credential": "خطأ في الإعداد — تحقق من Firebase",
      };
      setError(msgs[e.code] || `خطأ: ${e.code||e.message}`);
    }
    setLoading(false);
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val.slice(-1);
    setOtp(newOtp);
    if (val && i<5) otpRefs[i+1].current?.focus();
    if (!val && i>0) otpRefs[i-1].current?.focus();
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if (paste.length===6) {
      setOtp(paste.split(""));
      otpRefs[5].current?.focus();
    }
  };

  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length<6) { setError("أدخل رمز التحقق كاملاً (6 أرقام)"); return; }
    setLoading(true); setError("");
    try {
      await confirmResult.confirm(code);
      if (!isPassenger) { onSuccess(role); return; }
      setStep("name");
    } catch(e) {
      console.log("Verify error:", e);
      setError("رمز التحقق خاطئ أو منتهي الصلاحية");
      setOtp(["","","","","",""]);
      otpRefs[0].current?.focus();
    }
    setLoading(false);
  };

  const saveName = async () => {
    if (!name.trim()) { setError("أدخل اسمك الكامل"); return; }
    setLoading(true);
    try {
      const u = auth.currentUser;
      await updateProfile(u, { displayName: name });
      const phoneFormatted = `+213${phone.replace(/\D/g,"").replace(/^0/,"")}`;
      // حفظ أو تحديث بيانات الراكب
      await setDoc(doc(db, "passengers", u.uid), {
        uid: u.uid, name, phone: phoneFormatted,
        role: "passenger", status: "active",
        rating: 0, totalRatings: 0, totalRides: 0,
        createdAt: serverTimestamp(),
      }, { merge: true });
      localStorage.setItem("taxidz_phone", phoneFormatted);
      localStorage.setItem("taxidz_name", name);
      // طلب إذن الإشعارات
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) await setDoc(doc(db,"passengers",u.uid),{ fcmToken },{ merge:true });
      onSuccess("passenger");
    } catch(e) { setError("خطأ في الحفظ — حاول مرة أخرى"); }
    setLoading(false);
  };

  const resendOTP = async () => {
    if (resendTimer>0) return;
    setOtp(["","","","","",""]); setError("");
    window.recaptchaVerifier = null;
    setStep("phone");
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.dark},#16213e)`, padding:"48px 24px 32px", position:"relative" }}>
        <button onClick={onBack} style={{ position:"absolute", top:48, right:20, width:36, height:36, borderRadius:10, background:"#ffffff22", border:"none", color:"#fff", cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:8 }}>{isPassenger?"🧑":"👨‍✈️"}</div>
          <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{isPassenger?"بوابة الراكب":"بوابة السائق"}</div>
          <div style={{ fontSize:13, color:"#ffffff66", marginTop:4 }}>
            {step==="phone"?"أدخل رقم هاتفك":step==="otp"?"أدخل رمز التحقق":"أدخل اسمك"}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ height:3, background:C.border }}>
        <div style={{ height:"100%", background:accent, width:step==="phone"?"33%":step==="otp"?"66%":"100%", transition:"width 0.4s ease", borderRadius:"0 4px 4px 0" }} />
      </div>

      {/* reCAPTCHA يظهر هنا */}
    <div id="recaptcha-container" style={{ display:"flex", justifyContent:"center", marginBottom:16 }} />

      <div style={{ padding:"32px 20px" }}>

        {/* STEP 1: الهاتف */}
        {step==="phone" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:56, marginBottom:10 }}>📱</div>
              <div style={{ fontWeight:800, fontSize:20, color:C.text }}>رقم هاتفك</div>
              <div style={{ fontSize:13, color:C.textMuted, marginTop:6, lineHeight:1.6 }}>
                سيصلك رمز تحقق SMS للتأكد من ملكيتك للرقم
              </div>
            </div>

            <div style={{ background:C.card, borderRadius:20, padding:20, boxShadow:C.shadow }}>
              <div style={{ fontSize:12, color:C.textMuted, marginBottom:8, fontWeight:600 }}>رقم الهاتف الجزائري</div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <div style={{ background:C.greenLight, border:`1px solid ${C.green}44`, borderRadius:14, padding:"14px 12px", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
                  <span style={{ fontSize:18 }}>🇩🇿</span>
                  <span style={{ fontSize:14, color:C.greenDark, fontWeight:700 }}>+213</span>
                </div>
                <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))}
                  placeholder="0XXXXXXXXX" type="tel" maxLength={10}
                  style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", fontFamily:"inherit", fontSize:18, color:C.text, outline:"none", direction:"ltr", textAlign:"center", fontWeight:700, letterSpacing:2 }} />
              </div>
              <div style={{ background:`${accent}15`, borderRadius:12, padding:"10px 14px", marginBottom:16, border:`1px solid ${accent}33` }}>
                <div style={{ fontSize:12, color:C.textMuted }}>📌 {isPassenger?"رقمك سيظهر للسائق للتواصل المباشر":"رقمك للتحقق من هويتك كسائق"}</div>
              </div>
              {error && <div style={{ background:C.redLight, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.red, textAlign:"center", marginBottom:12 }}>{error}</div>}
              <button onClick={sendOTP} disabled={loading||phone.replace(/\D/g,"").length<9}
                style={{ width:"100%", background:phone.replace(/\D/g,"").length>=9?`linear-gradient(135deg,${accent},${isPassenger?C.greenDark:"#ea580c"})`:C.border, border:"none", borderRadius:16, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:phone.replace(/\D/g,"").length>=9?"pointer":"default", opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {loading?<><span style={{ width:18,height:18,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />جارٍ الإرسال...</>:"📨 إرسال رمز التحقق"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: OTP */}
        {step==="otp" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:56, marginBottom:10 }}>💬</div>
              <div style={{ fontWeight:800, fontSize:20, color:C.text }}>رمز التحقق</div>
              <div style={{ fontSize:13, color:C.textMuted, marginTop:6 }}>
                أُرسل رمز SMS إلى <span style={{ color:C.text, fontWeight:700, direction:"ltr", display:"inline-block" }}>+213{phone.replace(/\D/g,"").replace(/^0/,"")}</span>
              </div>
            </div>

            <div style={{ background:C.card, borderRadius:20, padding:20, boxShadow:C.shadow }}>
              {/* OTP Inputs */}
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:20 }} onPaste={handleOtpPaste}>
                {otp.map((digit,i)=>(
                  <input key={i} ref={otpRefs[i]} value={digit}
                    onChange={e=>handleOtpChange(i,e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Backspace"&&!digit&&i>0) otpRefs[i-1].current?.focus(); }}
                    maxLength={1} type="tel" inputMode="numeric"
                    style={{ width:48, height:60, textAlign:"center", fontSize:26, fontWeight:900, fontFamily:"monospace", background:digit?`${accent}15`:C.bg, border:`2px solid ${digit?accent:C.border}`, borderRadius:14, color:C.text, outline:"none", transition:"all 0.2s" }} />
                ))}
              </div>

              {error && <div style={{ background:C.redLight, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.red, textAlign:"center", marginBottom:12 }}>{error}</div>}

              <button onClick={verifyOTP} disabled={loading||otp.join("").length<6}
                style={{ width:"100%", background:otp.join("").length===6?`linear-gradient(135deg,${accent},${isPassenger?C.greenDark:"#ea580c"})`:C.border, border:"none", borderRadius:16, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:otp.join("").length===6?"pointer":"default", opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:12 }}>
                {loading?<><span style={{ width:18,height:18,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />جارٍ التحقق...</>:"✅ تأكيد الرمز"}
              </button>

              {/* إعادة الإرسال */}
              <div style={{ textAlign:"center" }}>
                {resendTimer>0 ? (
                  <div style={{ fontSize:13, color:C.textMuted }}>
                    إعادة الإرسال بعد <span style={{ color:accent, fontWeight:700 }}>{resendTimer}ث</span>
                  </div>
                ) : (
                  <button onClick={resendOTP} style={{ background:"none", border:"none", color:accent, fontFamily:"inherit", fontSize:13, cursor:"pointer", fontWeight:700, textDecoration:"underline" }}>
                    🔄 إعادة إرسال الرمز
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: الاسم (للراكب فقط) */}
        {step==="name" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:56, marginBottom:10 }}>👤</div>
              <div style={{ fontWeight:800, fontSize:20, color:C.text }}>اسمك الكامل</div>
              <div style={{ fontSize:13, color:C.textMuted, marginTop:6 }}>سيظهر اسمك للسائق عند قبول رحلتك</div>
            </div>
            <div style={{ background:C.card, borderRadius:20, padding:20, boxShadow:C.shadow }}>
              <input value={name} onChange={e=>setName(e.target.value)}
                placeholder="أدخل اسمك الكامل" autoFocus
                style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px", fontFamily:"inherit", fontSize:16, color:C.text, outline:"none", textAlign:"right", marginBottom:16 }} />
              {error && <div style={{ background:C.redLight, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.red, textAlign:"center", marginBottom:12 }}>{error}</div>}
              <button onClick={saveName} disabled={loading||!name.trim()}
                style={{ width:"100%", background:name.trim()?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border, border:"none", borderRadius:16, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:name.trim()?"pointer":"default", opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {loading?<><span style={{ width:18,height:18,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />جارٍ الحفظ...</>:"🚀 ابدأ رحلتك!"}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ===== WELCOME =====
function WelcomeScreen({ onSelect }) {
  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg,${C.dark} 0%,#16213e 50%,#0f3460 100%)`, fontFamily:"'Cairo',sans-serif", direction:"rtl", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontSize:80, marginBottom:8, filter:"drop-shadow(0 8px 24px rgba(249,115,22,0.5))" }}>🚕</div>
      <div style={{ fontSize:36, fontWeight:900, color:"#fff", marginBottom:4 }}>TaxiDZ</div>
      <div style={{ fontSize:14, color:"#ffffff66", marginBottom:4 }}>تاكسي الجزائر 🇩🇿</div>
      <div style={{ fontSize:12, color:"#ffffff44", marginBottom:48, background:"#ffffff0d", padding:"6px 16px", borderRadius:20, border:"1px solid #ffffff1a" }}>40 دج + 30 دج/كم · فاوض على سعرك</div>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:14 }}>
        <button onClick={()=>onSelect("passenger")} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:20, padding:"20px 24px", color:"#fff", fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:16, boxShadow:"0 8px 24px rgba(0,179,126,0.35)" }}>
          <span style={{ fontSize:44 }}>🧑</span>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:800, fontSize:18 }}>راكب</div><div style={{ fontSize:13, opacity:0.85 }}>أبحث عن سيارة أجرة</div></div>
        </button>
        <button onClick={()=>onSelect("driver")} style={{ background:`linear-gradient(135deg,${C.orange},#ea580c)`, border:"none", borderRadius:20, padding:"20px 24px", color:"#fff", fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:16, boxShadow:"0 8px 24px rgba(249,115,22,0.35)" }}>
          <span style={{ fontSize:44 }}>👨‍✈️</span>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:800, fontSize:18 }}>سائق</div><div style={{ fontSize:13, opacity:0.85 }}>أقدم خدمة النقل</div></div>
        </button>
      </div>
    </div>
  );
}

// ===== TRACKING MAP =====
function PassengerTrackingMap({ passengerLocation, driverLocation, destinationLocation, mode="pickup", height=240 }) {
  const [directions, setDirections] = useState(null);
  const mapRef = useRef(null);
  const makeMarker = (emoji,color) => "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><circle cx='22' cy='22' r='20' fill='${color}' stroke='white' stroke-width='3'/><text x='22' y='29' text-anchor='middle' font-size='20'>${emoji}</text></svg>`);
  const target = mode==="pickup"?passengerLocation:destinationLocation;
  useEffect(()=>{ if(!driverLocation||!target||!window.google){setDirections(null);return;} new window.google.maps.DirectionsService().route({origin:driverLocation,destination:target,travelMode:"DRIVING"},(r,s)=>{if(s==="OK")setDirections(r);}); },[driverLocation,target]);
  useEffect(()=>{ if(driverLocation&&mapRef.current) mapRef.current.panTo(driverLocation); },[driverLocation]);
  return (
    <div style={{ margin:"0 20px", borderRadius:20, overflow:"hidden", position:"relative" }}>
      <GoogleMap mapContainerStyle={{ width:"100%", height:`${height}px` }} center={driverLocation||passengerLocation||ALGERIA_CENTER} zoom={15} onLoad={m=>mapRef.current=m} options={{ styles:MAP_STYLE, disableDefaultUI:true, zoomControl:true }}>
        {passengerLocation&&<Marker position={passengerLocation} icon={{ url:makeMarker("📍",C.green), scaledSize:new window.google.maps.Size(44,44) }} />}
        {driverLocation&&<Marker position={driverLocation} icon={{ url:makeMarker("🚕",C.orange), scaledSize:new window.google.maps.Size(44,44) }} />}
        {destinationLocation&&mode==="ride"&&<Marker position={destinationLocation} icon={{ url:makeMarker("🏁",C.blue), scaledSize:new window.google.maps.Size(44,44) }} />}
        {directions&&<DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:C.orange, strokeWeight:5, strokeOpacity:0.85 }, suppressMarkers:true }} />}
      </GoogleMap>
      <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.75)", borderRadius:20, padding:"6px 14px", display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ width:8,height:8,borderRadius:"50%",background:C.green,animation:"gpulse 1.5s infinite" }} />
        <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>{mode==="pickup"?"السائق قادم 🚕":"رحلة جارية 🏎️"}</span>
      </div>
      <style>{`@keyframes gpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.4)}}`}</style>
    </div>
  );
}

function TaxiMap({ origin, destination, showDrivers, height=220 }) {
  const [directions, setDirections] = useState(null);
  const [userLocation, setUserLocation] = useState(ALGERIA_CENTER);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const mapRef = useRef(null);
  useEffect(()=>{ navigator.geolocation?.getCurrentPosition(p=>setUserLocation({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{}); },[]);
  useEffect(()=>{ if(!showDrivers) return; const u=onSnapshot(collection(db,"drivers"),s=>setNearbyDrivers(s.docs.filter(d=>d.data().isOnline&&d.data().verificationStatus==="approved"&&d.data().location).map(d=>({id:d.id,...d.data()})))); return()=>u(); },[showDrivers]);
  useEffect(()=>{ if(!origin||!destination){setDirections(null);return;} new window.google.maps.DirectionsService().route({origin,destination,travelMode:"DRIVING"},(r,s)=>{if(s==="OK")setDirections(r);}); },[origin,destination]);
  const onLoad = useCallback(m=>{mapRef.current=m;},[]);
  const makeMarker=(emoji,color)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='${color}' stroke='white' stroke-width='3'/><text x='20' y='27' text-anchor='middle' font-size='18'>${emoji}</text></svg>`);
  return (
    <div style={{ margin:"0 20px", borderRadius:20, overflow:"hidden" }}>
      <GoogleMap mapContainerStyle={{ width:"100%", height:`${height}px` }} center={origin||userLocation} zoom={13} onLoad={onLoad} options={{ styles:MAP_STYLE, disableDefaultUI:true, zoomControl:true }}>
        {!origin&&<Marker position={userLocation} />}
        {origin&&!directions&&<Marker position={origin} icon={{ url:makeMarker("📍",C.green), scaledSize:new window.google.maps.Size(40,40) }} />}
        {destination&&!directions&&<Marker position={destination} icon={{ url:makeMarker("🏁",C.orange), scaledSize:new window.google.maps.Size(40,40) }} />}
        {directions&&<DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:C.green, strokeWeight:4, strokeOpacity:0.8 } }} />}
        {showDrivers&&nearbyDrivers.map(d=><Marker key={d.id} position={d.location} icon={{ url:makeMarker("🚕",C.dark), scaledSize:new window.google.maps.Size(40,40) }} />)}
      </GoogleMap>
    </div>
  );
}

function BackBtn({ onBack }) {
  return <button onClick={onBack} style={{ width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>←</button>;
}

function StarRating({ rating, onRate, size=32 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
      {[1,2,3,4,5].map(s=>(
        <span key={s} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} onClick={()=>onRate&&onRate(s)} style={{ fontSize:size, cursor:onRate?"pointer":"default", opacity:(hover||rating)>=s?1:0.2, transition:"all 0.15s", transform:(hover||rating)>=s?"scale(1.1)":"scale(1)" }}>⭐</span>
      ))}
    </div>
  );
}

function RatingModal({ booking, driver, onSubmit, onSkip }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      await addDoc(collection(db,"ratings"),{ bookingId:booking?.id, driverId:booking?.driverId, passengerId:booking?.passengerId, rating, comment, type:"passenger_to_driver", createdAt:serverTimestamp() });
      if (booking?.driverId) {
        const dSnap = await getDoc(doc(db,"drivers",booking.driverId));
        if (dSnap.exists()) {
          const d=dSnap.data(); const n=(d.totalRatings||0)+1;
          await updateDoc(doc(db,"drivers",booking.driverId),{ rating:Math.round(((d.rating||0)*(d.totalRatings||0)+rating)/n*10)/10, totalRatings:n });
        }
      }
      if (booking?.id) await updateDoc(doc(db,"bookings",booking.id),{ passengerRating:rating, status:"rated" });
    } catch(e){console.log(e);}
    setSaving(false); onSubmit(rating);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.card, borderRadius:"24px 24px 0 0", padding:"28px 24px 40px", width:"100%", maxWidth:430, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>🏁</div>
          <div style={{ fontWeight:900, fontSize:22, color:C.text }}>وصلت بسلام!</div>
          <div style={{ fontSize:13, color:C.textMuted, marginTop:4 }}>قيّم تجربتك مع {driver?.name||"السائق"}</div>
        </div>
        <StarRating rating={rating} onRate={setRating} size={40} />
        {rating>0&&<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="تعليق اختياري..." rows={3} style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 16px", fontFamily:"inherit", fontSize:14, color:C.text, outline:"none", resize:"none", direction:"rtl", marginTop:16 }} />}
        <div style={{ display:"flex", gap:10, marginTop:16 }}>
          <button onClick={onSkip} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:14, color:C.textMuted, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>تخطي</button>
          <button onClick={handleSubmit} disabled={!rating||saving} style={{ flex:2, background:rating?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border, border:"none", borderRadius:14, padding:14, color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:rating?"pointer":"default", fontSize:15 }}>
            {saving?"جارٍ...":"✅ إرسال التقييم"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SOSButton({ passengerName, bookingId }) {
  const [pressed, setPressed] = useState(false);
  const handleSOS = () => {
    setPressed(true);
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      try { await addDoc(collection(db,"sos_alerts"),{ passengerName, location:loc, bookingId, createdAt:serverTimestamp(), resolved:false }); } catch(e){}
      window.open(`https://api.whatsapp.com/send?text=🚨 طلب مساعدة طارئ من ${passengerName}! الموقع: https://maps.google.com/?q=${loc.lat},${loc.lng}`,"_blank");
    });
    setTimeout(()=>setPressed(false),3000);
  };
  return (
    <button onClick={handleSOS} style={{ position:"fixed", bottom:100, left:20, width:56, height:56, borderRadius:"50%", background:pressed?"#dc2626":C.red, border:"none", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:900, boxShadow:"0 4px 20px rgba(239,68,68,0.5)", zIndex:500, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, animation:"pulse-sos 2s infinite", fontFamily:"inherit" }}>
      <span style={{ fontSize:20 }}>🆘</span><span>SOS</span>
      <style>{`@keyframes pulse-sos{0%,100%{box-shadow:0 4px 20px rgba(239,68,68,0.5)}50%{box-shadow:0 4px 32px rgba(239,68,68,0.9)}}`}</style>
    </button>
  );
}

// ===== PASSENGER APP =====
function PassengerApp({ onLogout, user }) {
  const [screen, setScreen] = useState("home");
  const [originPlace, setOriginPlace] = useState(null); const [destPlace, setDestPlace] = useState(null);
  const [originText, setOriginText] = useState(""); const [destText, setDestText] = useState("");
  const [rideType, setRideType] = useState("economy");
  const [distanceKm, setDistanceKm] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(MIN_PRICE);
  const [offerPrice, setOfferPrice] = useState(MIN_PRICE);
  const [booking, setBooking] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [finalRating, setFinalRating] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [noDrivers, setNoDrivers] = useState(false);
  const [timer, setTimer] = useState(0);
  const [passengerGPS, setPassengerGPS] = useState(null);
  const [passengerData, setPassengerData] = useState(null);
  const [fcmToast, setFcmToast] = useState(null);
  const originRef = useRef(null); const destRef = useRef(null);

  const currentType = RIDE_TYPES.find(t=>t.id===rideType)||RIDE_TYPES[0];
  const passengerPhone = localStorage.getItem("taxidz_phone")||user?.phoneNumber||"";
  const passengerName = localStorage.getItem("taxidz_name")||user?.displayName||"مستخدم";

  // تحميل بيانات الراكب + طلب FCM Token
  useEffect(() => {
    if (!user?.uid) return;
    const u = onSnapshot(doc(db,"passengers",user.uid), s=>{ if(s.exists()) setPassengerData(s.data()); });
    // طلب إذن الإشعارات
    requestNotificationPermission().then(token=>{ if(token) setDoc(doc(db,"passengers",user.uid),{fcmToken:token},{merge:true}).catch(()=>{}); });
    // الإشعارات في المقدمة
    const unsub = onForegroundMessage(msg=>{ setFcmToast({ title:msg.notification?.title, body:msg.notification?.body }); });
    return ()=>{ u(); if(unsub) unsub(); };
  }, [user?.uid]);

  useEffect(()=>{ if(distanceKm>0){const p=calcPrice(distanceKm,currentType.multiplier);setSuggestedPrice(p);setOfferPrice(p);} },[rideType,distanceKm]);

  useEffect(()=>{ if(!bookingId||(screen!=="found"&&screen!=="ride")) return; const u=onSnapshot(doc(db,"bookings",bookingId),snap=>{ if(!snap.exists()) return; const data=snap.data(); if(data.status==="accepted"&&data.driverInfo&&screen==="searching"){setSelectedDriver(data.driverInfo);setScreen("found");} if(data.driverCurrentLocation){const dLoc=data.driverCurrentLocation;setDriverLocation(dLoc);const pLoc=passengerGPS||(originPlace?getLatLng(originPlace):null);if(pLoc&&screen==="found"){setEta(Math.max(1,Math.round(getDistanceKm(dLoc.lat,dLoc.lng,pLoc.lat,pLoc.lng)/0.5)));}} }); return()=>u(); },[bookingId,screen,originPlace,passengerGPS]);
  useEffect(()=>{ if(!bookingId||screen!=="searching") return; const u=onSnapshot(doc(db,"bookings",bookingId),snap=>{ if(!snap.exists()) return; const d=snap.data(); if(d.status==="accepted"&&d.driverInfo){setSelectedDriver(d.driverInfo);setScreen("found");} }); return()=>u(); },[bookingId,screen]);
  useEffect(()=>{ if(screen!=="searching") return; const t=setInterval(()=>setTimer(p=>p+1),1000); return()=>clearInterval(t); },[screen]);
  useEffect(()=>{ if(screen==="searching"&&timer===60) setNoDrivers(true); },[timer,screen]);
  useEffect(()=>{ if(screen!=="ride") return; const t=setInterval(()=>setElapsed(p=>p+1),1000); return()=>clearInterval(t); },[screen]);

  const updateDistance = (lat1,lng1,lat2,lng2) => { const km=getDistanceKm(lat1,lng1,lat2,lng2); setDistanceKm(km); const p=calcPrice(km,currentType.multiplier); setSuggestedPrice(p); setOfferPrice(p); };
  const handleGPS = () => { setGpsLoading(true); navigator.geolocation?.getCurrentPosition(pos=>{ const latlng=new window.google.maps.LatLng(pos.coords.latitude,pos.coords.longitude); setOriginPlace(latlng); setPassengerGPS({lat:pos.coords.latitude,lng:pos.coords.longitude}); new window.google.maps.Geocoder().geocode({location:latlng},(results,status)=>{ setOriginText(status==="OK"&&results[0]?results[0].formatted_address:`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`); setGpsLoading(false); if(destPlace){const{lat:lat2,lng:lng2}=getLatLng(destPlace);updateDistance(pos.coords.latitude,pos.coords.longitude,lat2,lng2);} }); },()=>{setGpsLoading(false);}); };
  const onOriginChanged = () => { if(originRef.current){const p=originRef.current.getPlace();if(p?.geometry){setOriginPlace(p.geometry.location);setOriginText(p.formatted_address||p.name);if(destPlace){const{lat:lat1,lng:lng1}=getLatLng(p.geometry.location);const{lat:lat2,lng:lng2}=getLatLng(destPlace);updateDistance(lat1,lng1,lat2,lng2);}}} };
  const onDestChanged = () => { if(destRef.current){const p=destRef.current.getPlace();if(p?.geometry){setDestPlace(p.geometry.location);setDestText(p.formatted_address||p.name);if(originPlace){const{lat:lat1,lng:lng1}=getLatLng(originPlace);const{lat:lat2,lng:lng2}=getLatLng(p.geometry.location);updateDistance(lat1,lng1,lat2,lng2);}}} };

  const startSearch = async (price) => {
    setTimer(0); setNoDrivers(false); setDriverLocation(null);
    const oLL=getLatLng(originPlace), dLL=getLatLng(destPlace);
    try {
      const ref = await addDoc(collection(db,"bookings"),{ passengerId:user.uid, passengerName, passengerPhone, originText, destText, originLat:oLL.lat, originLng:oLL.lng, destLat:dLL.lat, destLng:dLL.lng, rideType, price, distanceKm, status:"pending", createdAt:serverTimestamp() });
      setBookingId(ref.id);
      setBooking({originPlace,destPlace,originText,destText,rideType,price,distanceKm,passengerPhone,passengerName,id:ref.id});
      // إرسال إشعار FCM للسائقين القريبين
      const snap = await getDocs(query(collection(db,"drivers"),where("isOnline","==",true),where("verificationStatus","==","approved")));
      const tokens = [];
      snap.docs.forEach(d=>{ const dd=d.data(); if(dd.location&&dd.fcmToken){ const dist=getDistanceKm(oLL.lat,oLL.lng,dd.location.lat,dd.location.lng); if(dist<=1.0) tokens.push(dd.fcmToken); } });
      if (tokens.length>0) await sendFCMNotification(tokens,"🚕 طلب جديد قريب منك!",`💰 ${price} دج · ${distanceKm.toFixed(1)} كم | 📍 ${originText.substring(0,40)}`,{type:"new_booking",bookingId:ref.id});
    } catch(e) { setBooking({originPlace,destPlace,originText,destText,rideType,price,distanceKm,passengerPhone,passengerName}); }
    setScreen("searching");
  };

  const cancelBooking = async () => { if(bookingId){try{await updateDoc(doc(db,"bookings",bookingId),{status:"cancelled"});}catch(e){}} setBookingId(null); setScreen("home"); };
  const finishRide = async () => { if(bookingId){try{await updateDoc(doc(db,"bookings",bookingId),{status:"completed",completedAt:serverTimestamp()});}catch(e){}} if(user?.uid&&passengerData){try{await updateDoc(doc(db,"passengers",user.uid),{totalRides:(passengerData.totalRides||0)+1});}catch(e){}} setShowRating(true); };

  // HOME
  if (screen==="home") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
      <div style={{ padding:"48px 20px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:13, color:C.textMuted }}>مرحباً 👋</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{passengerName}</div>
          {passengerPhone&&<div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>📱 {passengerPhone}</div>}
          {passengerData?.totalRides>0&&<div style={{ fontSize:11, color:C.green }}>🚕 {passengerData.totalRides} رحلة</div>}
        </div>
        <button onClick={onLogout} style={{ width:40, height:40, borderRadius:12, background:C.redLight, border:"none", cursor:"pointer", fontSize:18 }}>🚪</button>
      </div>
      <TaxiMap origin={null} destination={null} showDrivers={true} />
      <div style={{ margin:"14px 20px", background:C.card, borderRadius:24, padding:20, boxShadow:C.shadow }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:14, color:C.text }}>إلى أين تريد الذهاب؟ 🚕</div>
        <div onClick={()=>setScreen("booking")} style={{ background:C.dark, borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:C.orange }} />
          <span style={{ color:"#ffffff88", fontSize:14 }}>ابحث عن وجهتك...</span>
        </div>
        <button onClick={()=>setScreen("booking")} style={{ width:"100%", marginTop:12, background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:16, padding:"16px", color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:"pointer" }}>🚀 ابحث عن سيارة</button>
      </div>
      <div style={{ margin:"0 20px", background:`linear-gradient(135deg,${C.dark},#2d1b69)`, borderRadius:20, padding:"16px 20px", color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div><div style={{ fontSize:12, opacity:0.7 }}>نظام التسعير</div><div style={{ fontSize:16, fontWeight:800, marginTop:2 }}>40 دج + 30 دج/كم 🤝</div></div>
        <div style={{ fontSize:40 }}>💰</div>
      </div>
    </div>
  );

  // BOOKING
  if (screen==="booking") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl", paddingBottom:30 }}>
      <div style={{ display:"flex", alignItems:"center", padding:"48px 20px 12px", gap:12 }}>
        <BackBtn onBack={()=>setScreen("home")} />
        <div style={{ fontWeight:800, fontSize:18, color:C.text }}>تفاصيل الرحلة</div>
      </div>
      <TaxiMap origin={originPlace} destination={destPlace} showDrivers={false} />
      {distanceKm>0&&<div style={{ display:"flex", gap:8, margin:"10px 20px 0", justifyContent:"center" }}>
        <div style={{ background:C.greenLight, borderRadius:20, padding:"6px 14px", fontSize:13, color:C.greenDark, fontWeight:700 }}>📏 {distanceKm.toFixed(1)} كم</div>
        <div style={{ background:C.orangeLight, borderRadius:20, padding:"6px 14px", fontSize:14, color:C.orange, fontWeight:900 }}>💰 {suggestedPrice} دج</div>
      </div>}
      <div style={{ margin:"14px 20px", background:C.card, borderRadius:24, padding:20, boxShadow:C.shadow }}>
        <button onClick={handleGPS} disabled={gpsLoading} style={{ width:"100%", background:gpsLoading?C.border:C.greenLight, border:`1px solid ${C.green}44`, borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"center", gap:8, cursor:"pointer", marginBottom:12, fontFamily:"inherit", fontWeight:700, fontSize:14, color:gpsLoading?C.textMuted:C.greenDark }}>
          <span style={{ fontSize:18 }}>📍</span>{gpsLoading?"جارٍ تحديد موقعك...":"استخدم موقعي الحالي"}
        </button>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          <div style={{ background:C.greenLight, borderRadius:14, padding:"10px 16px", display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:C.green, flexShrink:0 }} />
            <Autocomplete onLoad={ac=>originRef.current=ac} onPlaceChanged={onOriginChanged} options={{ componentRestrictions:{country:"dz"} }}>
              <input value={originText} onChange={e=>setOriginText(e.target.value)} placeholder="نقطة الانطلاق..." style={{ background:"none", border:"none", outline:"none", fontFamily:"inherit", fontSize:14, color:C.text, width:"100%", textAlign:"right" }} />
            </Autocomplete>
          </div>
          <div style={{ background:C.orangeLight, borderRadius:14, padding:"10px 16px", display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:C.orange, flexShrink:0 }} />
            <Autocomplete onLoad={ac=>destRef.current=ac} onPlaceChanged={onDestChanged} options={{ componentRestrictions:{country:"dz"} }}>
              <input value={destText} onChange={e=>setDestText(e.target.value)} placeholder="إلى أين؟ مثال: حيدرة..." style={{ background:"none", border:"none", outline:"none", fontFamily:"inherit", fontSize:14, color:C.text, width:"100%", textAlign:"right" }} />
            </Autocomplete>
          </div>
        </div>
        <div style={{ fontWeight:700, marginBottom:10, color:C.text }}>نوع السيارة</div>
        {RIDE_TYPES.map(t=>(
          <div key={t.id} onClick={()=>setRideType(t.id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderRadius:14, border:`2px solid ${rideType===t.id?C.green:C.border}`, background:rideType===t.id?C.greenLight:C.bg, cursor:"pointer", marginBottom:8, transition:"all 0.15s" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{t.icon}</span>
              <div><div style={{ fontWeight:700, fontSize:14, color:C.text }}>{t.label}</div><div style={{ fontSize:11, color:C.textMuted }}>⏱ {t.time}</div></div>
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:900, fontSize:16, color:rideType===t.id?C.greenDark:C.text }}>{calcPrice(distanceKm,t.multiplier)} دج</div>
              {distanceKm>0&&<div style={{ fontSize:10, color:C.textMuted }}>40+{distanceKm.toFixed(1)}×{Math.round(PRICE_PER_KM*t.multiplier)}</div>}
            </div>
          </div>
        ))}
        <button onClick={()=>{if(originPlace&&destPlace)setScreen("offer");}} style={{ width:"100%", marginTop:8, background:originPlace&&destPlace?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border, border:"none", borderRadius:16, padding:16, color:originPlace&&destPlace?"#fff":C.textMuted, fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:originPlace&&destPlace?"pointer":"default" }}>
          {originPlace&&destPlace?`التالي: إرسال العرض (${suggestedPrice} دج) 🚀`:"اختر نقطة الانطلاق والوجهة"}
        </button>
      </div>
    </div>
  );

  // OFFER
  if (screen==="offer") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl", paddingBottom:40 }}>
      <div style={{ display:"flex", alignItems:"center", padding:"48px 20px 16px", gap:12 }}>
        <BackBtn onBack={()=>setScreen("booking")} />
        <div><div style={{ fontWeight:800, fontSize:18, color:C.text }}>عرض السعر 💰</div><div style={{ fontSize:12, color:C.textMuted }}>40 + {distanceKm.toFixed(1)}×30 = {suggestedPrice} دج</div></div>
      </div>
      <div style={{ margin:"0 20px 14px", background:C.card, borderRadius:24, padding:24, boxShadow:C.shadow, textAlign:"center" }}>
        <div style={{ fontSize:13, color:C.textMuted, marginBottom:4 }}>سعرك المقترح</div>
        <div style={{ fontSize:64, fontWeight:900, color:offerPrice>suggestedPrice?C.blue:C.green, lineHeight:1, transition:"color 0.3s" }}>{offerPrice}</div>
        <div style={{ fontSize:18, color:C.textMuted, marginBottom:20 }}>دينار جزائري</div>
        <input type="range" min={suggestedPrice} max={Math.round(suggestedPrice*2)} step={10} value={offerPrice} onChange={e=>setOfferPrice(Number(e.target.value))} style={{ width:"100%", accentColor:C.green, cursor:"pointer", marginBottom:8, height:6 }} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.textLight }}>
          <span style={{ color:C.green, fontWeight:700 }}>الحد الأدنى: {suggestedPrice} دج</span>
          <span>{Math.round(suggestedPrice*2)} دج</span>
        </div>
      </div>
      <div style={{ margin:"0 20px 14px", background:C.card, borderRadius:20, padding:18, boxShadow:C.shadow }}>
        <div style={{ fontWeight:700, fontSize:13, color:C.text, marginBottom:10 }}>اقتراحات</div>
        <div style={{ display:"flex", gap:8 }}>
          {[{label:"المحسوب ⭐",value:suggestedPrice,color:C.green},{label:"+20% 🔥",value:Math.round(suggestedPrice*1.2),color:C.orange},{label:"+50% 💎",value:Math.round(suggestedPrice*1.5),color:C.blue}].map((s,i)=>(
            <button key={i} onClick={()=>setOfferPrice(s.value)} style={{ flex:1, padding:"10px 4px", borderRadius:12, border:`2px solid ${offerPrice===s.value?s.color:C.border}`, background:offerPrice===s.value?s.color+"15":C.bg, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>
              <div style={{ fontSize:13, fontWeight:800, color:offerPrice===s.value?s.color:C.text }}>{s.value} دج</div>
              <div style={{ fontSize:9, color:C.textMuted, marginTop:2 }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ margin:"0 20px" }}>
        <button onClick={()=>startSearch(offerPrice)} style={{ width:"100%", background:`linear-gradient(135deg,${C.dark},#2d1b69)`, border:"none", borderRadius:16, padding:18, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:17, cursor:"pointer" }}>
          🚀 إرسال العرض للسائقين — {offerPrice} دج
        </button>
      </div>
    </div>
  );

  // SEARCHING
  if (screen==="searching") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl", paddingBottom:40 }}>
      <TaxiMap origin={booking?.originPlace} destination={booking?.destPlace} showDrivers={true} />
      <div style={{ padding:"14px 20px 0" }}>
        <div style={{ fontWeight:800, fontSize:18, color:C.text }}>📡 جارٍ البحث عن سائق...</div>
        <div style={{ fontSize:13, color:C.textMuted }}>عرضك: {booking?.price} دج · {booking?.distanceKm?.toFixed(1)} كم · ⏱ {timer}ث</div>
      </div>
      <div style={{ margin:"20px auto", width:100, height:100, position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {[0,1,2].map(i=><div key={i} style={{ position:"absolute", width:30+i*25, height:30+i*25, borderRadius:"50%", border:`2px solid ${C.green}`, animation:"pg 1.5s ease-out infinite", animationDelay:`${i*0.4}s` }} />)}
        <div style={{ fontSize:32, zIndex:1 }}>🚕</div>
        <style>{`@keyframes pg{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(1.5);opacity:0}}`}</style>
      </div>
      {noDrivers&&(
        <div style={{ margin:"14px 20px", background:C.orangeLight, borderRadius:20, padding:20, border:`1px solid ${C.orange}44`, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:8 }}>😔</div>
          <div style={{ fontWeight:800, color:C.orange, fontSize:16, marginBottom:8 }}>لم يقبل أي سائق</div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>{setOfferPrice(Math.round((booking?.price||suggestedPrice)*1.2));setScreen("offer");}} style={{ flex:1, background:`linear-gradient(135deg,${C.orange},#ea580c)`, border:"none", borderRadius:14, padding:"12px", color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:"pointer", fontSize:14 }}>💰 زيادة السعر</button>
            <button onClick={cancelBooking} style={{ flex:1, background:C.redLight, border:"none", borderRadius:14, padding:"12px", color:C.red, fontFamily:"inherit", fontWeight:700, cursor:"pointer", fontSize:14 }}>❌ إلغاء</button>
          </div>
        </div>
      )}
      {!noDrivers&&<div style={{ margin:"14px 20px" }}><button onClick={cancelBooking} style={{ width:"100%", background:C.redLight, border:"none", borderRadius:14, padding:"12px", color:C.red, fontFamily:"inherit", fontWeight:700, cursor:"pointer", fontSize:14 }}>❌ إلغاء</button></div>}
    </div>
  );

  // FOUND
  if (screen==="found") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      <PassengerTrackingMap passengerLocation={passengerGPS||(originPlace?getLatLng(originPlace):null)} driverLocation={driverLocation} destinationLocation={destPlace?getLatLng(destPlace):null} mode="pickup" />
      <div style={{ margin:"14px 20px", background:C.card, borderRadius:24, padding:22, boxShadow:C.shadow }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:44 }}>🎉</div>
          <div style={{ fontWeight:900, fontSize:20, color:C.text }}>تم قبول طلبك!</div>
          {eta&&<div style={{ background:C.greenLight, borderRadius:12, padding:"6px 16px", marginTop:8, display:"inline-block" }}><span style={{ fontSize:15, fontWeight:800, color:C.greenDark }}>⏱ ~{eta} دقيقة</span></div>}
        </div>
        <div style={{ background:C.bg, borderRadius:16, padding:16, marginBottom:14 }}>
          <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10 }}>
            <div style={{ width:52, height:52, borderRadius:"50%", background:C.dark, overflow:"hidden", border:`2px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
              {selectedDriver?.selfieUrl?<img src={selectedDriver.selfieUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />:"👨‍✈️"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{selectedDriver?.name||"السائق"}</div>
              <div style={{ fontSize:12, color:C.textMuted }}>{selectedDriver?.carBrand} {selectedDriver?.carModel}</div>
              {selectedDriver?.rating>0&&<StarRating rating={Math.round(selectedDriver.rating)} size={14} />}
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:900, fontSize:18, color:C.greenDark }}>{booking?.price} دج</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{booking?.distanceKm?.toFixed(1)} كم</div>
            </div>
          </div>
          <div style={{ background:C.dark, borderRadius:14, padding:12, textAlign:"center" }}>
            <div style={{ fontSize:11, color:"#ffffff88", marginBottom:4 }}>رمز التحقق — أعطه للسائق</div>
            <div style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:8 }}>{Math.floor(1000+Math.random()*9000)}</div>
          </div>
        </div>
        {selectedDriver?.phone&&<a href={`tel:${selectedDriver.phone}`} style={{ display:"flex", alignItems:"center", gap:10, background:C.greenLight, border:`1px solid ${C.green}44`, borderRadius:12, padding:"12px 14px", marginBottom:14, textDecoration:"none" }}>
          <span style={{ fontSize:22 }}>📞</span>
          <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.textMuted }}>رقم السائق</div><div style={{ fontSize:16, fontWeight:900, color:C.green, direction:"ltr" }}>{selectedDriver.phone}</div></div>
          <div style={{ background:C.green, borderRadius:8, padding:"6px 12px", fontSize:12, color:"#fff", fontWeight:700 }}>☎️</div>
        </a>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={cancelBooking} style={{ flex:1, background:C.redLight, border:"none", borderRadius:12, padding:14, color:C.red, fontFamily:"inherit", fontWeight:700, cursor:"pointer" }}>❌ إلغاء</button>
          <button onClick={()=>{setElapsed(0);setScreen("ride");}} style={{ flex:2, background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:12, padding:14, color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:"pointer" }}>📱 تتبع الرحلة</button>
        </div>
      </div>
      <SOSButton passengerName={passengerName} bookingId={bookingId} />
    </div>
  );

  // RIDE
  if (screen==="ride") {
    const mins=Math.floor(elapsed/60), secs=elapsed%60;
    if (showRating) return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
        {finalRating>0?(
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:24, gap:16 }}>
            <div style={{ fontSize:80 }}>{finalRating>=4?"🌟":"⭐"}</div>
            <div style={{ fontWeight:900, fontSize:24, color:C.text }}>شكراً على تقييمك!</div>
            <button onClick={()=>{setScreen("home");setShowRating(false);setDistanceKm(0);setBookingId(null);setFinalRating(0);}} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:16, padding:"16px 40px", color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:"pointer", marginTop:16 }}>🏠 العودة للرئيسية</button>
          </div>
        ):(
          <RatingModal booking={{...booking,id:bookingId,passengerId:user?.uid,driverId:selectedDriver?.uid}} driver={selectedDriver} onSubmit={r=>setFinalRating(r)} onSkip={()=>{setScreen("home");setShowRating(false);setDistanceKm(0);setBookingId(null);}} />
        )}
      </div>
    );
    return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
        <PassengerTrackingMap passengerLocation={passengerGPS||(originPlace?getLatLng(originPlace):null)} driverLocation={driverLocation} destinationLocation={destPlace?getLatLng(destPlace):null} mode="ride" />
        <div style={{ margin:"14px 20px", background:C.card, borderRadius:24, padding:20, boxShadow:C.shadow }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ background:C.greenLight, borderRadius:12, padding:"8px 14px" }}><div style={{ fontSize:10, color:C.green }}>مدة الرحلة</div><div style={{ fontWeight:800, color:C.greenDark }}>{mins}:{secs.toString().padStart(2,"0")}</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:11, color:C.textMuted }}>الوجهة</div><div style={{ fontWeight:700, color:C.text, fontSize:12, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{destText}</div></div>
            <div style={{ background:C.dark, borderRadius:12, padding:"8px 14px", textAlign:"center" }}><div style={{ fontSize:10, color:"#ffffff88" }}>السعر</div><div style={{ fontWeight:800, color:"#fff" }}>{booking?.price} دج</div></div>
          </div>
          {destPlace&&<button onClick={()=>{const d=getLatLng(destPlace);openNavigation(d.lat,d.lng);}} style={{ width:"100%", background:`linear-gradient(135deg,${C.googleBlue},#1557b0)`, border:"none", borderRadius:14, padding:13, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>🗺️</span> تتبع مسار الرحلة — Google Maps
          </button>}
          <button onClick={finishRide} style={{ width:"100%", background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:14, padding:14, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:"pointer" }}>🏁 وصلت</button>
        </div>
        <SOSButton passengerName={passengerName} bookingId={bookingId} />
      </div>
    );
  }
  return null;
}

// ===== MAIN =====
export default function App() {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey:process.env.REACT_APP_GOOGLE_MAPS_KEY||"", libraries:LIBRARIES, language:"ar", region:"DZ" });
  const [screen, setScreen] = useState("welcome");
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = onAuthStateChanged(auth, async u=>{
      if (u) {
        setUser(u);
        const savedRole = localStorage.getItem("taxidz_role");
        if (savedRole) { setRole(savedRole); setScreen("app"); return; }
        // تحديد الدور من Firestore
        try {
          const pSnap = await getDoc(doc(db,"passengers",u.uid));
          if (pSnap.exists()) { localStorage.setItem("taxidz_role","passenger"); setRole("passenger"); setScreen("app"); return; }
          const dSnap = await getDoc(doc(db,"drivers",u.uid));
          if (dSnap.exists()) { localStorage.setItem("taxidz_role","driver"); setRole("driver"); setScreen("app"); return; }
        } catch(e){}
        // مستخدم جديد — إظهار شاشة الترحيب
        setScreen("welcome");
      } else {
        setUser(null); setRole(null); setScreen("welcome");
        localStorage.removeItem("taxidz_role");
      }
    });
    return ()=>u();
  }, []);

  const handleLogout = async () => {
    // إيقاف الاتصال للسائق
    if (role==="driver"&&user?.uid) { try{await setDoc(doc(db,"drivers",user.uid),{isOnline:false},{merge:true});}catch(e){} }
    try{await signOut(auth);}catch(e){}
    setUser(null); setRole(null); setScreen("welcome");
    ["taxidz_role","taxidz_phone","taxidz_name"].forEach(k=>localStorage.removeItem(k));
  };

  const handleAuthSuccess = async (selectedRole) => {
    setRole(selectedRole);
    localStorage.setItem("taxidz_role", selectedRole);
    // حفظ FCM Token للسائق أيضاً
    if (selectedRole==="driver"&&auth.currentUser) {
      const token = await requestNotificationPermission();
      if (token) await setDoc(doc(db,"drivers",auth.currentUser.uid),{fcmToken:token},{merge:true}).catch(()=>{});
    }
    setScreen("app");
  };

  if (loadError) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}><div style={{ textAlign:"center" }}><div style={{ fontSize:48 }}>⚠️</div><div style={{ fontWeight:800, color:C.text }}>خطأ في تحميل الخريطة</div></div></div>;
  if (!isLoaded) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}><div style={{ textAlign:"center" }}><div style={{ fontSize:48, marginBottom:8 }}>🗺️</div><div style={{ fontWeight:700, color:C.text }}>جارٍ تحميل...</div></div></div>;

  return (
    <div style={{ maxWidth:390, margin:"0 auto", minHeight:"100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      {screen==="welcome"&&<WelcomeScreen onSelect={r=>{setRole(r);setScreen("auth");}} />}
      {screen==="auth"&&<OTPAuth role={role} onSuccess={handleAuthSuccess} onBack={()=>{setRole(null);setScreen("welcome");}} />}
      {screen==="app"&&role==="passenger"&&<PassengerApp onLogout={handleLogout} user={user} />}
      {screen==="app"&&role==="driver"&&<DriverDashboard user={user} onLogout={handleLogout} />}
    </div>
  );
}
