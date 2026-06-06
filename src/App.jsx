import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection, onSnapshot, updateDoc, getDocs, query, where } from "firebase/firestore";
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

// فتح Google Maps للملاحة
const openNavigation = (destLat, destLng) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving&dir_action=navigate`;
  window.open(url, "_blank");
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
  yellow:"#f59e0b",
  text:"#1a1a2e", textMuted:"#64748b", textLight:"#94a3b8",
  border:"#e8e3db", shadow:"0 4px 24px rgba(0,0,0,0.08)",
};

const RIDE_TYPES = [
  { id:"economy", label:"اقتصادي", icon:"🚗", multiplier:1.0, time:"3 دق" },
  { id:"comfort", label:"مريح", icon:"🚙", multiplier:1.4, time:"5 دق" },
  { id:"xl", label:"XL كبير", icon:"🚐", multiplier:1.8, time:"7 دق" },
];

function BackBtn({ onBack }) {
  return (
    <button onClick={onBack} style={{ width:40, height:40, borderRadius:12, background:C.card, border:`1px solid ${C.border}`, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>←</button>
  );
}

// ===== خريطة تتبع الراكب للسائق =====
function PassengerTrackingMap({ passengerLocation, driverLocation, destinationLocation, mode="pickup", height=240 }) {
  const [directions, setDirections] = useState(null);
  const mapRef = useRef(null);
  const makeMarker = (emoji, color) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><circle cx='22' cy='22' r='20' fill='${color}' stroke='white' stroke-width='3'/><text x='22' y='29' text-anchor='middle' font-size='20'>${emoji}</text></svg>`
  );
  const target = mode==="pickup" ? passengerLocation : destinationLocation;

  useEffect(() => {
    if (!driverLocation||!target||!window.google) { setDirections(null); return; }
    new window.google.maps.DirectionsService().route(
      { origin:driverLocation, destination:target, travelMode:"DRIVING" },
      (result,status) => { if (status==="OK") setDirections(result); }
    );
  }, [driverLocation, target]);

  useEffect(() => {
    if (driverLocation && mapRef.current) mapRef.current.panTo(driverLocation);
  }, [driverLocation]);

  const center = driverLocation || passengerLocation || ALGERIA_CENTER;

  return (
    <div style={{ margin:"0 20px", borderRadius:20, overflow:"hidden", position:"relative" }}>
      <GoogleMap
        mapContainerStyle={{ width:"100%", height:`${height}px` }}
        center={center} zoom={15}
        onLoad={map => mapRef.current=map}
        options={{ styles:MAP_STYLE, disableDefaultUI:true, zoomControl:true }}
      >
        {passengerLocation && <Marker position={passengerLocation} icon={{ url:makeMarker("📍",C.green), scaledSize:new window.google.maps.Size(44,44) }} />}
        {driverLocation && <Marker position={driverLocation} icon={{ url:makeMarker("🚕",C.orange), scaledSize:new window.google.maps.Size(44,44) }} />}
        {destinationLocation && mode==="ride" && <Marker position={destinationLocation} icon={{ url:makeMarker("🏁",C.blue), scaledSize:new window.google.maps.Size(44,44) }} />}
        {directions && <DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:C.orange, strokeWeight:5, strokeOpacity:0.85 }, suppressMarkers:true }} />}
      </GoogleMap>
      <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.7)", borderRadius:20, padding:"6px 14px", display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:C.green, animation:"pulse 1.5s infinite" }} />
        <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>{mode==="pickup"?"السائق في طريقه إليك":"رحلة جارية"}</span>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}`}</style>
    </div>
  );
}

// ===== خريطة عادية =====
function TaxiMap({ origin, destination, showDrivers, height=220 }) {
  const [directions, setDirections] = useState(null);
  const [userLocation, setUserLocation] = useState(ALGERIA_CENTER);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const mapRef = useRef(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat:pos.coords.latitude, lng:pos.coords.longitude }),
      () => setUserLocation(ALGERIA_CENTER)
    );
  }, []);
  useEffect(() => {
    if (!showDrivers) return;
    const unsub = onSnapshot(collection(db,"drivers"), snap => {
      setNearbyDrivers(snap.docs.filter(d=>d.data().isOnline&&d.data().verificationStatus==="approved"&&d.data().location).map(d=>({id:d.id,...d.data()})));
    });
    return ()=>unsub();
  }, [showDrivers]);
  useEffect(() => {
    if (!origin||!destination) { setDirections(null); return; }
    new window.google.maps.DirectionsService().route(
      { origin, destination, travelMode:window.google.maps.TravelMode.DRIVING },
      (result,status) => { if (status==="OK") setDirections(result); }
    );
  }, [origin, destination]);
  const onLoad = useCallback(map=>{ mapRef.current=map; }, []);
  const makeMarker = (emoji,color) => "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='${color}' stroke='white' stroke-width='3'/><text x='20' y='27' text-anchor='middle' font-size='18'>${emoji}</text></svg>`
  );
  return (
    <div style={{ margin:"0 20px", borderRadius:20, overflow:"hidden" }}>
      <GoogleMap mapContainerStyle={{ width:"100%", height:`${height}px` }} center={origin||userLocation} zoom={13} onLoad={onLoad} options={{ styles:MAP_STYLE, disableDefaultUI:true, zoomControl:true }}>
        {!origin && <Marker position={userLocation} />}
        {origin&&!directions && <Marker position={origin} icon={{ url:makeMarker("📍",C.green), scaledSize:new window.google.maps.Size(40,40) }} />}
        {destination&&!directions && <Marker position={destination} icon={{ url:makeMarker("🏁",C.orange), scaledSize:new window.google.maps.Size(40,40) }} />}
        {directions && <DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:C.green, strokeWeight:4, strokeOpacity:0.8 } }} />}
        {showDrivers && nearbyDrivers.map(d=><Marker key={d.id} position={d.location} icon={{ url:makeMarker("🚕",C.dark), scaledSize:new window.google.maps.Size(40,40) }} />)}
      </GoogleMap>
    </div>
  );
}

// ===== WELCOME =====
function WelcomeScreen({ onSelect }) {
  return (
    <div style={{ minHeight:"100vh", background:C.dark, fontFamily:"'Cairo',sans-serif", direction:"rtl", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontSize:72, marginBottom:12 }}>🚕</div>
      <div style={{ fontSize:32, fontWeight:900, color:"#fff", marginBottom:6 }}>TaxiDZ</div>
      <div style={{ fontSize:14, color:"#ffffff77", marginBottom:8 }}>تاكسي الجزائر 🇩🇿</div>
      <div style={{ fontSize:12, color:"#ffffff55", marginBottom:48, background:"#ffffff11", padding:"6px 14px", borderRadius:20 }}>40 دج + 30 دج/كم</div>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:14 }}>
        <button onClick={()=>onSelect("passenger")} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:20, padding:"20px 24px", color:"#fff", fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:40 }}>🧑</span>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:800, fontSize:18 }}>راكب</div><div style={{ fontSize:13, opacity:0.85 }}>أبحث عن سيارة أجرة</div></div>
        </button>
        <button onClick={()=>onSelect("driver")} style={{ background:`linear-gradient(135deg,${C.orange},#ea580c)`, border:"none", borderRadius:20, padding:"20px 24px", color:"#fff", fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:40 }}>👨‍✈️</span>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:800, fontSize:18 }}>سائق</div><div style={{ fontSize:13, opacity:0.85 }}>أقدم خدمة النقل</div></div>
        </button>
      </div>
    </div>
  );
}

// ===== AUTH =====
function AuthForm({ role, onSuccess, onBack }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const isPassenger = role==="passenger";
  const accent = isPassenger?C.green:C.orange, accentDark = isPassenger?C.greenDark:"#ea580c";
  const errMsg = (code) => ({
    "auth/email-already-in-use":"البريد مستخدم مسبقاً — جرّب تسجيل الدخول",
    "auth/wrong-password":"كلمة المرور خاطئة",
    "auth/user-not-found":"الحساب غير موجود — أنشئ حساباً جديداً",
    "auth/weak-password":"كلمة المرور قصيرة (6 أحرف على الأقل)",
    "auth/invalid-credential":"البريد أو كلمة المرور غير صحيحة",
    "auth/network-request-failed":"تحقق من اتصالك بالإنترنت",
    "auth/too-many-requests":"محاولات كثيرة — انتظر قليلاً",
  }[code]||"حدث خطأ، حاول مرة أخرى");

  const handleRegister = async () => {
    if (!email||!password) { setError("أدخل البريد وكلمة المرور"); return; }
    if (isPassenger&&!phone) { setError("أدخل رقم هاتفك"); return; }
    if (isPassenger&&!name) { setError("أدخل اسمك"); return; }
    setLoading(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(cred.user,{displayName:name||email.split("@")[0]});
      const phoneFormatted = isPassenger?(phone.startsWith("+")?phone:`+213${phone.replace(/^0/,"")}`): "";
      try {
        await setDoc(doc(db,role==="driver"?"drivers":"passengers",cred.user.uid), { uid:cred.user.uid, email, name:name||email.split("@")[0], phone:phoneFormatted, role, status:role==="driver"?"pending":"active", verificationStatus:role==="driver"?"none":null, createdAt:serverTimestamp() });
      } catch(e) { console.log("Firestore:",e); }
      if (isPassenger) { localStorage.setItem("taxidz_phone",phoneFormatted); localStorage.setItem("taxidz_name",name); }
      onSuccess(role);
    } catch(e) { setError(errMsg(e.code)); }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!email||!password) { setError("أدخل البريد وكلمة المرور"); return; }
    setLoading(true); setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth,email,password);
      try {
        const rightCol = isPassenger?"passengers":"drivers", wrongCol = isPassenger?"drivers":"passengers";
        const snap = await getDoc(doc(db,rightCol,cred.user.uid));
        if (!snap.exists()) {
          const wrongSnap = await getDoc(doc(db,wrongCol,cred.user.uid));
          await signOut(auth);
          setError(wrongSnap.exists() ? (isPassenger?"⚠️ هذا الحساب مسجل كسائق — ادخل من بوابة السائق":"⚠️ هذا الحساب مسجل كراكب — ادخل من بوابة الراكب") : "الحساب غير موجود — أنشئ حساباً جديداً");
          setLoading(false); return;
        }
        if (isPassenger) { const d=snap.data(); if(d.phone) localStorage.setItem("taxidz_phone",d.phone); if(d.name) localStorage.setItem("taxidz_name",d.name); }
      } catch(e) { console.log("Firestore:",e); }
      onSuccess(role);
    } catch(e) { setError(errMsg(e.code)); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      <div style={{ background:C.dark, padding:"48px 24px 32px", textAlign:"center", position:"relative" }}>
        <button onClick={onBack} style={{ position:"absolute", top:48, right:20, width:36, height:36, borderRadius:10, background:"#ffffff22", border:"none", color:"#fff", cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:48, marginBottom:8 }}>{isPassenger?"🧑":"👨‍✈️"}</div>
        <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>{isPassenger?"بوابة الراكب":"بوابة السائق"}</div>
      </div>
      <div style={{ padding:"24px 20px" }}>
        <div style={{ background:"#e2ddd8", borderRadius:14, padding:4, display:"flex", marginBottom:20 }}>
          {[{id:"login",label:"🔑 تسجيل الدخول"},{id:"register",label:"✅ حساب جديد"}].map(m=>(
            <button key={m.id} onClick={()=>{setMode(m.id);setError("");}} style={{ flex:1, padding:10, borderRadius:11, border:"none", background:mode===m.id?C.card:"transparent", color:mode===m.id?C.text:C.textMuted, cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>{m.label}</button>
          ))}
        </div>
        <div style={{ background:C.card, borderRadius:24, padding:24, boxShadow:C.shadow, display:"flex", flexDirection:"column", gap:12 }}>
          {mode==="register"&&isPassenger && <input value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم الكامل" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", fontFamily:"inherit", fontSize:14, color:C.text, outline:"none", textAlign:"right" }} />}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", fontFamily:"inherit", fontSize:14, color:C.text, outline:"none", direction:"ltr", textAlign:"left" }} />
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", fontFamily:"inherit", fontSize:14, color:C.text, outline:"none", direction:"ltr", textAlign:"left" }} />
          {mode==="register"&&isPassenger && (
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ background:C.greenLight, border:`1px solid ${C.green}44`, borderRadius:14, padding:"14px 12px", fontSize:14, color:C.greenDark, fontWeight:700, whiteSpace:"nowrap" }}>🇩🇿 +213</div>
              <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))} placeholder="0XXXXXXXXX" type="tel" maxLength={10} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", fontFamily:"inherit", fontSize:14, color:C.text, outline:"none", direction:"ltr", textAlign:"left" }} />
            </div>
          )}
          {mode==="register"&&isPassenger && <div style={{ background:C.blueLight, borderRadius:12, padding:"10px 14px", fontSize:12, color:C.blue }}>📌 رقم هاتفك سيظهر للسائق عند قبول رحلتك</div>}
          {error && <div style={{ background:C.redLight, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.red, textAlign:"center" }}>{error}</div>}
          <button onClick={mode==="register"?handleRegister:handleLogin} disabled={loading} style={{ background:`linear-gradient(135deg,${accent},${accentDark})`, border:"none", borderRadius:16, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:"pointer", opacity:loading?0.7:1 }}>
            {loading?"جارٍ...":(mode==="register"?"✅ إنشاء الحساب":"🔑 تسجيل الدخول")}
          </button>
        </div>
      </div>
    </div>
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
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [noDrivers, setNoDrivers] = useState(false);
  const [timer, setTimer] = useState(0);
  const [passengerGPSLocation, setPassengerGPSLocation] = useState(null);
  const originRef = useRef(null); const destRef = useRef(null);

  const currentType = RIDE_TYPES.find(t=>t.id===rideType)||RIDE_TYPES[0];
  const passengerPhone = localStorage.getItem("taxidz_phone")||user?.phoneNumber||"";
  const passengerName = localStorage.getItem("taxidz_name")||user?.displayName||user?.email?.split("@")[0]||"مستخدم";

  useEffect(() => {
    if (distanceKm>0) { const p=calcPrice(distanceKm,currentType.multiplier); setSuggestedPrice(p); setOfferPrice(p); }
  }, [rideType,distanceKm]);

  // تتبع موقع السائق في الوقت الحقيقي
  useEffect(() => {
    if (!bookingId||(screen!=="found"&&screen!=="ride")) return;
    const unsub = onSnapshot(doc(db,"bookings",bookingId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status==="accepted"&&data.driverInfo&&screen==="searching") {
        setSelectedDriver(data.driverInfo);
        setScreen("found");
      }
      if (data.driverCurrentLocation) {
        const dLoc = data.driverCurrentLocation;
        setDriverLocation(dLoc);
        // حساب ETA
        const pLoc = passengerGPSLocation || (originPlace?getLatLng(originPlace):null);
        if (pLoc && screen==="found") {
          const dist = getDistanceKm(dLoc.lat,dLoc.lng,pLoc.lat,pLoc.lng);
          setEta(Math.max(1,Math.round(dist/0.5)));
        }
      }
    });
    return ()=>unsub();
  }, [bookingId, screen, originPlace, passengerGPSLocation]);

  // الاستماع للقبول
  useEffect(() => {
    if (!bookingId||screen!=="searching") return;
    const unsub = onSnapshot(doc(db,"bookings",bookingId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status==="accepted"&&data.driverInfo) {
        setSelectedDriver(data.driverInfo);
        setScreen("found");
      }
    });
    return ()=>unsub();
  }, [bookingId, screen]);

  useEffect(() => {
    if (screen!=="searching") return;
    const t = setInterval(()=>setTimer(p=>p+1),1000);
    return ()=>clearInterval(t);
  }, [screen]);

  useEffect(() => {
    if (screen==="searching"&&timer===60) setNoDrivers(true);
  }, [timer,screen]);

  useEffect(() => {
    if (screen!=="ride"||done) return;
    const t = setInterval(()=>setElapsed(p=>p+1),1000);
    return ()=>clearInterval(t);
  }, [screen,done]);

  const updateDistance = (lat1,lng1,lat2,lng2) => {
    const km = getDistanceKm(lat1,lng1,lat2,lng2);
    setDistanceKm(km);
    const p = calcPrice(km,currentType.multiplier);
    setSuggestedPrice(p); setOfferPrice(p);
  };

  const handleGPS = () => {
    setGpsLoading(true);
    navigator.geolocation?.getCurrentPosition(pos=>{
      const latlng = new window.google.maps.LatLng(pos.coords.latitude,pos.coords.longitude);
      setOriginPlace(latlng);
      setPassengerGPSLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});
      new window.google.maps.Geocoder().geocode({location:latlng},(results,status)=>{
        setOriginText(status==="OK"&&results[0]?results[0].formatted_address:`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setGpsLoading(false);
        if (destPlace) { const {lat:lat2,lng:lng2}=getLatLng(destPlace); updateDistance(pos.coords.latitude,pos.coords.longitude,lat2,lng2); }
      });
    },()=>{setGpsLoading(false);alert("لم نتمكن من تحديد موقعك.");});
  };

  const onOriginChanged = () => {
    if (originRef.current) { const p=originRef.current.getPlace(); if(p?.geometry){ setOriginPlace(p.geometry.location); setOriginText(p.formatted_address||p.name); if(destPlace){const{lat:lat1,lng:lng1}=getLatLng(p.geometry.location);const{lat:lat2,lng:lng2}=getLatLng(destPlace);updateDistance(lat1,lng1,lat2,lng2);}}}
  };
  const onDestChanged = () => {
    if (destRef.current) { const p=destRef.current.getPlace(); if(p?.geometry){ setDestPlace(p.geometry.location); setDestText(p.formatted_address||p.name); if(originPlace){const{lat:lat1,lng:lng1}=getLatLng(originPlace);const{lat:lat2,lng:lng2}=getLatLng(p.geometry.location);updateDistance(lat1,lng1,lat2,lng2);}}}
  };

  // إرسال الإشعار للسائقين القريبين
  const sendNotification = async (price, origin, dest, km, pLat, pLng) => {
    try {
      const driversSnap = await getDocs(query(collection(db,"drivers"), where("isOnline","==",true), where("verificationStatus","==","approved")));
      const nearbyIds = [];
      driversSnap.docs.forEach(d=>{
        const dd=d.data();
        if (dd.location&&dd.oneSignalPlayerId) {
          const dist = getDistanceKm(pLat,pLng,dd.location.lat,dd.location.lng);
          if (dist<=1.0) nearbyIds.push(dd.oneSignalPlayerId);
        }
      });
      if (nearbyIds.length===0) { console.log("لا سائقون قريبون"); return; }
      const rideTypeName = RIDE_TYPES.find(t=>t.id===rideType)?.label||"اقتصادي";
      await fetch("https://onesignal.com/api/v1/notifications",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Basic d4272ae1-f52d-4cc2-b3d4-9c5aa0653189"},
        body:JSON.stringify({
          app_id:"f9e7686d-1859-497d-a3e1-c758e3b19de6",
          include_player_ids:nearbyIds,
          headings:{ar:"🚕 طلب جديد قريب منك!",en:"🚕 New Nearby Ride!"},
          contents:{ar:"💰 "+price+" دج · "+km.toFixed(1)+" كم · "+rideTypeName+" | 📍 "+(origin||"").substring(0,40),en:"💰 "+price+" DZD · "+km.toFixed(1)+" km"},
          data:{type:"new_booking",price,distanceKm:km},
          priority:10, ttl:60,
        }),
      });
      console.log("✅ إشعار أُرسل لـ"+nearbyIds.length+" سائق");
    } catch(e) { console.log("Notification error:",e); }
  };

  const startSearch = async (price) => {
    setTimer(0); setNoDrivers(false); setDriverLocation(null);
    const originLatLng = getLatLng(originPlace);
    const destLatLng = getLatLng(destPlace);
    try {
      const ref = await addDoc(collection(db,"bookings"),{
        passengerId:user.uid, passengerName, passengerPhone,
        originText, destText,
        originLat:originLatLng.lat, originLng:originLatLng.lng,
        destLat:destLatLng.lat, destLng:destLatLng.lng,
        rideType, price, distanceKm,
        status:"pending", createdAt:serverTimestamp(),
      });
      setBookingId(ref.id);
      setBooking({originPlace,destPlace,originText,destText,rideType,price,distanceKm,passengerPhone,passengerName});
      await sendNotification(price,originText,destText,distanceKm,originLatLng.lat,originLatLng.lng);
    } catch(e) {
      console.log("Booking error:",e);
      setBooking({originPlace,destPlace,originText,destText,rideType,price,distanceKm,passengerPhone,passengerName});
    }
    setScreen("searching");
  };

  const cancelBooking = async () => {
    if (bookingId) { try { await updateDoc(doc(db,"bookings",bookingId),{status:"cancelled"}); } catch(e){} }
    setBookingId(null); setScreen("home");
  };

  // HOME
  if (screen==="home") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      <div style={{ padding:"48px 20px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:13, color:C.textMuted }}>مرحباً 👋</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{passengerName}</div>
          {passengerPhone&&<div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>📱 {passengerPhone}</div>}
        </div>
        <button onClick={onLogout} style={{ width:40, height:40, borderRadius:12, background:C.redLight, border:"none", cursor:"pointer", fontSize:16 }}>🚪</button>
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
      {distanceKm>0 && (
        <div style={{ display:"flex", gap:8, margin:"10px 20px 0", justifyContent:"center" }}>
          <div style={{ background:C.greenLight, borderRadius:20, padding:"6px 14px", fontSize:13, color:C.greenDark, fontWeight:700 }}>📏 {distanceKm.toFixed(1)} كم</div>
          <div style={{ background:C.orangeLight, borderRadius:20, padding:"6px 14px", fontSize:14, color:C.orange, fontWeight:900 }}>💰 {suggestedPrice} دج</div>
        </div>
      )}
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
          <div key={t.id} onClick={()=>setRideType(t.id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderRadius:14, border:`2px solid ${rideType===t.id?C.green:C.border}`, background:rideType===t.id?C.greenLight:C.bg, cursor:"pointer", marginBottom:8 }}>
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
        <div><div style={{ fontWeight:800, fontSize:18, color:C.text }}>عرض السعر 💰</div><div style={{ fontSize:12, color:C.textMuted }}>40 + {distanceKm.toFixed(1)} كم × {PRICE_PER_KM} دج = {suggestedPrice} دج</div></div>
      </div>
      <div style={{ margin:"0 20px 14px", background:C.card, borderRadius:24, padding:24, boxShadow:C.shadow, textAlign:"center" }}>
        <div style={{ fontSize:13, color:C.textMuted, marginBottom:4 }}>سعرك المقترح</div>
        <div style={{ fontSize:64, fontWeight:900, color:offerPrice>suggestedPrice?C.blue:C.green, lineHeight:1 }}>{offerPrice}</div>
        <div style={{ fontSize:18, color:C.textMuted, marginBottom:20 }}>دينار جزائري</div>
        <input type="range" min={suggestedPrice} max={Math.round(suggestedPrice*2)} step={10} value={offerPrice} onChange={e=>setOfferPrice(Number(e.target.value))} style={{ width:"100%", accentColor:C.green, cursor:"pointer", marginBottom:8, height:6 }} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.textLight }}>
          <span style={{ color:C.green, fontWeight:700 }}>الحد الأدنى: {suggestedPrice} دج</span>
          <span>{Math.round(suggestedPrice*2)} دج</span>
        </div>
        <div style={{ background:C.greenLight, borderRadius:12, padding:"8px 14px", marginTop:12, fontSize:12, color:C.greenDark }}>ℹ️ يمكنك رفع السعر لزيادة فرصة القبول</div>
      </div>
      <div style={{ margin:"0 20px 14px", background:C.card, borderRadius:20, padding:18, boxShadow:C.shadow }}>
        <div style={{ fontWeight:700, fontSize:13, color:C.text, marginBottom:10 }}>اقتراحات سريعة</div>
        <div style={{ display:"flex", gap:8 }}>
          {[{label:"السعر المحسوب ⭐",value:suggestedPrice,color:C.green},{label:"زيادة 20% 🔥",value:Math.round(suggestedPrice*1.2),color:C.orange},{label:"زيادة 50% 💎",value:Math.round(suggestedPrice*1.5),color:C.blue}].map((s,i)=>(
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
      {noDrivers && (
        <div style={{ margin:"14px 20px", background:C.orangeLight, borderRadius:20, padding:20, border:`1px solid ${C.orange}44`, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:8 }}>😔</div>
          <div style={{ fontWeight:800, color:C.orange, fontSize:16, marginBottom:8 }}>لم يقبل أي سائق عرضك</div>
          <div style={{ fontSize:13, color:C.textMuted, marginBottom:16 }}>يمكنك زيادة السعر لجذب السائقين</div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>{setOfferPrice(Math.round((booking?.price||suggestedPrice)*1.2));setScreen("offer");}} style={{ flex:1, background:`linear-gradient(135deg,${C.orange},#ea580c)`, border:"none", borderRadius:14, padding:"12px", color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:"pointer", fontSize:14 }}>💰 زيادة السعر</button>
            <button onClick={cancelBooking} style={{ flex:1, background:C.redLight, border:"none", borderRadius:14, padding:"12px", color:C.red, fontFamily:"inherit", fontWeight:700, cursor:"pointer", fontSize:14 }}>❌ إلغاء</button>
          </div>
        </div>
      )}
      {!noDrivers && <div style={{ margin:"14px 20px" }}><button onClick={cancelBooking} style={{ width:"100%", background:C.redLight, border:"none", borderRadius:14, padding:"12px", color:C.red, fontFamily:"inherit", fontWeight:700, cursor:"pointer", fontSize:14 }}>❌ إلغاء الطلب</button></div>}
    </div>
  );

  // FOUND - مع خريطة GPS للراكب
  if (screen==="found") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      <PassengerTrackingMap
        passengerLocation={passengerGPSLocation || (originPlace?getLatLng(originPlace):null)}
        driverLocation={driverLocation}
        destinationLocation={destPlace?getLatLng(destPlace):null}
        mode="pickup"
      />
      <div style={{ margin:"14px 20px", background:C.card, borderRadius:24, padding:22, boxShadow:C.shadow }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:44 }}>🎉</div>
          <div style={{ fontWeight:900, fontSize:20, color:C.text }}>تم قبول طلبك!</div>
          {eta && <div style={{ background:C.greenLight, borderRadius:12, padding:"6px 16px", marginTop:8, display:"inline-block" }}><span style={{ fontSize:15, fontWeight:800, color:C.greenDark }}>⏱ ~{eta} دقيقة للوصول</span></div>}
        </div>
        <div style={{ background:C.bg, borderRadius:16, padding:16, marginBottom:14 }}>
          <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10 }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:C.dark, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, overflow:"hidden" }}>
              {selectedDriver?.selfieUrl?<img src={selectedDriver.selfieUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />:"👨‍✈️"}
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{selectedDriver?.name||"السائق"}</div>
              <div style={{ fontSize:12, color:C.textMuted }}>⭐ {selectedDriver?.rating||"جديد"} · {selectedDriver?.carBrand} {selectedDriver?.carModel}</div>
              <div style={{ fontSize:11, color:C.textLight }}>{selectedDriver?.plateNumber}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1, background:C.greenLight, borderRadius:12, padding:10, textAlign:"center" }}>
              <div style={{ fontWeight:900, fontSize:18, color:C.greenDark }}>{booking?.price} دج</div>
              <div style={{ fontSize:11, color:C.green }}>السعر</div>
            </div>
            <div style={{ flex:1, background:C.blueLight, borderRadius:12, padding:10, textAlign:"center" }}>
              <div style={{ fontWeight:900, fontSize:18, color:C.blue }}>{booking?.distanceKm?.toFixed(1)} كم</div>
              <div style={{ fontSize:11, color:C.blue }}>المسافة</div>
            </div>
          </div>
        </div>
        {selectedDriver?.phone && (
          <a href={`tel:${selectedDriver.phone}`} style={{ display:"flex", alignItems:"center", gap:10, background:C.greenLight, border:`1px solid ${C.green}44`, borderRadius:12, padding:"12px 14px", marginBottom:14, textDecoration:"none" }}>
            <span style={{ fontSize:22 }}>📞</span>
            <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.textMuted }}>رقم السائق</div><div style={{ fontSize:16, fontWeight:900, color:C.green, direction:"ltr" }}>{selectedDriver.phone}</div></div>
            <div style={{ background:C.green, borderRadius:8, padding:"6px 12px", fontSize:12, color:"#fff", fontWeight:700 }}>☎️</div>
          </a>
        )}
        <div style={{ background:C.dark, borderRadius:14, padding:14, marginBottom:14, textAlign:"center" }}>
          <div style={{ fontSize:11, color:"#ffffff88", marginBottom:6 }}>رمز التحقق</div>
          <div style={{ fontSize:34, fontWeight:900, color:"#fff", letterSpacing:8 }}>{Math.floor(1000+Math.random()*9000)}</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={cancelBooking} style={{ flex:1, background:C.redLight, border:"none", borderRadius:12, padding:14, color:C.red, fontFamily:"inherit", fontWeight:700, cursor:"pointer" }}>❌ إلغاء</button>
          <button onClick={()=>{setElapsed(0);setDone(false);setScreen("ride");}} style={{ flex:2, background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:12, padding:14, color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:"pointer" }}>📱 تتبع الرحلة</button>
        </div>
      </div>
    </div>
  );

  // RIDE - مع خريطة GPS
  if (screen==="ride") {
    const mins=Math.floor(elapsed/60), secs=elapsed%60;
    if (done) return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:16 }}>
        <div style={{ fontSize:64 }}>🏁</div>
        <div style={{ fontWeight:900, fontSize:24, color:C.text }}>وصلت بسلام!</div>
        <div style={{ background:C.card, borderRadius:24, padding:24, width:"100%", boxShadow:C.shadow, textAlign:"center" }}>
          <div style={{ fontWeight:700, marginBottom:12, color:C.text }}>قيّم رحلتك</div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:18 }}>
            {[1,2,3,4,5].map(s=><div key={s} onClick={()=>setRating(s)} style={{ fontSize:34, cursor:"pointer", opacity:s<=rating?1:0.25 }}>⭐</div>)}
          </div>
          <div style={{ background:C.greenLight, borderRadius:14, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:26, fontWeight:900, color:C.greenDark }}>{booking?.price} دج</div>
            <div style={{ fontSize:13, color:C.green }}>{booking?.distanceKm?.toFixed(1)} كم</div>
          </div>
          <button onClick={()=>{setScreen("home");setRating(0);setDistanceKm(0);setSuggestedPrice(MIN_PRICE);setBookingId(null);}} style={{ width:"100%", background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:14, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:"pointer" }}>✅ إنهاء</button>
        </div>
      </div>
    );
    return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
        <PassengerTrackingMap
          passengerLocation={passengerGPSLocation||(originPlace?getLatLng(originPlace):null)}
          driverLocation={driverLocation}
          destinationLocation={destPlace?getLatLng(destPlace):null}
          mode="ride"
        />
        <div style={{ margin:"14px 20px", background:C.card, borderRadius:24, padding:20, boxShadow:C.shadow }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ background:C.greenLight, borderRadius:12, padding:"8px 14px" }}>
              <div style={{ fontSize:10, color:C.green }}>الوقت</div>
              <div style={{ fontWeight:800, color:C.greenDark }}>{mins}:{secs.toString().padStart(2,"0")}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.textMuted }}>الوجهة</div>
              <div style={{ fontWeight:700, color:C.text, fontSize:13, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{destText}</div>
            </div>
            <div style={{ background:C.dark, borderRadius:12, padding:"8px 14px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#ffffff88" }}>السعر</div>
              <div style={{ fontWeight:800, color:"#fff" }}>{booking?.price} دج</div>
            </div>
          </div>
          {/* زر تتبع مسار الرحلة للراكب */}
          {destPlace && (
            <button
              onClick={() => { const d=getLatLng(destPlace); openNavigation(d.lat, d.lng); }}
              style={{ width:"100%", background:`linear-gradient(135deg,#1a73e8,#0d47a1)`, border:"none", borderRadius:14, padding:14, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span style={{ fontSize:20 }}>🗺️</span> تتبع مسار الرحلة — Google Maps
            </button>
          )}
          <button onClick={()=>setDone(true)} style={{ width:"100%", background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:14, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:"pointer" }}>🏁 وصلت</button>
        </div>
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
    const unsub = onAuthStateChanged(auth, u => {
      if (u) { setUser(u); const r=localStorage.getItem("taxidz_role"); if(r){setRole(r);setScreen("app");} }
      else { setUser(null);setRole(null);setScreen("welcome");localStorage.removeItem("taxidz_role"); }
    });
    return ()=>unsub();
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); } catch(e){}
    setUser(null);setRole(null);setScreen("welcome");
    ["taxidz_role","taxidz_phone","taxidz_name"].forEach(k=>localStorage.removeItem(k));
  };

  const handleAuthSuccess = (r) => { setRole(r); localStorage.setItem("taxidz_role",r); setScreen("app"); };

  if (loadError) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, fontFamily:"'Cairo',sans-serif" }}><div style={{ textAlign:"center" }}><div style={{ fontSize:48 }}>⚠️</div><div style={{ fontWeight:800, fontSize:18, color:C.text }}>خطأ في تحميل الخريطة</div></div></div>;
  if (!isLoaded) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, fontFamily:"'Cairo',sans-serif" }}><div style={{ textAlign:"center" }}><div style={{ fontSize:48, marginBottom:8 }}>🗺️</div><div style={{ fontWeight:700, color:C.text }}>جارٍ تحميل التطبيق...</div></div></div>;

  return (
    <div style={{ maxWidth:390, margin:"0 auto", minHeight:"100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      {screen==="welcome" && <WelcomeScreen onSelect={r=>{setRole(r);setScreen("auth");}} />}
      {screen==="auth" && <AuthForm role={role} onSuccess={handleAuthSuccess} onBack={()=>{setRole(null);setScreen("welcome");}} />}
      {screen==="app"&&role==="passenger" && <PassengerApp onLogout={handleLogout} user={user} />}
      {screen==="app"&&role==="driver" && <DriverDashboard user={user} onLogout={handleLogout} />}
    </div>
  );
}
