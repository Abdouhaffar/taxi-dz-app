/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, requestNotificationPermission, onForegroundMessage } from "./firebase";
import {
  signOut, onAuthStateChanged, updateProfile, signInWithCustomToken
} from "firebase/auth";
import {
  doc, setDoc, getDoc, serverTimestamp, addDoc, collection,
  onSnapshot, updateDoc, getDocs, query, where, orderBy, limit, increment
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Cloud Functions منشورة على europe-west1 — غيّر المنطقة إذا نشرت في مكان آخر
const cloudFunctions = getFunctions(undefined, "europe-west1");
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Autocomplete } from "@react-google-maps/api";
import DriverDashboard from "./DriverDashboard";

const LIBRARIES = ["places"];

// ===== SESSION MANAGEMENT =====
const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
const SESSION_KEY = "taxidz_session_id";
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

const openNavigation = (lat, lng) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`, "_blank");

// ===== TRANSLATIONS =====
const T = {
  ar: {
    appTagline:"البُراق · فاوض على سعرك 🇩🇿", pricing:"40 دج + 30 دج/كم",
    passenger:"راكب", passengerSub:"أبحث عن سيارة أجرة",
    driver:"سائق", driverSub:"أقدم خدمة النقل",
    login:"🔑 تسجيل الدخول", register:"✅ حساب جديد",
    passengerGate:"بوابة الراكب", driverGate:"بوابة السائق",
    fullName:"الاسم الكامل", email:"البريد الإلكتروني",
    password:"كلمة المرور", phone:"رقم الهاتف",
    referralCode:"كود الإحالة (اختياري)",
    phoneNote:"📌 رقمك سيظهر للسائق عند قبول رحلتك",
    createAccount:"✅ إنشاء الحساب", signIn:"🔑 تسجيل الدخول",
    loading:"جارٍ...", hello:"مرحباً 👋",
    whereGo:"إلى أين تريد الذهاب؟ 🚕",
    searchCar:"🚀 ابحث عن سيارة", searchDest:"ابحث عن وجهتك...",
    tripDetails:"تفاصيل الرحلة", useMyLocation:"استخدم موقعي الحالي",
    locating:"جارٍ تحديد موقعك...", departure:"نقطة الانطلاق...",
    destination:"إلى أين؟ مثال: حيدرة...", carType:"نوع السيارة",
    economy:"اقتصادي", comfort:"مريح", xl:"XL كبير",
    offerPrice:"عرض السعر 💰", yourOffer:"سعرك المقترح",
    dzd:"دينار جزائري", minPrice:"الحد الأدنى:",
    calculated:"المحسوب ⭐", up20:"+20% 🔥", up50:"+50% 💎",
    sendOffer:"🚀 إرسال العرض للسائقين",
    searching:"📡 جارٍ البحث عن سائق...",
    yourOffer2:"عرضك:", noDrivers:"لم يقبل أي سائق",
    raisePrice:"💰 زيادة السعر", cancel:"❌ إلغاء",
    cancelTrip:"❌ إلغاء الطلب", accepted:"تم قبول طلبك!",
    driverComing:"السائق في طريقه إليك",
    etaMin:"دقيقة للوصول", verifyCode:"رمز التحقق",
    giveDriver:"أعطه للسائق", driverPhone:"رقم السائق",
    call:"☎️", cancelBtn:"❌ إلغاء", trackTrip:"📱 تتبع الرحلة",
    tripOngoing:"رحلة جارية 🏎️", drivercoming:"السائق قادم 🚕",
    tripDuration:"مدة الرحلة", dest:"الوجهة", price:"السعر",
    trackRoute:"🗺️ تتبع مسار الرحلة — Google Maps",
    arrived:"🏁 وصلت", rateTrip:"قيّم رحلتك", skip:"تخطي",
    sendRating:"✅ إرسال التقييم", thankRating:"شكراً على تقييمك!",
    backHome:"🏠 العودة للرئيسية", logout:"🚪",
    pricingFormula:"40 دج + 30 دج/كم 🤝",
    wallet:"💰 محفظتي", points:"نقاطي",
    referral:"🎁 الإحالة", referralDesc:"شارك كودك واكسب نقاط",
    chat:"💬 المحادثة", typeMessage:"اكتب رسالة...",
    send:"إرسال", history:"📋 سجل رحلاتي",
    forgotPass:"🔐 نسيت كلمة المرور؟",
    resetSent:"تم إرسال رابط الاسترجاع لبريدك!",
    resetEmail:"أدخل بريدك الإلكتروني",
    sendReset:"📧 إرسال الرابط",
  },
  fr: {
    appTagline:"AL-BURAQ · Négociez votre prix 🇩🇿", pricing:"40 DA + 30 DA/km",
    passenger:"Passager", passengerSub:"Je cherche un taxi",
    driver:"Chauffeur", driverSub:"Je propose un service",
    login:"🔑 Se connecter", register:"✅ Nouveau compte",
    passengerGate:"Espace Passager", driverGate:"Espace Chauffeur",
    fullName:"Nom complet", email:"Adresse e-mail",
    password:"Mot de passe", phone:"Numéro de téléphone",
    referralCode:"Code de parrainage (optionnel)",
    phoneNote:"📌 Votre numéro sera partagé avec le chauffeur",
    createAccount:"✅ Créer le compte", signIn:"🔑 Se connecter",
    loading:"Chargement...", hello:"Bonjour 👋",
    whereGo:"Où voulez-vous aller? 🚕",
    searchCar:"🚀 Chercher un taxi", searchDest:"Cherchez votre destination...",
    tripDetails:"Détails du trajet", useMyLocation:"Utiliser ma position",
    locating:"Localisation...", departure:"Point de départ...",
    destination:"Destination? Ex: Hydra...", carType:"Type de voiture",
    economy:"Économique", comfort:"Confort", xl:"XL Grand",
    offerPrice:"Proposer un prix 💰", yourOffer:"Votre offre",
    dzd:"Dinars algériens", minPrice:"Minimum:",
    calculated:"Calculé ⭐", up20:"+20% 🔥", up50:"+50% 💎",
    sendOffer:"🚀 Envoyer l'offre aux chauffeurs",
    searching:"📡 Recherche d'un chauffeur...",
    yourOffer2:"Votre offre:", noDrivers:"Aucun chauffeur n'a accepté",
    raisePrice:"💰 Augmenter le prix", cancel:"❌ Annuler",
    cancelTrip:"❌ Annuler la demande", accepted:"Demande acceptée!",
    driverComing:"Le chauffeur est en route",
    etaMin:"min d'arrivée", verifyCode:"Code de vérification",
    giveDriver:"Donnez-le au chauffeur", driverPhone:"Tél chauffeur",
    call:"☎️", cancelBtn:"❌ Annuler", trackTrip:"📱 Suivre le trajet",
    tripOngoing:"Trajet en cours 🏎️", drivercoming:"Chauffeur arrive 🚕",
    tripDuration:"Durée", dest:"Destination", price:"Prix",
    trackRoute:"🗺️ Suivre l'itinéraire — Google Maps",
    arrived:"🏁 Arrivé", rateTrip:"Évaluez votre trajet", skip:"Passer",
    sendRating:"✅ Envoyer l'évaluation", thankRating:"Merci pour votre avis!",
    backHome:"🏠 Retour", logout:"🚪",
    pricingFormula:"40 DA + 30 DA/km 🤝",
    wallet:"💰 Mon portefeuille", points:"Mes points",
    referral:"🎁 Parrainage", referralDesc:"Partagez votre code et gagnez des points",
    chat:"💬 Discussion", typeMessage:"Tapez un message...",
    send:"Envoyer", history:"📋 Historique",
    forgotPass:"🔐 Mot de passe oublié?",
    resetSent:"Lien envoyé à votre email!",
    resetEmail:"Votre adresse email",
    sendReset:"📧 Envoyer le lien",
  },
  en: {
    appTagline:"AL-BURAQ · Negotiate your price 🇩🇿", pricing:"40 DA + 30 DA/km",
    passenger:"Passenger", passengerSub:"Looking for a taxi",
    driver:"Driver", driverSub:"Offering transport service",
    login:"🔑 Sign in", register:"✅ New account",
    passengerGate:"Passenger Portal", driverGate:"Driver Portal",
    fullName:"Full name", email:"Email address",
    password:"Password", phone:"Phone number",
    referralCode:"Referral code (optional)",
    phoneNote:"📌 Your number will be shared with the driver",
    createAccount:"✅ Create account", signIn:"🔑 Sign in",
    loading:"Loading...", hello:"Hello 👋",
    whereGo:"Where do you want to go? 🚕",
    searchCar:"🚀 Find a taxi", searchDest:"Search your destination...",
    tripDetails:"Trip details", useMyLocation:"Use my location",
    locating:"Locating...", departure:"Departure point...",
    destination:"Where to? E.g. Hydra...", carType:"Car type",
    economy:"Economy", comfort:"Comfort", xl:"XL Large",
    offerPrice:"Price offer 💰", yourOffer:"Your offer",
    dzd:"Algerian Dinars", minPrice:"Minimum:",
    calculated:"Calculated ⭐", up20:"+20% 🔥", up50:"+50% 💎",
    sendOffer:"🚀 Send offer to drivers",
    searching:"📡 Searching for a driver...",
    yourOffer2:"Your offer:", noDrivers:"No driver accepted",
    raisePrice:"💰 Raise price", cancel:"❌ Cancel",
    cancelTrip:"❌ Cancel request", accepted:"Request accepted!",
    driverComing:"Driver is on his way",
    etaMin:"min ETA", verifyCode:"Verification code",
    giveDriver:"Show this to the driver", driverPhone:"Driver phone",
    call:"☎️", cancelBtn:"❌ Cancel", trackTrip:"📱 Track trip",
    tripOngoing:"Trip ongoing 🏎️", drivercoming:"Driver coming 🚕",
    tripDuration:"Duration", dest:"Destination", price:"Price",
    trackRoute:"🗺️ Track route — Google Maps",
    arrived:"🏁 Arrived", rateTrip:"Rate your trip", skip:"Skip",
    sendRating:"✅ Submit rating", thankRating:"Thanks for your rating!",
    backHome:"🏠 Back to home", logout:"🚪",
    pricingFormula:"40 DA + 30 DA/km 🤝",
    wallet:"💰 My Wallet", points:"My Points",
    referral:"🎁 Referral", referralDesc:"Share your code and earn points",
    chat:"💬 Chat", typeMessage:"Type a message...",
    send:"Send", history:"📋 Trip History",
    forgotPass:"🔐 Forgot password?",
    resetSent:"Reset link sent to your email!",
    resetEmail:"Your email address",
    sendReset:"📧 Send link",
  },
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
  bg:"#f7f3ee", card:"#ffffff", dark:"#0a0f1e",
  green:"#00b37e", greenLight:"#e6f9f3", greenDark:"#007a55",
  orange:"#f97316", orangeLight:"#fff4ed",
  red:"#ef4444", redLight:"#fef2f2",
  blue:"#3b82f6", blueLight:"#eff6ff",
  yellow:"#f59e0b", yellowLight:"#fef9c3",
  gold:"#d4a017", goldLight:"#fff8e1",
  googleBlue:"#1a73e8",
  text:"#1a1a2e", textMuted:"#64748b", textLight:"#94a3b8",
  border:"#e8e3db", shadow:"0 4px 24px rgba(0,0,0,0.08)",
};

const RIDE_TYPES_IDS = ["economy","comfort","xl"];
const RIDE_MULTIPLIERS = { economy:1.0, comfort:1.4, xl:1.8 };
const RIDE_ICONS = { economy:"🚗", comfort:"🚙", xl:"🚐" };
const RIDE_TIMES = { economy:"3", comfort:"5", xl:"7" };

const REPORT_REASONS = {
  ar:["سلوك غير لائق","قيادة متهورة","رفض الرحلة بعد القبول","طلب مبالغ","تحرش","سرقة","أخرى"],
  fr:["Comportement inapproprié","Conduite dangereuse","Refus de trajet","Prix excessif","Harcèlement","Vol","Autre"],
  en:["Inappropriate behavior","Dangerous driving","Trip refusal","Excessive price","Harassment","Theft","Other"],
};

// ===== HELPERS =====
function BackBtn({ onBack }) {
  return <button onClick={onBack} style={{ width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>←</button>;
}

function StarRating({ rating, onRate, size=32 }) {
  const [hover,setHover]=useState(0);
  return (
    <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
      {[1,2,3,4,5].map(s=>(
        <span key={s} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} onClick={()=>onRate&&onRate(s)}
          style={{ fontSize:size, cursor:onRate?"pointer":"default", opacity:(hover||rating)>=s?1:0.2, transition:"all 0.15s" }}>⭐</span>
      ))}
    </div>
  );
}

// ===== LANGUAGE SWITCHER =====
function LanguageSwitcher({ lang, setLang }) {
  return (
    <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:16 }}>
      {[{code:"ar",flag:"🇩🇿"},{code:"fr",flag:"🇫🇷"},{code:"en",flag:"🇬🇧"}].map(l=>(
        <button key={l.code} onClick={()=>setLang(l.code)}
          style={{ padding:"6px 12px", borderRadius:20, border:`1.5px solid ${lang===l.code?C.green:C.border}`, background:lang===l.code?C.greenLight:"transparent", color:lang===l.code?C.greenDark:C.textMuted, fontFamily:"inherit", fontWeight:lang===l.code?700:400, fontSize:13, cursor:"pointer" }}>
          {l.flag}
        </button>
      ))}
    </div>
  );
}

// ===== FCM TOAST =====
function NotificationToast({ notification, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,5000); return()=>clearTimeout(t); },[onClose]);
  if (!notification) return null;
  return (
    <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", width:"calc(100% - 40px)", maxWidth:370, background:C.dark, borderRadius:16, padding:"14px 18px", boxShadow:"0 8px 32px rgba(0,0,0,0.3)", zIndex:9999, fontFamily:"Cairo,sans-serif", direction:"rtl", display:"flex", gap:12, alignItems:"center", border:`1px solid ${C.green}44`, animation:"slideDown 0.3s ease" }}>
      <div style={{ fontSize:28 }}>🔔</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:800, fontSize:14, color:"#fff" }}>{notification.title}</div>
        <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{notification.body}</div>
      </div>
      <button onClick={onClose} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer", fontSize:18 }}>✕</button>
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

// ===== REPORT MODAL =====
function ReportModal({ targetId, targetName, targetType, reporterId, reporterName, onClose, lang }) {
  const isRTL=lang==="ar";
  const reasons=REPORT_REASONS[lang];
  const [selected,setSelected]=useState("");
  const [custom,setCustom]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const handleSubmit=async()=>{
    if(!selected) return;
    setSaving(true);
    try { await addDoc(collection(db,"reports"),{ targetId,targetName,targetType,reporterId,reporterName,reason:selected===(lang==="ar"?"أخرى":lang==="fr"?"Autre":"Other")?custom:selected,status:"pending",createdAt:serverTimestamp() }); setDone(true); } catch(e){}
    setSaving(false);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.card,borderRadius:"24px 24px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:430,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
        {done?(
          <div style={{ textAlign:"center",padding:"20px 0" }}>
            <div style={{ fontSize:56,marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:8 }}>{lang==="ar"?"تم إرسال التبليغ":lang==="fr"?"Signalement envoyé":"Report submitted"}</div>
            <button onClick={onClose} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:"12px 32px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer" }}>OK</button>
          </div>
        ):(
          <>
            <div style={{ textAlign:"center",marginBottom:20 }}><div style={{ fontSize:40,marginBottom:8 }}>🚨</div><div style={{ fontWeight:900,fontSize:18,color:C.text }}>{lang==="ar"?`تبليغ عن ${targetName}`:`Report ${targetName}`}</div></div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
              {reasons.map((r,i)=>(
                <div key={i} onClick={()=>setSelected(r)} style={{ padding:"12px 16px",borderRadius:12,border:`2px solid ${selected===r?C.red:C.border}`,background:selected===r?C.redLight:C.bg,cursor:"pointer",fontSize:14,color:selected===r?C.red:C.text,fontWeight:selected===r?700:500,display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",border:`2px solid ${selected===r?C.red:C.textLight}`,background:selected===r?C.red:"transparent",flexShrink:0 }} />{r}
                </div>
              ))}
            </div>
            {selected===(lang==="ar"?"أخرى":lang==="fr"?"Autre":"Other")&&<textarea value={custom} onChange={e=>setCustom(e.target.value)} rows={3} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",resize:"none",marginBottom:12 }} />}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={onClose} style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:14,color:C.textMuted,fontFamily:"inherit",fontWeight:600,cursor:"pointer" }}>{lang==="ar"?"إلغاء":"Annuler"}</button>
              <button onClick={handleSubmit} disabled={!selected||saving} style={{ flex:2,background:selected?`linear-gradient(135deg,${C.red},#dc2626)`:C.border,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:selected?"pointer":"default" }}>
                {saving?"...":`🚨 ${lang==="ar"?"إرسال":"Signaler"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== PASSWORD RESET =====
function PasswordResetModal({ onClose, lang }) {
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const t=T[lang];
  const handleReset=async()=>{
    if(!email){setError(lang==="ar"?"أدخل بريدك":"Saisissez votre email");return;}
    setLoading(true);setError("");
    try { const{sendPasswordResetEmail}=await import("firebase/auth"); await sendPasswordResetEmail(auth,email); setSent(true); }
    catch(e){setError(lang==="ar"?"البريد غير موجود":"Email introuvable");}
    setLoading(false);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)",padding:20 }}>
      <div style={{ background:C.card,borderRadius:24,padding:28,width:"100%",maxWidth:380,fontFamily:"Cairo,sans-serif",direction:lang==="ar"?"rtl":"ltr" }}>
        {sent?(
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:56,marginBottom:12 }}>📧</div>
            <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:8 }}>{t.resetSent}</div>
            <button onClick={onClose} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:"12px 32px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer" }}>OK</button>
          </div>
        ):(
          <>
            <div style={{ textAlign:"center",marginBottom:20 }}><div style={{ fontSize:48,marginBottom:8 }}>🔐</div><div style={{ fontWeight:900,fontSize:18,color:C.text }}>{t.forgotPass}</div></div>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={t.resetEmail} type="email" style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",direction:"ltr",textAlign:"left",marginBottom:12 }} />
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,marginBottom:12 }}>{error}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={onClose} style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:14,color:C.textMuted,fontFamily:"inherit",fontWeight:600,cursor:"pointer" }}>{lang==="ar"?"إلغاء":"Annuler"}</button>
              <button onClick={handleReset} disabled={loading} style={{ flex:2,background:`linear-gradient(135deg,${C.blue},#1d4ed8)`,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",opacity:loading?0.7:1 }}>
                {loading?"...":t.sendReset}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== RATING MODAL =====
function RatingModal({ booking, driver, onSubmit, onSkip, lang }) {
  const t=T[lang];
  const [rating,setRating]=useState(0);
  const [comment,setComment]=useState("");
  const [saving,setSaving]=useState(false);
  const handleSubmit=async()=>{
    if(!rating) return;
    setSaving(true);
    try {
      await addDoc(collection(db,"ratings"),{ bookingId:booking?.id,driverId:booking?.driverId,passengerId:booking?.passengerId,rating,comment,type:"passenger_to_driver",createdAt:serverTimestamp() });
      if(booking?.driverId){
        const dSnap=await getDoc(doc(db,"drivers",booking.driverId));
        if(dSnap.exists()){const d=dSnap.data();const n=(d.totalRatings||0)+1;await updateDoc(doc(db,"drivers",booking.driverId),{rating:Math.round(((d.rating||0)*(d.totalRatings||0)+rating)/n*10)/10,totalRatings:n});}
      }
      if(booking?.id) await updateDoc(doc(db,"bookings",booking.id),{passengerRating:rating,status:"rated"});
      // نقاط للراكب (5 نقاط لكل رحلة مكتملة)
      if(booking?.passengerId) await updateDoc(doc(db,"passengers",booking.passengerId),{points:increment(5),totalRides:increment(1)});
    } catch(e){console.log(e);}
    setSaving(false); onSubmit(rating);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.card,borderRadius:"24px 24px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:430,fontFamily:"Cairo,sans-serif",direction:lang==="ar"?"rtl":"ltr" }}>
        <div style={{ textAlign:"center",marginBottom:20 }}>
          <div style={{ fontSize:52,marginBottom:8 }}>🏁</div>
          <div style={{ fontWeight:900,fontSize:22,color:C.text }}>{driver?.name||"👨‍✈️"}</div>
          <div style={{ fontSize:13,color:C.textMuted,marginTop:4 }}>{t.rateTrip}</div>
          <div style={{ background:C.goldLight,borderRadius:12,padding:"6px 14px",marginTop:8,display:"inline-block",fontSize:12,color:C.gold,fontWeight:700 }}>🌟 +5 نقاط للتقييم!</div>
        </div>
        <StarRating rating={rating} onRate={setRating} size={40} />
        {rating>0&&<textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",resize:"none",marginTop:16 }} />}
        <div style={{ display:"flex",gap:10,marginTop:16 }}>
          <button onClick={onSkip} style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:14,color:C.textMuted,fontFamily:"inherit",fontWeight:600,cursor:"pointer" }}>{t.skip}</button>
          <button onClick={handleSubmit} disabled={!rating||saving} style={{ flex:2,background:rating?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:rating?"pointer":"default" }}>
            {saving?t.loading:t.sendRating}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== CHAT COMPONENT =====
function ChatBox({ bookingId, userId, userName, otherName, lang, onClose }) {
  const t=T[lang];
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState("");
  const bottomRef=useRef(null);
  const isRTL=lang==="ar";

  useEffect(()=>{
    if(!bookingId) return;
    const q=query(collection(db,"chats",bookingId,"messages"),orderBy("createdAt","asc"));
    const u=onSnapshot(q,snap=>setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>u();
  },[bookingId]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const sendMsg=async()=>{
    if(!text.trim()||!bookingId) return;
    const msg=text.trim(); setText("");
    try { await addDoc(collection(db,"chats",bookingId,"messages"),{ text:msg, senderId:userId, senderName:userName, createdAt:serverTimestamp() }); }
    catch(e){console.log(e);}
  };

  return (
    <div style={{ position:"fixed",inset:0,background:C.bg,zIndex:1500,display:"flex",flexDirection:"column",fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
      {/* Header */}
      <div style={{ background:C.dark,padding:"48px 20px 16px",display:"flex",alignItems:"center",gap:12 }}>
        <button onClick={onClose} style={{ width:36,height:36,borderRadius:10,background:"#ffffff22",border:"none",color:"#fff",cursor:"pointer",fontSize:16 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800,fontSize:16,color:"#fff" }}>{t.chat}</div>
          <div style={{ fontSize:12,color:"#ffffff66" }}>{otherName}</div>
        </div>
        <div style={{ width:10,height:10,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite" }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>

      {/* Messages */}
      <div style={{ flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10 }}>
        {messages.length===0&&(
          <div style={{ textAlign:"center",padding:"40px 0",color:C.textMuted,fontSize:13 }}>
            {lang==="ar"?"ابدأ المحادثة مع "+otherName:"Start chatting with "+otherName}
          </div>
        )}
        {messages.map(m=>{
          const isMe=m.senderId===userId;
          return (
            <div key={m.id} style={{ display:"flex",justifyContent:isMe?(isRTL?"flex-start":"flex-end"):(isRTL?"flex-end":"flex-start") }}>
              <div style={{ maxWidth:"75%",background:isMe?`linear-gradient(135deg,${C.green},${C.greenDark})`:"#fff",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",boxShadow:C.shadow }}>
                <div style={{ fontSize:14,color:isMe?"#fff":C.text,fontWeight:500 }}>{m.text}</div>
                <div style={{ fontSize:10,color:isMe?"#ffffff88":C.textLight,marginTop:4,textAlign:"left" }}>
                  {m.createdAt?.toDate?.()?.toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"})||""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background:"#fff",padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center" }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder={t.typeMessage}
          style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:24,padding:"12px 18px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",direction:isRTL?"rtl":"ltr" }} />
        <button onClick={sendMsg} disabled={!text.trim()} style={{ width:46,height:46,borderRadius:"50%",background:text.trim()?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border,border:"none",cursor:text.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>
          {isRTL?"➤":"➤"}
        </button>
      </div>
    </div>
  );
}

// ===== WALLET SCREEN =====
function WalletScreen({ userId, passengerData, lang, onBack }) {
  const t=T[lang];
  const isRTL=lang==="ar";
  const [rides,setRides]=useState([]);
  const points=passengerData?.points||0;
  const totalRides=passengerData?.totalRides||0;
  const referralCode=passengerData?.referralCode||"—";

  useEffect(()=>{
    const fetchRides=async()=>{
      try {
        const q=query(collection(db,"bookings"),where("passengerId","==",userId),orderBy("createdAt","desc"),limit(10));
        const snap=await getDocs(q);
        setRides(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch(e){console.log(e);}
    };
    fetchRides();
  },[userId]);

  const copyCode=()=>{
    navigator.clipboard?.writeText(referralCode).catch(()=>{});
    alert(lang==="ar"?"تم نسخ الكود!":"Code copied!");
  };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
      <div style={{ display:"flex",alignItems:"center",padding:"48px 20px 16px",gap:12 }}>
        <BackBtn onBack={onBack} />
        <div style={{ fontWeight:800,fontSize:18,color:C.text }}>{t.wallet}</div>
      </div>

      {/* Points card */}
      <div style={{ margin:"0 20px 14px",background:`linear-gradient(135deg,${C.dark},#1a2340)`,borderRadius:24,padding:24,color:"#fff",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"#d4a01722" }} />
        <div style={{ fontSize:13,color:"#d4a01799",marginBottom:4 }}>{lang==="ar"?"نقاطك المتراكمة":"Vos points accumulés"}</div>
        <div style={{ fontSize:48,fontWeight:900,color:"#d4a017" }}>⭐ {points}</div>
        <div style={{ fontSize:12,color:"#ffffff55",marginTop:4 }}>{lang==="ar"?"نقطة = 1 دج خصم على رحلتك القادمة":"1 point = 1 DA discount on next trip"}</div>
        <div style={{ display:"flex",gap:16,marginTop:16 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>{totalRides}</div>
            <div style={{ fontSize:11,color:"#ffffff66" }}>{lang==="ar"?"رحلة":"Trajets"}</div>
          </div>
          <div style={{ width:1,background:"#ffffff22" }} />
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>{passengerData?.referralCount||0}</div>
            <div style={{ fontSize:11,color:"#ffffff66" }}>{lang==="ar"?"إحالة":"Parrainages"}</div>
          </div>
        </div>
      </div>

      {/* Referral */}
      <div style={{ margin:"0 20px 14px",background:C.card,borderRadius:20,padding:20,boxShadow:C.shadow }}>
        <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:4 }}>{t.referral}</div>
        <div style={{ fontSize:13,color:C.textMuted,marginBottom:14 }}>{t.referralDesc}</div>
        <div style={{ background:`linear-gradient(135deg,${C.goldLight},#fff8e1)`,border:`2px dashed ${C.gold}`,borderRadius:16,padding:"14px 20px",textAlign:"center",marginBottom:12 }}>
          <div style={{ fontSize:12,color:C.gold,fontWeight:600,marginBottom:4 }}>{lang==="ar"?"كود الإحالة الخاص بك":"Votre code de parrainage"}</div>
          <div style={{ fontSize:28,fontWeight:900,color:C.gold,letterSpacing:4 }}>{referralCode}</div>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={copyCode} style={{ flex:1,background:C.goldLight,border:`1px solid ${C.gold}44`,borderRadius:14,padding:"12px",color:C.gold,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:13 }}>
            📋 {lang==="ar"?"نسخ الكود":"Copier"}
          </button>
          <button onClick={()=>{ const msg=lang==="ar"?`انضم لتطبيق البراق واستخدم كودي ${referralCode} للحصول على خصم! 🚕`:`Rejoignez AL-BURAQ avec mon code ${referralCode}! 🚕`; window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,"_blank"); }}
            style={{ flex:1,background:"#25d36622",border:"1px solid #25d36644",borderRadius:14,padding:"12px",color:"#25d366",fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:13 }}>
            📤 {lang==="ar"?"مشاركة":"Partager"}
          </button>
        </div>
        <div style={{ background:C.greenLight,borderRadius:12,padding:"10px 14px",marginTop:12,fontSize:12,color:C.greenDark }}>
          🎁 {lang==="ar"?"احصل على 50 نقطة مقابل كل صديق يسجل بكودك":"Gagnez 50 points pour chaque ami parrainé"}
        </div>
      </div>

      {/* Trip history */}
      <div style={{ margin:"0 20px 30px" }}>
        <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:12 }}>{t.history}</div>
        {rides.length===0&&<div style={{ textAlign:"center",padding:"30px 0",color:C.textMuted,fontSize:13 }}>{lang==="ar"?"لم تقم بأي رحلة بعد":"Aucun trajet pour l'instant"}</div>}
        {rides.map(r=>(
          <div key={r.id} style={{ background:C.card,borderRadius:16,padding:14,marginBottom:10,boxShadow:C.shadow,border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <div style={{ fontSize:12,color:C.textMuted }}>{r.createdAt?.toDate?.()?.toLocaleDateString("ar-DZ")||"—"}</div>
              <div style={{ background:r.status==="completed"||r.status==="rated"?C.greenLight:C.redLight,color:r.status==="completed"||r.status==="rated"?C.greenDark:C.red,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700 }}>
                {r.status==="completed"||r.status==="rated"?"✅":"❌"}
              </div>
            </div>
            <div style={{ fontSize:13,color:C.text,marginBottom:4 }}>📍 {r.originText?.substring(0,35)||"—"}</div>
            <div style={{ fontSize:13,color:C.text,marginBottom:8 }}>🏁 {r.destText?.substring(0,35)||"—"}</div>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ background:C.greenLight,borderRadius:10,padding:"5px 12px",fontSize:13,fontWeight:800,color:C.greenDark }}>{r.price} DA</div>
              <div style={{ background:C.blueLight,borderRadius:10,padding:"5px 12px",fontSize:12,color:C.blue }}>{r.distanceKm?.toFixed(1)} km</div>
              {r.passengerRating&&<div style={{ background:C.yellowLight,borderRadius:10,padding:"5px 12px",fontSize:12,color:C.yellow }}>⭐ {r.passengerRating}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== SOS BUTTON =====
function SOSButton({ passengerName, bookingId }) {
  const [pressed,setPressed]=useState(false);
  const handleSOS=()=>{
    setPressed(true);
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      try{await addDoc(collection(db,"sos_alerts"),{passengerName,location:loc,bookingId,createdAt:serverTimestamp(),resolved:false});}catch(e){}
      window.open(`https://api.whatsapp.com/send?text=🚨 طلب مساعدة طارئ من ${passengerName}! https://maps.google.com/?q=${loc.lat},${loc.lng}`,"_blank");
    });
    setTimeout(()=>setPressed(false),3000);
  };
  return (
    <button onClick={handleSOS} style={{ position:"fixed",bottom:100,left:20,width:56,height:56,borderRadius:"50%",background:pressed?"#dc2626":C.red,border:"none",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:900,boxShadow:"0 4px 20px rgba(239,68,68,0.5)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,fontFamily:"inherit",animation:"pulse-sos 2s infinite" }}>
      <span style={{ fontSize:20 }}>🆘</span><span>SOS</span>
      <style>{`@keyframes pulse-sos{0%,100%{box-shadow:0 4px 20px rgba(239,68,68,0.5)}50%{box-shadow:0 4px 32px rgba(239,68,68,0.9)}}`}</style>
    </button>
  );
}

// ===== TRACKING MAP =====
function PassengerTrackingMap({ passengerLocation, driverLocation, destinationLocation, mode="pickup", height=240, lang="ar" }) {
  const [directions,setDirections]=useState(null);
  const mapRef=useRef(null);
  const makeMarker=(emoji,color)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><circle cx='22' cy='22' r='20' fill='${color}' stroke='white' stroke-width='3'/><text x='22' y='29' text-anchor='middle' font-size='20'>${emoji}</text></svg>`);
  const target=mode==="pickup"?passengerLocation:destinationLocation;
  useEffect(()=>{ if(!driverLocation||!target||!window.google){setDirections(null);return;} new window.google.maps.DirectionsService().route({origin:driverLocation,destination:target,travelMode:"DRIVING"},(r,s)=>{if(s==="OK")setDirections(r);}); },[driverLocation,target]);
  useEffect(()=>{ if(driverLocation&&mapRef.current) mapRef.current.panTo(driverLocation); },[driverLocation]);
  const t=T[lang];
  return (
    <div style={{ margin:"0 20px",borderRadius:20,overflow:"hidden",position:"relative" }}>
      <GoogleMap mapContainerStyle={{ width:"100%",height:`${height}px` }} center={driverLocation||passengerLocation||ALGERIA_CENTER} zoom={15} onLoad={m=>mapRef.current=m} options={{ styles:MAP_STYLE,disableDefaultUI:true,zoomControl:true }}>
        {passengerLocation&&<Marker position={passengerLocation} icon={{ url:makeMarker("📍",C.green),scaledSize:new window.google.maps.Size(44,44) }} />}
        {driverLocation&&<Marker position={driverLocation} icon={{ url:makeMarker("🚕",C.orange),scaledSize:new window.google.maps.Size(44,44) }} />}
        {destinationLocation&&mode==="ride"&&<Marker position={destinationLocation} icon={{ url:makeMarker("🏁",C.blue),scaledSize:new window.google.maps.Size(44,44) }} />}
        {directions&&<DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:C.orange,strokeWeight:5,strokeOpacity:0.85 },suppressMarkers:true }} />}
      </GoogleMap>
      <div style={{ position:"absolute",top:10,right:10,background:"rgba(0,0,0,0.75)",borderRadius:20,padding:"6px 14px",display:"flex",alignItems:"center",gap:6 }}>
        <div style={{ width:8,height:8,borderRadius:"50%",background:C.green,animation:"gpulse 1.5s infinite" }} />
        <span style={{ color:"#fff",fontSize:12,fontWeight:700 }}>{mode==="pickup"?t.drivercoming:t.tripOngoing}</span>
      </div>
      <style>{`@keyframes gpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.4)}}`}</style>
    </div>
  );
}

function TaxiMap({ origin, destination, showDrivers, height=220 }) {
  const [directions,setDirections]=useState(null);
  const [userLocation,setUserLocation]=useState(ALGERIA_CENTER);
  const [nearbyDrivers,setNearbyDrivers]=useState([]);
  const mapRef=useRef(null);
  useEffect(()=>{ navigator.geolocation?.getCurrentPosition(p=>setUserLocation({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{}); },[]);
  useEffect(()=>{ if(!showDrivers) return; const u=onSnapshot(collection(db,"drivers"),s=>setNearbyDrivers(s.docs.filter(d=>d.data().isOnline&&d.data().verificationStatus==="approved"&&d.data().location).map(d=>({id:d.id,...d.data()})))); return()=>u(); },[showDrivers]);
  useEffect(()=>{ if(!origin||!destination){setDirections(null);return;} new window.google.maps.DirectionsService().route({origin,destination,travelMode:"DRIVING"},(r,s)=>{if(s==="OK")setDirections(r);}); },[origin,destination]);
  const onLoad=useCallback(m=>{mapRef.current=m;},[]);
  const makeMarker=(emoji,color)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='${color}' stroke='white' stroke-width='3'/><text x='20' y='27' text-anchor='middle' font-size='18'>${emoji}</text></svg>`);
  return (
    <div style={{ margin:"0 20px",borderRadius:20,overflow:"hidden" }}>
      <GoogleMap mapContainerStyle={{ width:"100%",height:`${height}px` }} center={origin||userLocation} zoom={13} onLoad={onLoad} options={{ styles:MAP_STYLE,disableDefaultUI:true,zoomControl:true }}>
        {!origin&&<Marker position={userLocation} />}
        {origin&&!directions&&<Marker position={origin} icon={{ url:makeMarker("📍",C.green),scaledSize:new window.google.maps.Size(40,40) }} />}
        {destination&&!directions&&<Marker position={destination} icon={{ url:makeMarker("🏁",C.orange),scaledSize:new window.google.maps.Size(40,40) }} />}
        {directions&&<DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:C.green,strokeWeight:4,strokeOpacity:0.8 } }} />}
        {showDrivers&&nearbyDrivers.map(d=><Marker key={d.id} position={d.location} icon={{ url:makeMarker("🚕",C.dark),scaledSize:new window.google.maps.Size(40,40) }} />)}
      </GoogleMap>
    </div>
  );
}

// ===== FLOATING LANG BUTTON =====
function FloatingLang({ lang, setLang, side="right" }) {
  const [open, setOpen] = useState(false);
  const sideStyle = side==="left" ? { left:12 } : { right:12 };
  return (
    <div style={{ position:"fixed",top:14,...sideStyle,zIndex:9000 }}>
      <button onClick={()=>setOpen(!open)} style={{ width:36,height:36,borderRadius:10,background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.2)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
        {lang==="ar"?"🇩🇿":lang==="fr"?"🇫🇷":"🇬🇧"}
      </button>
      {open&&(
        <div style={{ position:"absolute",top:40,...(side==="left"?{left:0}:{right:0}),background:"rgba(0,0,0,0.85)",borderRadius:12,padding:8,display:"flex",flexDirection:"column",gap:6,backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.15)" }}>
          {[{code:"ar",flag:"🇩🇿"},{code:"fr",flag:"🇫🇷"},{code:"en",flag:"🇬🇧"}].map(l=>(
            <button key={l.code} onClick={()=>{setLang(l.code);localStorage.setItem("taxidz_lang",l.code);setOpen(false);}}
              style={{ padding:"6px 12px",borderRadius:8,border:"none",background:lang===l.code?"rgba(255,255,255,0.2)":"transparent",color:"#fff",fontFamily:"inherit",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
              {l.flag} {l.code==="ar"?"العربية":l.code==="fr"?"Français":"English"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== WELCOME =====
function WelcomeScreen({ onSelect, lang, setLang }) {
  const t=T[lang];
  const isRTL=lang==="ar";
  return (
    <div style={{ minHeight:"100vh",fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden" }}>
      {/* خلفية الصورة */}
      <div style={{ position:"absolute",inset:0,backgroundImage:"url('/logo512.png')",backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",filter:"brightness(0.25)",zIndex:0 }} />
      {/* طبقة لونية فوق الخلفية */}
      <div style={{ position:"absolute",inset:0,background:"linear-gradient(160deg,rgba(0,20,10,0.85) 0%,rgba(0,50,30,0.75) 50%,rgba(0,20,10,0.85) 100%)",zIndex:1 }} />
      <div style={{ position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",width:"100%" }}>
      <div style={{ position:"absolute",top:48,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6 }}>
        {[{code:"ar",flag:"🇩🇿"},{code:"fr",flag:"🇫🇷"},{code:"en",flag:"🇬🇧"}].map(l=>(
          <button key={l.code} onClick={()=>setLang(l.code)} style={{ padding:"6px 12px",borderRadius:20,border:`1.5px solid ${lang===l.code?"#d4a017":"#ffffff33"}`,background:lang===l.code?"#d4a01722":"transparent",color:lang===l.code?"#d4a017":"#ffffff88",fontFamily:"inherit",fontWeight:lang===l.code?700:400,fontSize:13,cursor:"pointer" }}>{l.flag}</button>
        ))}
      </div>
      <img src="/logo192.png" alt="AL-BURAQ" style={{ width:160,height:160,objectFit:"contain",marginBottom:16,filter:"drop-shadow(0 8px 32px rgba(212,160,23,0.6))",animation:"logoPulse 3s ease-in-out infinite" }} onError={e=>e.target.style.display="none"} />
      <div style={{ fontSize:32,fontWeight:900,color:"#fff",marginBottom:4,letterSpacing:2 }}>AL-BURAQ</div>
      <div style={{ fontSize:13,color:"#d4a017",marginBottom:40,fontWeight:600 }}>{t.appTagline}</div>

      {/* حساب واحد للاتجاهين */}
      <div style={{ background:"#ffffff11",borderRadius:16,padding:"12px 20px",marginBottom:24,border:"1px solid #ffffff22",textAlign:"center" }}>
        <div style={{ fontSize:12,color:"#ffffff88" }}>
          {lang==="ar"?"💡 حساب واحد — يمكنك الدخول كراكب أو سائق":
           lang==="fr"?"💡 Un seul compte — passager ou chauffeur":
           "💡 One account — switch between rider & driver"}
        </div>
      </div>

      <div style={{ width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:12 }}>
        <button onClick={()=>onSelect("passenger")} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:20,padding:"18px 24px",color:"#fff",fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,179,126,0.35)" }}>
          <span style={{ fontSize:40 }}>🧑</span>
          <div style={{ textAlign:isRTL?"right":"left" }}>
            <div style={{ fontWeight:800,fontSize:17 }}>{t.passenger}</div>
            <div style={{ fontSize:12,opacity:0.85 }}>{t.passengerSub}</div>
          </div>
        </button>
        <button onClick={()=>onSelect("driver")} style={{ background:`linear-gradient(135deg,${C.orange},#ea580c)`,border:"none",borderRadius:20,padding:"18px 24px",color:"#fff",fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(249,115,22,0.35)" }}>
          <span style={{ fontSize:40 }}>👨‍✈️</span>
          <div style={{ textAlign:isRTL?"right":"left" }}>
            <div style={{ fontWeight:800,fontSize:17 }}>{t.driver}</div>
            <div style={{ fontSize:12,opacity:0.85 }}>{t.driverSub}</div>
          </div>
        </button>
      </div>
        <style>{`@keyframes logoPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 8px 32px rgba(212,160,23,0.6))}50%{transform:scale(1.04);filter:drop-shadow(0 12px 40px rgba(212,160,23,0.9))}}`}</style>
      </div>
    </div>
  );
}

// ===== AUTH =====
function AuthForm({ role, onSuccess, onBack, lang, setLang, resetGuardRef }) {
  const t = T[lang];
  const isRTL = lang === "ar";
  const isPassenger = role === "passenger";
  const accent = isPassenger ? C.green : C.orange;
  const accentDark = isPassenger ? C.greenDark : "#ea580c";

  const [authTab, setAuthTab] = useState("login"); // login | register | reset
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [resetPhone, setResetPhone] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [step, setStep] = useState("form"); // form | otp | done
  const [otp, setOtp] = useState(["","","","","",""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [otpMethod, setOtpMethod] = useState("sms"); // sms | whatsapp
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];

  const generateReferralCode = (uid) => `BRQ${uid.substring(0,6).toUpperCase()}`;

  useEffect(() => {
    if (resendTimer <= 0) return;
    const ti = setInterval(() => setResendTimer(p => p-1), 1000);
    return () => clearInterval(ti);
  }, [resendTimer]);

  const switchTab = (tab) => {
    setAuthTab(tab); setError(""); setStep("form");
    setOtp(["","","","","",""]);
    setPhone(""); setPinCode(""); setPinConfirm(""); setName("");
    setLoginPhone(""); setLoginPin("");
    setResetPhone(""); setNewPin(""); setNewPinConfirm("");
  };

  // ===== LOGIN بدون OTP =====
  const handleLogin = async () => {
    const digits = loginPhone.replace(/\D/g,"");
    if (digits.length < 9) { setError(lang==="ar"?"أدخل رقم هاتفك":"Entrez votre numéro"); return; }
    if (loginPin.length < 4) { setError(lang==="ar"?"أدخل كود حسابك":"Entrez votre code"); return; }
    setLoading(true); setError("");
    try {
      const fullPhone = `+213${digits.replace(/^0/,"")}`;
      
      // تسجيل دخول مجهول مؤقت للوصول لـ Firestore
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
      
      const cols = isPassenger ? ["passengers","drivers"] : ["drivers","passengers"];
      let found = false;
      for (const col of cols) {
        const q = await getDocs(query(collection(db, col), where("phone","==",fullPhone)));
        if (!q.empty) {
          const docData = q.docs[0].data();
          if (docData.pinCode === loginPin) {
            const targetCol = isPassenger ? "passengers" : "drivers";
            if (col !== targetCol) {
              await setDoc(doc(db, targetCol, q.docs[0].id), {
                ...docData, role,
                status: role==="driver"?"pending":"active",
                verificationStatus: role==="driver"?"none":null
              }, { merge:true });
            }
            if (isPassenger) {
              localStorage.setItem("taxidz_name", docData.name||"");
              localStorage.setItem("taxidz_phone", fullPhone);
            }
            localStorage.setItem("taxidz_role", role);
            localStorage.setItem("taxidz_uid", q.docs[0].id);
            try { const fcmToken = await requestNotificationPermission(); if(fcmToken) await setDoc(doc(db,targetCol,q.docs[0].id),{fcmToken},{merge:true}); } catch(e){}
            found = true;
            onSuccess(role);
            break;
          } else {
            // كود خاطئ - سجّل خروج المجهول
            await signOut(auth);
            setError(lang==="ar"?"كود الحساب غير صحيح":"Code incorrect");
            setLoading(false);
            return;
          }
        }
      }
      if (!found) {
        await signOut(auth);
        setError(lang==="ar"?"الرقم غير مسجل — أنشئ حساباً جديداً":"Numéro non inscrit");
      }
    } catch(e) {
      console.log("Login error:", e.code, e.message);
      setError(lang==="ar"?`خطأ: ${e.code||e.message}`:`Erreur: ${e.code||e.message}`);
    }
    setLoading(false);
  };

  // ===== SEND OTP (عبر Twilio Verify - Cloud Function) =====
  const sendOTP = async (phoneNum) => {
    const digits = phoneNum.replace(/\D/g,"");
    if (digits.length < 9) { setError(lang==="ar"?"أدخل رقم هاتفك":"Entrez votre numéro"); return; }
    setLoading(true); setError("");
    try {
      const fullPhone = `+213${digits.replace(/^0/,"")}`;
      // عند التسجيل فقط: تحقق من عدم وجود حساب مسبقاً بنفس الرقم قبل إرسال أي SMS
      if (authTab === "register") {
        const checkPhoneRegistered = httpsCallable(cloudFunctions, "checkPhoneRegistered");
        const { data: checkData } = await checkPhoneRegistered({ phone: fullPhone, role: isPassenger?"passenger":"driver" });
        if (checkData?.exists) {
          setError(lang==="ar"?"أنت مسجّل بالفعل — انتقل إلى تسجيل الدخول":"Vous êtes déjà inscrit — utilisez la connexion");
          setLoading(false);
          return;
        }
      }
      const sendOtpTwilio = httpsCallable(cloudFunctions, "sendOtpTwilio");
      await sendOtpTwilio({ phone: fullPhone, channel: otpMethod });
      // نخزن رقم الهاتف فقط (بدل confirmationResult الخاص بـ Firebase) لاستعماله عند التحقق
      setConfirmResult({ phone: fullPhone });
      setStep("otp");
      setResendTimer(120);
      setTimeout(() => otpRefs[0].current?.focus(), 300);
    } catch(e) {
      console.log("OTP send error:", e.code, e.message);
      const msgs = {
        "invalid-argument": lang==="ar"?"رقم غير صحيح":"Numéro invalide",
        "resource-exhausted": lang==="ar"?"تم قفل حسابك مؤقتاً 24 ساعة بسبب محاولات خاطئة متكررة":"Compte verrouillé 24h — trop de tentatives",
      };
      setError(msgs[e.code?.replace("functions/","")] || (lang==="ar"?"تعذر إرسال الرمز — حاول مجدداً":"Échec de l'envoi du code"));
    }
    setLoading(false);
  };

  // ===== SEND OTP via WhatsApp =====
  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp]; newOtp[i] = val.slice(-1); setOtp(newOtp);
    if (val && i < 5) otpRefs[i+1].current?.focus();
    if (!val && i > 0) otpRefs[i-1].current?.focus();
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if (paste.length === 6) { setOtp(paste.split("")); otpRefs[5].current?.focus(); }
  };

  // ===== VERIFY OTP تسجيل جديد =====
  const verifyOTPRegister = async () => {
    const code = otp.join("");
    if (code.length < 6) { setError(lang==="ar"?"أدخل الرمز كاملاً":"Code incomplet"); return; }
    setLoading(true); setError("");

    try {
      const verifyOtpTwilio = httpsCallable(cloudFunctions, "verifyOtpTwilio");
      const { data } = await verifyOtpTwilio({ phone: confirmResult.phone, code });
      const cred = await signInWithCustomToken(auth, data.customToken);
      const u = cred.user;
      const digits = phone.replace(/\D/g,"");
      const phoneF = `+213${digits.replace(/^0/,"")}`;
      const col = isPassenger ? "passengers" : "drivers";
      // منع إنشاء/إعادة تعيين حساب موجود مسبقًا بنفس الرقم
      const existingSnap = await getDoc(doc(db, col, u.uid));
      if (existingSnap.exists()) {
        setError(lang==="ar"?"هذا الرقم مسجّل مسبقاً — استعمل تسجيل الدخول":"Ce numéro est déjà enregistré — utilisez la connexion");
        setLoading(false);
        return;
      }
      await setDoc(doc(db, col, u.uid), {
        uid:u.uid, name, phone:phoneF, pinCode,
        role, status:role==="driver"?"pending":"active",
        verificationStatus:role==="driver"?"none":null,
        rating:0, totalRatings:0, totalRides:0, points:0,
        referralCode:generateReferralCode(u.uid), referralCount:0,
        createdAt:serverTimestamp()
      });
      if (isPassenger) { localStorage.setItem("taxidz_name",name); localStorage.setItem("taxidz_phone",phoneF); }
      localStorage.setItem("taxidz_role", role);
      try { const fcmToken = await requestNotificationPermission(); if(fcmToken) await setDoc(doc(db,col,u.uid),{fcmToken},{merge:true}); } catch(e){}
      onSuccess(role);
    } catch(e) {
      const locked = e.code==="functions/resource-exhausted"||e.details?.code==="resource-exhausted"||/قفل|resource-exhausted/i.test(e.message||"");
      setError(locked?(lang==="ar"?"تم قفل حسابك مؤقتاً 24 ساعة بسبب محاولات خاطئة متكررة":"Compte verrouillé 24h — trop de tentatives"):(lang==="ar"?"رمز التحقق خاطئ أو منتهي":"Code incorrect ou expiré"));
      setOtp(["","","","","",""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
    setLoading(false);
  };

  // ===== VERIFY OTP استرجاع الكود =====
  const verifyOTPReset = async () => {
    const code = otp.join("");
    if (code.length < 6) { setError(lang==="ar"?"أدخل الرمز كاملاً":"Code incomplet"); return; }
    setLoading(true); setError("");
    try {
      const verifyOtpTwilio = httpsCallable(cloudFunctions, "verifyOtpTwilio");
      const { data } = await verifyOtpTwilio({ phone: confirmResult.phone, code });
      // امنع التنقل التلقائي للتطبيق قبل حفظ الكود الجديد.
      // نخزّنه في sessionStorage وليس فقط في useRef، لأن useRef يُفقد إذا أُعيد تحميل الصفحة
      // (وهذا بالضبط ما كان يسبب الدخول المباشر للتطبيق بكلمة المرور القديمة دون حفظ الجديدة)
      if (resetGuardRef) resetGuardRef.current = true;
      sessionStorage.setItem("taxidz_reset_in_progress", "1");
      await signInWithCustomToken(auth, data.customToken);
      setStep("newpin");
    } catch(e) {
      const locked = e.code==="functions/resource-exhausted"||e.details?.code==="resource-exhausted"||/قفل|resource-exhausted/i.test(e.message||"");
      setError(locked?(lang==="ar"?"تم قفل حسابك مؤقتاً 24 ساعة بسبب محاولات خاطئة متكررة":"Compte verrouillé 24h — trop de tentatives"):(lang==="ar"?"رمز التحقق خاطئ":"Code incorrect"));
      setOtp(["","","","","",""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
    setLoading(false);
  };

  // ===== SAVE NEW PIN =====
  const saveNewPin = async () => {
    if (newPin.length < 4) { setError(lang==="ar"?"الكود قصير — 4 أرقام على الأقل":"Code trop court"); return; }
    if (newPin !== newPinConfirm) { setError(lang==="ar"?"الكودان غير متطابقان":"Codes différents"); return; }
    setLoading(true); setError("");
    try {
      const u = auth.currentUser;
      if (!u) { setError("Session expired"); setLoading(false); return; }
      const col = isPassenger ? "passengers" : "drivers";
      await setDoc(doc(db, col, u.uid), { pinCode: newPin }, { merge: true });
      sessionStorage.removeItem("taxidz_reset_in_progress");
      setStep("done");
    } catch(e) { setError(lang==="ar"?"خطأ في الحفظ":"Erreur"); }
    setLoading(false);
  };

  const resendOTP = () => {
    if (resendTimer > 0) return;
    setOtp(["","","","","",""]); setError(""); setStep("form");
  };

  const inputStyle = { background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"13px 16px", fontFamily:"inherit", fontSize:14, color:C.text, outline:"none", width:"100%", direction:isRTL?"rtl":"ltr" };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
      <FloatingLang lang={lang} setLang={setLang} side={isRTL?"left":"right"} />

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.dark},#16213e)`,padding:"48px 24px 24px",textAlign:"center",position:"relative" }}>
        <button onClick={step==="form"?onBack:()=>{if(resetGuardRef)resetGuardRef.current=false;sessionStorage.removeItem("taxidz_reset_in_progress");setStep("form");setOtp(["","","","","",""]);setError("");}}
          style={{ position:"absolute",top:48,[isRTL?"right":"left"]:20,width:36,height:36,borderRadius:10,background:"#ffffff22",border:"none",color:"#fff",cursor:"pointer",fontSize:16 }}>←</button>
        <img src="/logo192.png" alt="AL-BURAQ" style={{ width:60,height:60,objectFit:"contain",marginBottom:8 }} onError={e=>e.target.style.display="none"} />
        <div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>{isPassenger?t.passengerGate:t.driverGate}</div>
      </div>

      <div style={{ padding:"20px 20px 40px" }}>
        <LanguageSwitcher lang={lang} setLang={setLang} />

        {/* Tabs */}
        {step==="form"&&authTab!=="reset"&&(
          <div style={{ background:"#e2ddd8",borderRadius:14,padding:4,display:"flex",marginBottom:16 }}>
            {[
              {id:"login",label:lang==="ar"?"🔑 تسجيل الدخول":lang==="fr"?"🔑 Connexion":"🔑 Login"},
              {id:"register",label:lang==="ar"?"✅ حساب جديد":lang==="fr"?"✅ Inscription":"✅ Register"},
            ].map(m=>(
              <button key={m.id} onClick={()=>switchTab(m.id)}
                style={{ flex:1,padding:10,borderRadius:11,border:"none",background:authTab===m.id?C.card:"transparent",color:authTab===m.id?C.text:C.textMuted,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13 }}>{m.label}</button>
            ))}
          </div>
        )}

        {/* ===== LOGIN ===== */}
        {authTab==="login"&&step==="form"&&(
          <div style={{ background:C.card,borderRadius:24,padding:24,boxShadow:C.shadow,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:13,color:C.textMuted,fontWeight:600 }}>{lang==="ar"?"رقم الهاتف الجزائري":"Numéro algérien"}</div>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:14,padding:"13px 12px",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
                <span>🇩🇿</span><span style={{ fontSize:14,color:C.greenDark,fontWeight:700 }}>+213</span>
              </div>
              <input value={loginPhone} onChange={e=>setLoginPhone(e.target.value.replace(/\D/g,""))}
                placeholder="0XXXXXXXXX" type="tel" maxLength={10}
                style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 16px",fontFamily:"inherit",fontSize:16,color:C.text,outline:"none",direction:"ltr",textAlign:"center",fontWeight:700 }} />
            </div>
            <div style={{ fontSize:13,color:C.textMuted,fontWeight:600 }}>{lang==="ar"?"كود الحساب":"Code du compte"}</div>
            <div style={{ position:"relative" }}>
              <input value={loginPin} onChange={e=>setLoginPin(e.target.value)}
                placeholder={lang==="ar"?"كلمة المرور":"Mot de passe"}
                type={showLoginPin?"text":"password"} maxLength={20}
                style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 44px 13px 16px",fontFamily:"inherit",fontSize:15,color:C.text,outline:"none",direction:"ltr" }} />
              <button onClick={()=>setShowLoginPin(!showLoginPin)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.textMuted }}>
                {showLoginPin?"🙈":"👁️"}
              </button>
            </div>
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,textAlign:"center" }}>{error}</div>}
            <button onClick={handleLogin} disabled={loading||loginPhone.replace(/\D/g,"").length<9||loginPin.length<4}
              style={{ background:loginPhone.replace(/\D/g,"").length>=9&&loginPin.length>=4?`linear-gradient(135deg,${accent},${accentDark})`:C.border,border:"none",borderRadius:16,padding:16,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {loading?<><span style={{ width:18,height:18,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />{lang==="ar"?"جارٍ...":"..."}</>:`🚀 ${lang==="ar"?"دخول":"Connexion"}`}
            </button>
            <button onClick={()=>{setAuthTab("reset");setError("");}}
              style={{ background:"none",border:"none",color:C.blue,fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:600,textAlign:"center" }}>
              🔐 {lang==="ar"?"نسيت كود حسابك؟":lang==="fr"?"Code oublié?":"Forgot your code?"}
            </button>
          </div>
        )}

        {/* ===== REGISTER ===== */}
        {authTab==="register"&&step==="form"&&(
          <div style={{ background:C.card,borderRadius:24,padding:24,boxShadow:C.shadow,display:"flex",flexDirection:"column",gap:12 }}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder={lang==="ar"?"اسم المستخدم":"Nom d'utilisateur"} style={inputStyle} />
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:14,padding:"13px 12px",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
                <span>🇩🇿</span><span style={{ fontSize:14,color:C.greenDark,fontWeight:700 }}>+213</span>
              </div>
              <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))}
                placeholder="0XXXXXXXXX" type="tel" maxLength={10}
                style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 16px",fontFamily:"inherit",fontSize:16,color:C.text,outline:"none",direction:"ltr",textAlign:"center",fontWeight:700 }} />
            </div>
            {/* كلمة المرور مع زر الإظهار */}
            <div style={{ position:"relative" }}>
              <input value={pinCode} onChange={e=>setPinCode(e.target.value)}
                placeholder={lang==="ar"?"كلمة المرور (حروف+أرقام+رموز)":"Mot de passe (lettres+chiffres)"}
                type={showPin?"text":"password"} maxLength={20}
                style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 44px 13px 16px",fontFamily:"inherit",fontSize:15,color:C.text,outline:"none",direction:"ltr" }} />
              <button onClick={()=>setShowPin(!showPin)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.textMuted }}>
                {showPin?"🙈":"👁️"}
              </button>
            </div>
            <div style={{ position:"relative" }}>
              <input value={pinConfirm} onChange={e=>setPinConfirm(e.target.value)}
                placeholder={lang==="ar"?"تأكيد كلمة المرور":"Confirmer le mot de passe"}
                type={showPinConfirm?"text":"password"} maxLength={20}
                style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 44px 13px 16px",fontFamily:"inherit",fontSize:15,color:C.text,outline:"none",direction:"ltr" }} />
              <button onClick={()=>setShowPinConfirm(!showPinConfirm)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.textMuted }}>
                {showPinConfirm?"🙈":"👁️"}
              </button>
            </div>
            <div style={{ background:C.blueLight,borderRadius:12,padding:"10px 14px",fontSize:12,color:C.blue }}>
              🔐 {lang==="ar"?"احفظ كودك جيداً — ستحتاجه عند كل دخول":"Mémorisez bien votre code"}
            </div>
            {/* اختيار قناة استلام رمز التحقق */}
            <div>
              <div style={{ fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:600 }}>{lang==="ar"?"استلم رمز التحقق عبر:":"Recevoir le code via :"}</div>
              <div style={{ display:"flex",gap:8 }}>
                <button type="button" onClick={()=>setOtpMethod("sms")} style={{ flex:1,padding:"11px",borderRadius:12,border:`2px solid ${otpMethod==="sms"?accent:C.border}`,background:otpMethod==="sms"?`${accent}15`:C.bg,color:otpMethod==="sms"?accent:C.textMuted,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  💬 SMS
                </button>
                <button type="button" onClick={()=>setOtpMethod("whatsapp")} style={{ flex:1,padding:"11px",borderRadius:12,border:`2px solid ${otpMethod==="whatsapp"?"#25D366":C.border}`,background:otpMethod==="whatsapp"?"#25D36615":C.bg,color:otpMethod==="whatsapp"?"#25D366":C.textMuted,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  🟢 WhatsApp
                </button>
              </div>
            </div>
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,textAlign:"center" }}>{error}</div>}
            <button onClick={()=>{
              if(!name.trim()){setError(lang==="ar"?"أدخل اسم المستخدم":"Entrez votre nom");return;}
              if(phone.replace(/\D/g,"").length<9){setError(lang==="ar"?"أدخل رقم هاتفك":"Entrez votre numéro");return;}
              if(pinCode.length<4){setError(lang==="ar"?"كلمة المرور قصيرة (4 أحرف على الأقل)":"Mot de passe trop court");return;}
              if(pinCode!==pinConfirm){setError(lang==="ar"?"الكودان غير متطابقان":"Codes différents");return;}
              setError(""); sendOTP(phone);
            }} disabled={loading}
              style={{ background:`linear-gradient(135deg,${accent},${accentDark})`,border:"none",borderRadius:16,padding:16,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {loading?<><span style={{ width:18,height:18,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />{lang==="ar"?"جارٍ...":"..."}</>:`📨 ${lang==="ar"?"إرسال رمز التحقق":"Envoyer le code"}`}
            </button>
          </div>
        )}

        {/* ===== RESET - ادخال الهاتف ===== */}
        {authTab==="reset"&&step==="form"&&(
          <div style={{ background:C.card,borderRadius:24,padding:24,boxShadow:C.shadow,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ textAlign:"center",marginBottom:8 }}>
              <div style={{ fontSize:40,marginBottom:8 }}>🔐</div>
              <div style={{ fontWeight:800,fontSize:16,color:C.text }}>{lang==="ar"?"استرجاع الكود":"Récupérer le code"}</div>
              <div style={{ fontSize:12,color:C.textMuted,marginTop:4 }}>{lang==="ar"?"سنرسل رمز تحقق لرقمك":"Nous enverrons un code de vérification"}</div>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:14,padding:"13px 12px",display:"flex",alignItems:"center",gap:6 }}>
                <span>🇩🇿</span><span style={{ fontSize:14,color:C.greenDark,fontWeight:700 }}>+213</span>
              </div>
              <input value={resetPhone} onChange={e=>setResetPhone(e.target.value.replace(/\D/g,""))}
                placeholder="0XXXXXXXXX" type="tel" maxLength={10}
                style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 16px",fontFamily:"inherit",fontSize:16,color:C.text,outline:"none",direction:"ltr",textAlign:"center",fontWeight:700 }} />
            </div>
            <div>
              <div style={{ fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:600 }}>{lang==="ar"?"استلم رمز التحقق عبر:":"Recevoir le code via :"}</div>
              <div style={{ display:"flex",gap:8 }}>
                <button type="button" onClick={()=>setOtpMethod("sms")} style={{ flex:1,padding:"11px",borderRadius:12,border:`2px solid ${otpMethod==="sms"?C.blue:C.border}`,background:otpMethod==="sms"?`${C.blue}15`:C.bg,color:otpMethod==="sms"?C.blue:C.textMuted,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  💬 SMS
                </button>
                <button type="button" onClick={()=>setOtpMethod("whatsapp")} style={{ flex:1,padding:"11px",borderRadius:12,border:`2px solid ${otpMethod==="whatsapp"?"#25D366":C.border}`,background:otpMethod==="whatsapp"?"#25D36615":C.bg,color:otpMethod==="whatsapp"?"#25D366":C.textMuted,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  🟢 WhatsApp
                </button>
              </div>
            </div>
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,textAlign:"center" }}>{error}</div>}
            <button onClick={()=>sendOTP(resetPhone)} disabled={loading||resetPhone.replace(/\D/g,"").length<9}
              style={{ background:resetPhone.replace(/\D/g,"").length>=9?`linear-gradient(135deg,${C.blue},#1d4ed8)`:C.border,border:"none",borderRadius:16,padding:16,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {loading?"...":`📨 ${lang==="ar"?"إرسال رمز التحقق":"Envoyer"}`}
            </button>
            <button onClick={()=>switchTab("login")} style={{ background:"none",border:"none",color:C.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",textAlign:"center" }}>
              ← {lang==="ar"?"رجوع للدخول":"Retour connexion"}
            </button>
          </div>
        )}

        {/* ===== OTP ===== */}
        {step==="otp"&&(
          <div style={{ background:C.card,borderRadius:24,padding:24,boxShadow:C.shadow }}>
            <div style={{ textAlign:"center",marginBottom:16 }}>
              <div style={{ fontSize:40,marginBottom:8 }}>{otpMethod==="whatsapp"?"🟢":"💬"}</div>
              <div style={{ fontSize:13,color:C.textMuted }}>
                {(lang==="ar"?(otpMethod==="whatsapp"?"أُرسل رمز عبر واتساب إلى":"أُرسل رمز عبر SMS إلى"):(otpMethod==="whatsapp"?"Code envoyé via WhatsApp au":"Code envoyé via SMS au"))} <span style={{ color:C.text,fontWeight:700,direction:"ltr",display:"inline-block" }}>
                  +213{(authTab==="reset"?resetPhone:phone).replace(/\D/g,"").replace(/^0/,"")}
                </span>
              </div>
            </div>
            <div style={{ display:"flex",gap:8,justifyContent:"center",marginBottom:20,direction:"ltr" }} onPaste={handleOtpPaste}>
              {otp.map((digit,i)=>(
                <input key={i} ref={otpRefs[i]} value={digit}
                  onChange={e=>handleOtpChange(i,e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Backspace"&&!digit&&i>0) otpRefs[i-1].current?.focus(); }}
                  maxLength={1} type="tel" inputMode="numeric"
                  style={{ width:46,height:58,textAlign:"center",fontSize:24,fontWeight:900,fontFamily:"monospace",background:digit?`${accent}15`:C.bg,border:`2px solid ${digit?accent:C.border}`,borderRadius:14,color:C.text,outline:"none" }} />
              ))}
            </div>
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,textAlign:"center",marginBottom:12 }}>{error}</div>}
            <button onClick={authTab==="reset"?verifyOTPReset:verifyOTPRegister}
              disabled={loading||otp.join("").length<6}
              style={{ width:"100%",background:otp.join("").length===6?`linear-gradient(135deg,${accent},${accentDark})`:C.border,border:"none",borderRadius:16,padding:16,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:otp.join("").length===6?"pointer":"default",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12 }}>
              {loading?<><span style={{ width:18,height:18,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />{lang==="ar"?"جارٍ...":"..."}
              </>:`✅ ${lang==="ar"?"تأكيد":"Confirmer"}`}
            </button>
            <div style={{ textAlign:"center" }}>
              {resendTimer>0?(
                <span style={{ fontSize:13,color:C.textMuted }}>{lang==="ar"?"إعادة الإرسال بعد":"Renvoi dans"} <span style={{ color:accent,fontWeight:700 }}>{resendTimer}ث</span></span>
              ):(
                <button onClick={()=>{ resendOTP(); sendOTP(authTab==="reset"?resetPhone:phone); }} style={{ background:"none",border:"none",color:accent,fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:700,textDecoration:"underline" }}>
                  🔄 {lang==="ar"?"إعادة إرسال":"Renvoyer"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== كود جديد بعد التحقق ===== */}
        {step==="newpin"&&(
          <div style={{ background:C.card,borderRadius:24,padding:24,boxShadow:C.shadow,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ textAlign:"center",marginBottom:8 }}>
              <div style={{ fontSize:40,marginBottom:8 }}>🔑</div>
              <div style={{ fontWeight:800,fontSize:16,color:C.text }}>{lang==="ar"?"أدخل كودك الجديد":"Nouveau code"}</div>
            </div>
            <div style={{ position:"relative" }}>
              <input value={newPin} onChange={e=>setNewPin(e.target.value)}
                placeholder={lang==="ar"?"كلمة مرور جديدة":"Nouveau mot de passe"} type={showPin?"text":"password"} maxLength={20}
                style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 44px 13px 16px",fontFamily:"inherit",fontSize:15,color:C.text,outline:"none",direction:"ltr" }} />
              <button onClick={()=>setShowPin(!showPin)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.textMuted }}>
                {showPin?"🙈":"👁️"}
              </button>
            </div>
            <div style={{ position:"relative" }}>
              <input value={newPinConfirm} onChange={e=>setNewPinConfirm(e.target.value)}
                placeholder={lang==="ar"?"تأكيد كلمة المرور":"Confirmer"} type={showPinConfirm?"text":"password"} maxLength={20}
                style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 44px 13px 16px",fontFamily:"inherit",fontSize:15,color:C.text,outline:"none",direction:"ltr" }} />
              <button onClick={()=>setShowPinConfirm(!showPinConfirm)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.textMuted }}>
                {showPinConfirm?"🙈":"👁️"}
              </button>
            </div>
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,textAlign:"center" }}>{error}</div>}
            <button onClick={saveNewPin} disabled={loading||newPin.length<4||newPin!==newPinConfirm}
              style={{ background:newPin.length>=4&&newPin===newPinConfirm?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border,border:"none",borderRadius:16,padding:16,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {loading?"...":`✅ ${lang==="ar"?"حفظ الكود الجديد":"Sauvegarder"}`}
            </button>
          </div>
        )}

        {/* ===== DONE ===== */}
        {step==="done"&&(
          <div style={{ background:C.card,borderRadius:24,padding:40,boxShadow:C.shadow,textAlign:"center" }}>
            <div style={{ fontSize:64,marginBottom:16 }}>✅</div>
            <div style={{ fontWeight:900,fontSize:20,color:C.text,marginBottom:8 }}>{lang==="ar"?"تم تحديث الكود!":"Code mis à jour!"}</div>
            <div style={{ fontSize:13,color:C.textMuted,marginBottom:24 }}>{lang==="ar"?"يمكنك الآن الدخول بكودك الجديد":"Connectez-vous avec votre nouveau code"}</div>
            <button onClick={()=>{ if(resetGuardRef) resetGuardRef.current=false; onSuccess(role); }}
              style={{ background:`linear-gradient(135deg,${accent},${accentDark})`,border:"none",borderRadius:14,padding:"14px 32px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer" }}>
              🔑 {lang==="ar"?"الدخول للتطبيق":"Accéder à l'app"}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ===== PASSENGER APP =====
function PassengerApp({ onLogout, user, lang, setLang }) {
  const t=T[lang];
  const isRTL=lang==="ar";
  const [screen,setScreen]=useState("home");
  const [originPlace,setOriginPlace]=useState(null);
  const [destPlace,setDestPlace]=useState(null);
  const [originText,setOriginText]=useState("");
  const [destText,setDestText]=useState("");
  const [rideType,setRideType]=useState("economy");
  const [distanceKm,setDistanceKm]=useState(0);
  const [suggestedPrice,setSuggestedPrice]=useState(MIN_PRICE);
  const [offerPrice,setOfferPrice]=useState(MIN_PRICE);
  const [booking,setBooking]=useState(null);
  const [bookingId,setBookingId]=useState(null);
  const [selectedDriver,setSelectedDriver]=useState(null);
  const [driverLocation,setDriverLocation]=useState(null);
  const driverArrivedNotified=useRef(false);
  const [eta,setEta]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [showRating,setShowRating]=useState(false);
  const [finalRating,setFinalRating]=useState(0);
  const [gpsLoading,setGpsLoading]=useState(false);
  const [passengers,setPassengers]=useState(1);
  const [luggageWeight,setLuggageWeight]=useState("less25");
  const [luggageDesc,setLuggageDesc]=useState("");
  const [noDrivers,setNoDrivers]=useState(false);
  const [timer,setTimer]=useState(0);
  const [passengerGPS,setPassengerGPS]=useState(null);
  const [passengerData,setPassengerData]=useState(null);
  const [fcmToast,setFcmToast]=useState(null);
  const [showReport,setShowReport]=useState(false);
  const [showForceLogout,setShowForceLogout]=useState(false);
  const [pendingSession,setPendingSession]=useState(null);
  const [showChat,setShowChat]=useState(false);
  const originRef=useRef(null);
  const destRef=useRef(null);

  const multiplier=RIDE_MULTIPLIERS[rideType]||1.0;
  const passengerPhone=localStorage.getItem("taxidz_phone")||"";
  const passengerName=localStorage.getItem("taxidz_name")||user?.displayName||"مستخدم";

  useEffect(()=>{
    if(!user?.uid) return;

    // Session management - prevent dual device login
    const initSession = async () => {
      let sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem(SESSION_KEY, sessionId);
      }
      try {
        await setDoc(doc(db,"passengers",user.uid), { activeSession: sessionId, lastSeen: serverTimestamp() }, { merge: true });
      } catch(e) {}
    };
    initSession();

    const u=onSnapshot(doc(db,"passengers",user.uid),s=>{
      if(s.exists()) {
        setPassengerData(s.data());
        // Check session
        const savedSession = localStorage.getItem(SESSION_KEY);
        const activeSession = s.data()?.activeSession;
        if (activeSession && savedSession && activeSession !== savedSession) {
          // تم فتح الحساب من جهاز آخر — أظهر modal بدل التسجيل الفوري
          setShowForceLogout(true);
        }
      }
    });
    const unsub=onForegroundMessage(msg=>setFcmToast({title:msg.notification?.title,body:msg.notification?.body}));
    return()=>{u();if(unsub)unsub();};
  },[user?.uid]);

  useEffect(()=>{ if(distanceKm>0){const p=calcPrice(distanceKm,multiplier);setSuggestedPrice(p);setOfferPrice(p);} },[rideType,distanceKm]);
  useEffect(()=>{ if(!bookingId||(screen!=="found"&&screen!=="ride")) return; const u=onSnapshot(doc(db,"bookings",bookingId),snap=>{ if(!snap.exists()) return; const d=snap.data(); if(d.status==="accepted"&&d.driverInfo&&screen==="searching"){setSelectedDriver(d.driverInfo);setScreen("found");} if(d.status==="arrived"&&!driverArrivedNotified.current){ driverArrivedNotified.current=true; setFcmToast({title:lang==="ar"?"🚕 السائق وصل!":"🚕 Le chauffeur est arrivé!",body:lang==="ar"?"السائق بانتظارك عند نقطة الانطلاق":"Le chauffeur vous attend au point de départ"}); } if(d.driverCurrentLocation){const dLoc=d.driverCurrentLocation;setDriverLocation(dLoc);const pLoc=passengerGPS||(originPlace?getLatLng(originPlace):null);if(pLoc&&screen==="found") setEta(Math.max(1,Math.round(getDistanceKm(dLoc.lat,dLoc.lng,pLoc.lat,pLoc.lng)/0.5)));} }); return()=>u(); },[bookingId,screen,originPlace,passengerGPS,lang]);
  useEffect(()=>{ if(!bookingId||screen!=="searching") return; const u=onSnapshot(doc(db,"bookings",bookingId),snap=>{ if(!snap.exists()) return; const d=snap.data(); if(d.status==="accepted"&&d.driverInfo){setSelectedDriver(d.driverInfo);setScreen("found");} }); return()=>u(); },[bookingId,screen]);
  useEffect(()=>{ if(screen!=="searching") return; const t=setInterval(()=>setTimer(p=>p+1),1000); return()=>clearInterval(t); },[screen]);
  useEffect(()=>{ if(screen==="searching"&&timer===60) setNoDrivers(true); },[timer,screen]);
  useEffect(()=>{ if(screen!=="ride") return; const t=setInterval(()=>setElapsed(p=>p+1),1000); return()=>clearInterval(t); },[screen]);

  const handleForceLogoutCancel = () => {
    signOut(auth);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("taxidz_role");
  };

  const handleForceLogout = async () => {
    // Close current session and open new one
    const newSessionId = generateSessionId();
    localStorage.setItem(SESSION_KEY, newSessionId);
    try {
      await setDoc(doc(db,"passengers",user.uid),{ activeSession:newSessionId, lastSeen:serverTimestamp() },{ merge:true });
    } catch(e) {}
    setShowForceLogout(false);
  };

  const updateDistance=(lat1,lng1,lat2,lng2)=>{ const km=getDistanceKm(lat1,lng1,lat2,lng2);setDistanceKm(km);const p=calcPrice(km,multiplier);setSuggestedPrice(p);setOfferPrice(p); };
  const handleGPS=()=>{ setGpsLoading(true); navigator.geolocation?.getCurrentPosition(pos=>{ const ll=new window.google.maps.LatLng(pos.coords.latitude,pos.coords.longitude);setOriginPlace(ll);setPassengerGPS({lat:pos.coords.latitude,lng:pos.coords.longitude}); new window.google.maps.Geocoder().geocode({location:ll},(results,status)=>{ setOriginText(status==="OK"&&results[0]?results[0].formatted_address:`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);setGpsLoading(false);if(destPlace){const{lat:lat2,lng:lng2}=getLatLng(destPlace);updateDistance(pos.coords.latitude,pos.coords.longitude,lat2,lng2);} }); },()=>setGpsLoading(false)); };
  const onOriginChanged=()=>{ if(originRef.current){const p=originRef.current.getPlace();if(p?.geometry){setOriginPlace(p.geometry.location);setOriginText(p.formatted_address||p.name);if(destPlace){const{lat:lat1,lng:lng1}=getLatLng(p.geometry.location);const{lat:lat2,lng:lng2}=getLatLng(destPlace);updateDistance(lat1,lng1,lat2,lng2);}}} };
  const onDestChanged=()=>{ if(destRef.current){const p=destRef.current.getPlace();if(p?.geometry){setDestPlace(p.geometry.location);setDestText(p.formatted_address||p.name);if(originPlace){const{lat:lat1,lng:lng1}=getLatLng(originPlace);const{lat:lat2,lng:lng2}=getLatLng(p.geometry.location);updateDistance(lat1,lng1,lat2,lng2);}}} };

  const startSearch=async(price)=>{
    setTimer(0);setNoDrivers(false);setDriverLocation(null);
    const oLL=getLatLng(originPlace),dLL=getLatLng(destPlace);
    try {
      const ref=await addDoc(collection(db,"bookings"),{ passengerId:user.uid,passengerName,passengerPhone,originText,destText,originLat:oLL.lat,originLng:oLL.lng,destLat:dLL.lat,destLng:dLL.lng,rideType,price,distanceKm,passengers,luggageWeight,luggageDesc,status:"pending",createdAt:serverTimestamp() });
      setBookingId(ref.id);
      setBooking({originPlace,destPlace,originText,destText,rideType,price,distanceKm,passengerPhone,passengerName,id:ref.id});
      const snap=await getDocs(query(collection(db,"drivers"),where("isOnline","==",true),where("verificationStatus","==","approved")));
      const nearbyDrivers=[];
      snap.docs.forEach(d=>{ const dd=d.data();if(dd.location&&dd.fcmToken){ const dist=getDistanceKm(oLL.lat,oLL.lng,dd.location.lat,dd.location.lng);if(dist<=1.0) nearbyDrivers.push({driverId:d.id,fcmToken:dd.fcmToken}); } });
      if(nearbyDrivers.length){
        // نخزّن التوكنات في وثيقة الحجز نفسها حتى تلتقطها Cloud Function
        // (onCreate على bookings) وترسل إشعار FCM فعلي للسائقين القريبين.
        try {
          await updateDoc(doc(db,"bookings",ref.id),{
            nearbyDriverIds: nearbyDrivers.map(d=>d.driverId),
            nearbyDriverTokens: nearbyDrivers.map(d=>d.fcmToken),
          });
        } catch(e){}
      }
      console.log(`📬 ${nearbyDrivers.length} سائق قريب`);
    } catch(e){ setBooking({originPlace,destPlace,originText,destText,rideType,price,distanceKm,passengerPhone,passengerName}); }
    setScreen("searching");
  };

  const cancelBooking=async()=>{ if(bookingId){try{await updateDoc(doc(db,"bookings",bookingId),{status:"cancelled"});}catch(e){}} setBookingId(null);setScreen("home"); };
  const finishRide=async()=>{ if(bookingId){try{await updateDoc(doc(db,"bookings",bookingId),{status:"completed",completedAt:serverTimestamp()});}catch(e){}} setShowRating(true); };
  const resetTrip=()=>{ setScreen("home");setShowRating(false);setDistanceKm(0);setBookingId(null);setFinalRating(0);setSelectedDriver(null);setShowChat(false);driverArrivedNotified.current=false; };

  // HOME
  if(screen==="home") return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
      {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
      <FloatingLang lang={lang} setLang={setLang} />
      {showForceLogout&&<ForceLogoutModal lang={lang} onConfirm={handleForceLogout} onCancel={handleForceLogoutCancel} />}
      <div style={{ padding:"48px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ fontSize:13,color:C.textMuted }}>{t.hello}</div>
          <div style={{ fontSize:18,fontWeight:800,color:C.text }}>{passengerName}</div>
          {passengerPhone&&<div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>📱 {passengerPhone}</div>}
          {passengerData?.points>0&&<div style={{ fontSize:11,color:C.gold,marginTop:2 }}>⭐ {passengerData.points} {lang==="ar"?"نقطة":"points"}</div>}
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={()=>setScreen("wallet")} style={{ width:40,height:40,borderRadius:12,background:C.goldLight,border:`1px solid ${C.gold}44`,cursor:"pointer",fontSize:18 }}>💰</button>
          <button onClick={onLogout} style={{ width:40,height:40,borderRadius:12,background:C.redLight,border:"none",cursor:"pointer",fontSize:18 }}>{t.logout}</button>
        </div>
      </div>
      <TaxiMap origin={null} destination={null} showDrivers={true} />
      <div style={{ margin:"14px 20px",background:C.card,borderRadius:24,padding:20,boxShadow:C.shadow }}>
        <div style={{ fontWeight:800,fontSize:16,marginBottom:14,color:C.text }}>{t.whereGo}</div>
        <div onClick={()=>setScreen("booking")} style={{ background:C.dark,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer" }}>
          <div style={{ width:10,height:10,borderRadius:"50%",background:C.orange }} />
          <span style={{ color:"#ffffff88",fontSize:14 }}>{t.searchDest}</span>
        </div>
        <button onClick={()=>setScreen("booking")} style={{ width:"100%",marginTop:12,background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:16,padding:"16px",color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer" }}>{t.searchCar}</button>
      </div>
      <div style={{ margin:"0 20px",background:`linear-gradient(135deg,${C.dark},#1a2340)`,borderRadius:20,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid #d4a01733` }}>
        <div>
          <div style={{ fontSize:18,fontWeight:900,color:"#d4a017",letterSpacing:1 }}>AL-BURAQ</div>
          <div style={{ fontSize:12,color:"#d4a01799",marginTop:2 }}>{lang==="ar"?"🚕 خدمتك دائماً في الطريق":lang==="fr"?"🚕 Toujours en route pour vous":"🚕 Always on the road for you"}</div>
        </div>
        <img src="/logo192.png" alt="AL-BURAQ" style={{ width:60,height:60,objectFit:"contain",filter:"drop-shadow(0 4px 12px rgba(212,160,23,0.5))" }} onError={e=>e.target.style.display="none"} />
      </div>
    </div>
  );

  // WALLET
  if(screen==="wallet") return <WalletScreen userId={user?.uid} passengerData={passengerData} lang={lang} onBack={()=>setScreen("home")} />;

  // BOOKING
  if(screen==="booking") return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr",paddingBottom:30 }}>
      {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
      {showForceLogout&&<ForceLogoutModal lang={lang} onConfirm={handleForceLogout} onCancel={handleForceLogoutCancel} />}
      <div style={{ display:"flex",alignItems:"center",padding:"48px 20px 12px",gap:12 }}>
        <BackBtn onBack={()=>setScreen("home")} />
        <div style={{ fontWeight:800,fontSize:18,color:C.text }}>{t.tripDetails}</div>
      </div>
      <TaxiMap origin={originPlace} destination={destPlace} showDrivers={false} />
      {distanceKm>0&&<div style={{ display:"flex",gap:8,margin:"10px 20px 0",justifyContent:"center" }}>
        <div style={{ background:C.greenLight,borderRadius:20,padding:"6px 14px",fontSize:13,color:C.greenDark,fontWeight:700 }}>📏 {distanceKm.toFixed(1)} km</div>
        <div style={{ background:C.orangeLight,borderRadius:20,padding:"6px 14px",fontSize:14,color:C.orange,fontWeight:900 }}>💰 {suggestedPrice} DA</div>
      </div>}
      <div style={{ margin:"14px 20px",background:C.card,borderRadius:24,padding:20,boxShadow:C.shadow }}>
        <button onClick={handleGPS} disabled={gpsLoading} style={{ width:"100%",background:gpsLoading?C.border:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",marginBottom:12,fontFamily:"inherit",fontWeight:700,fontSize:14,color:gpsLoading?C.textMuted:C.greenDark }}>
          <span style={{ fontSize:18 }}>📍</span>{gpsLoading?t.locating:t.useMyLocation}
        </button>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
          <div style={{ background:C.greenLight,borderRadius:14,padding:"10px 16px",display:"flex",gap:10,alignItems:"center" }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:C.green,flexShrink:0 }} />
            <Autocomplete onLoad={ac=>originRef.current=ac} onPlaceChanged={onOriginChanged} options={{ componentRestrictions:{country:"dz"} }}>
              <input value={originText} onChange={e=>setOriginText(e.target.value)} placeholder={t.departure} style={{ background:"none",border:"none",outline:"none",fontFamily:"inherit",fontSize:14,color:C.text,width:"100%",textAlign:isRTL?"right":"left" }} />
            </Autocomplete>
          </div>
          <div style={{ background:C.orangeLight,borderRadius:14,padding:"10px 16px",display:"flex",gap:10,alignItems:"center" }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:C.orange,flexShrink:0 }} />
            <Autocomplete onLoad={ac=>destRef.current=ac} onPlaceChanged={onDestChanged} options={{ componentRestrictions:{country:"dz"} }}>
              <input value={destText} onChange={e=>setDestText(e.target.value)} placeholder={t.destination} style={{ background:"none",border:"none",outline:"none",fontFamily:"inherit",fontSize:14,color:C.text,width:"100%",textAlign:isRTL?"right":"left" }} />
            </Autocomplete>
          </div>
        </div>
        <div style={{ fontWeight:700,marginBottom:10,color:C.text }}>{t.carType}</div>
        {RIDE_TYPES_IDS.map(id=>(
          <div key={id} onClick={()=>setRideType(id)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderRadius:14,border:`2px solid ${rideType===id?C.green:C.border}`,background:rideType===id?C.greenLight:C.bg,cursor:"pointer",marginBottom:8,transition:"all 0.15s" }}>
            <div style={{ display:"flex",gap:12,alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{RIDE_ICONS[id]}</span>
              <div><div style={{ fontWeight:700,fontSize:14,color:C.text }}>{t[id]}</div><div style={{ fontSize:11,color:C.textMuted }}>⏱ {RIDE_TIMES[id]} min</div></div>
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:900,fontSize:16,color:rideType===id?C.greenDark:C.text }}>{calcPrice(distanceKm,RIDE_MULTIPLIERS[id])} DA</div>
            </div>
          </div>
        ))}
        {passengerData?.points>=50&&(
          <div style={{ background:C.goldLight,borderRadius:12,padding:"10px 14px",marginBottom:10,border:`1px solid ${C.gold}44`,fontSize:12,color:C.gold,fontWeight:600 }}>
            ⭐ لديك {passengerData.points} نقطة — يمكنك استخدامها كخصم!
          </div>
        )}
        {/* عدد الركاب */}
        <div style={{ fontWeight:700,marginBottom:10,color:C.text }}>👥 {lang==="ar"?"عدد الركاب":lang==="fr"?"Nombre de passagers":"Passengers"}</div>
        <div style={{ display:"flex",gap:8,marginBottom:16 }}>
          {[1,2,3,4].map(n=>(
            <button key={n} onClick={()=>setPassengers(n)} style={{ flex:1,padding:"12px 4px",borderRadius:14,border:`2px solid ${passengers===n?C.green:C.border}`,background:passengers===n?C.greenLight:C.bg,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:16,color:passengers===n?C.greenDark:C.text }}>
              {n} {n===1?(lang==="ar"?"راكب":lang==="fr"?"passager":"rider"):(lang==="ar"?"ركاب":lang==="fr"?"passagers":"riders")}
            </button>
          ))}
        </div>

        {/* الحمولة */}
        <div style={{ fontWeight:700,marginBottom:10,color:C.text }}>🧳 {lang==="ar"?"وزن الحمولة":lang==="fr"?"Poids des bagages":"Luggage weight"}</div>
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:12 }}>
          {[
            {id:"less25",label:lang==="ar"?"أقل من 25 كغ":lang==="fr"?"Moins de 25 kg":"Less than 25 kg",icon:"🎒"},
            {id:"25to40",label:lang==="ar"?"25 كغ — 40 كغ":lang==="fr"?"25 kg — 40 kg":"25 kg — 40 kg",icon:"🧳"},
            {id:"more40",label:lang==="ar"?"أكثر من 40 كغ":lang==="fr"?"Plus de 40 kg":"More than 40 kg",icon:"📦"},
          ].map(l=>(
            <div key={l.id} onClick={()=>setLuggageWeight(l.id)} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:14,border:`2px solid ${luggageWeight===l.id?C.orange:C.border}`,background:luggageWeight===l.id?C.orangeLight:C.bg,cursor:"pointer" }}>
              <div style={{ width:22,height:22,borderRadius:"50%",border:`2px solid ${luggageWeight===l.id?C.orange:C.textLight}`,background:luggageWeight===l.id?C.orange:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                {luggageWeight===l.id&&<span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:16 }}>{l.icon}</span>
              <span style={{ fontSize:14,fontWeight:luggageWeight===l.id?700:500,color:luggageWeight===l.id?C.orange:C.text }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* نوع الحمولة */}
        <input value={luggageDesc} onChange={e=>setLuggageDesc(e.target.value)}
          placeholder={lang==="ar"?"نوع الحمولة: مثال: حقائب، مواد بناء...":lang==="fr"?"Type de bagages: Ex: valises, matériaux...":"Luggage type: e.g. bags, materials..."}
          style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 16px",fontFamily:"inherit",fontSize:13,color:C.text,outline:"none",textAlign:isRTL?"right":"left",marginBottom:14 }} />

        <button onClick={()=>{if(originPlace&&destPlace)setScreen("offer");}} style={{ width:"100%",marginTop:4,background:originPlace&&destPlace?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border,border:"none",borderRadius:16,padding:16,color:originPlace&&destPlace?"#fff":C.textMuted,fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:originPlace&&destPlace?"pointer":"default" }}>
          {originPlace&&destPlace?`${t.sendOffer} (${suggestedPrice} DA)`:t.searchDest}
        </button>
      </div>
    </div>
  );

  // OFFER
  if(screen==="offer") return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr",paddingBottom:40 }}>
      {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
      {showForceLogout&&<ForceLogoutModal lang={lang} onConfirm={handleForceLogout} onCancel={handleForceLogoutCancel} />}
      <div style={{ display:"flex",alignItems:"center",padding:"48px 20px 16px",gap:12 }}>
        <BackBtn onBack={()=>setScreen("booking")} />
        <div><div style={{ fontWeight:800,fontSize:18,color:C.text }}>{t.offerPrice}</div><div style={{ fontSize:12,color:C.textMuted }}>{distanceKm.toFixed(1)} كم</div></div>
      </div>
      <div style={{ margin:"0 20px 14px",background:C.card,borderRadius:24,padding:24,boxShadow:C.shadow,textAlign:"center" }}>
        <div style={{ fontSize:13,color:C.textMuted,marginBottom:4 }}>{t.yourOffer}</div>
        <div style={{ fontSize:64,fontWeight:900,color:offerPrice>suggestedPrice?C.blue:C.green,lineHeight:1,transition:"color 0.3s" }}>{offerPrice}</div>
        <div style={{ fontSize:18,color:C.textMuted,marginBottom:20 }}>{t.dzd}</div>
        <input type="range" min={suggestedPrice} max={Math.round(suggestedPrice*2)} step={10} value={offerPrice} onChange={e=>setOfferPrice(Number(e.target.value))} style={{ width:"100%",accentColor:C.green,cursor:"pointer",marginBottom:8,height:6 }} />
        <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:C.textLight }}>
          <span style={{ color:C.green,fontWeight:700 }}>{t.minPrice} {suggestedPrice} DA</span>
          <span>{Math.round(suggestedPrice*2)} DA</span>
        </div>
      </div>
      <div style={{ margin:"0 20px 14px",background:C.card,borderRadius:20,padding:18,boxShadow:C.shadow }}>
        <div style={{ display:"flex",gap:8 }}>
          {[{label:t.calculated,value:suggestedPrice,color:C.green},{label:t.up20,value:Math.round(suggestedPrice*1.2),color:C.orange},{label:t.up50,value:Math.round(suggestedPrice*1.5),color:C.blue}].map((s,i)=>(
            <button key={i} onClick={()=>setOfferPrice(s.value)} style={{ flex:1,padding:"10px 4px",borderRadius:12,border:`2px solid ${offerPrice===s.value?s.color:C.border}`,background:offerPrice===s.value?s.color+"15":C.bg,cursor:"pointer",fontFamily:"inherit",textAlign:"center" }}>
              <div style={{ fontSize:13,fontWeight:800,color:offerPrice===s.value?s.color:C.text }}>{s.value} DA</div>
              <div style={{ fontSize:9,color:C.textMuted,marginTop:2 }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ margin:"0 20px" }}>
        <button onClick={()=>startSearch(offerPrice)} style={{ width:"100%",background:`linear-gradient(135deg,${C.dark},#1a2340)`,border:"1px solid #d4a01733",borderRadius:16,padding:18,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:17,cursor:"pointer" }}>
          {t.sendOffer} — {offerPrice} DA
        </button>
      </div>
    </div>
  );

  // SEARCHING
  if(screen==="searching") return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr",paddingBottom:40 }}>
      {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
      {showForceLogout&&<ForceLogoutModal lang={lang} onConfirm={handleForceLogout} onCancel={handleForceLogoutCancel} />}
      <TaxiMap origin={booking?.originPlace} destination={booking?.destPlace} showDrivers={true} />
      <div style={{ padding:"14px 20px 0" }}>
        <div style={{ fontWeight:800,fontSize:18,color:C.text }}>{t.searching}</div>
        <div style={{ fontSize:13,color:C.textMuted }}>{t.yourOffer2} {booking?.price} DA · {booking?.distanceKm?.toFixed(1)} km · ⏱ {timer}s</div>
      </div>
      <div style={{ margin:"20px auto",width:100,height:100,position:"relative",display:"flex",alignItems:"center",justifyContent:"center" }}>
        {[0,1,2].map(i=><div key={i} style={{ position:"absolute",width:30+i*25,height:30+i*25,borderRadius:"50%",border:`2px solid ${C.green}`,animation:"pg 1.5s ease-out infinite",animationDelay:`${i*0.4}s` }} />)}
        <img src="/logo192.png" alt="" style={{ width:40,height:40,objectFit:"contain",zIndex:1 }} onError={e=>{e.target.style.display="none";}} />
        <style>{`@keyframes pg{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(1.5);opacity:0}}`}</style>
      </div>
      {noDrivers&&(
        <div style={{ margin:"14px 20px",background:C.orangeLight,borderRadius:20,padding:20,border:`1px solid ${C.orange}44`,textAlign:"center" }}>
          <div style={{ fontSize:36,marginBottom:8 }}>😔</div>
          <div style={{ fontWeight:800,color:C.orange,fontSize:16,marginBottom:16 }}>{t.noDrivers}</div>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={()=>{setOfferPrice(Math.round((booking?.price||suggestedPrice)*1.2));setScreen("offer");}} style={{ flex:1,background:`linear-gradient(135deg,${C.orange},#ea580c)`,border:"none",borderRadius:14,padding:"12px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:14 }}>{t.raisePrice}</button>
            <button onClick={cancelBooking} style={{ flex:1,background:C.redLight,border:"none",borderRadius:14,padding:"12px",color:C.red,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14 }}>{t.cancel}</button>
          </div>
        </div>
      )}
      {!noDrivers&&<div style={{ margin:"14px 20px" }}><button onClick={cancelBooking} style={{ width:"100%",background:C.redLight,border:"none",borderRadius:14,padding:"12px",color:C.red,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14 }}>{t.cancelTrip}</button></div>}
    </div>
  );

  // FOUND
  if(screen==="found") return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
      {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
      {showForceLogout&&<ForceLogoutModal lang={lang} onConfirm={handleForceLogout} onCancel={handleForceLogoutCancel} />}
      {showChat&&bookingId&&<ChatBox bookingId={bookingId} userId={user?.uid} userName={passengerName} otherName={selectedDriver?.name||"السائق"} lang={lang} onClose={()=>setShowChat(false)} />}
      {showReport&&<ReportModal targetId={selectedDriver?.uid||bookingId} targetName={selectedDriver?.name||"السائق"} targetType="driver" reporterId={user?.uid} reporterName={passengerName} onClose={()=>setShowReport(false)} lang={lang} />}
      <PassengerTrackingMap passengerLocation={passengerGPS||(originPlace?getLatLng(originPlace):null)} driverLocation={driverLocation} destinationLocation={destPlace?getLatLng(destPlace):null} mode="pickup" lang={lang} />
      <div style={{ margin:"14px 20px",background:C.card,borderRadius:24,padding:22,boxShadow:C.shadow }}>
        <div style={{ textAlign:"center",marginBottom:16 }}>
          <div style={{ fontSize:44 }}>🎉</div>
          <div style={{ fontWeight:900,fontSize:20,color:C.text }}>{t.accepted}</div>
          {eta&&<div style={{ background:C.greenLight,borderRadius:12,padding:"6px 16px",marginTop:8,display:"inline-block" }}><span style={{ fontSize:15,fontWeight:800,color:C.greenDark }}>⏱ ~{eta} {t.etaMin}</span></div>}
        </div>
        <div style={{ background:C.bg,borderRadius:16,padding:16,marginBottom:14 }}>
          <div style={{ display:"flex",gap:12,alignItems:"center",marginBottom:10 }}>
            <div style={{ width:52,height:52,borderRadius:12,background:C.dark,overflow:"hidden",border:`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>
              {selectedDriver?.carFrontUrl?<img src={selectedDriver.carFrontUrl} alt="سيارة" style={{ width:"100%",height:"100%",objectFit:"cover" }} />:selectedDriver?.selfieUrl?<img src={selectedDriver.selfieUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />:"🚗"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800,fontSize:15,color:C.text }}>{selectedDriver?.name||"السائق"}</div>
              <div style={{ fontSize:12,color:C.textMuted }}>{selectedDriver?.carBrand} {selectedDriver?.carModel}</div>
              {selectedDriver?.rating>0&&<StarRating rating={Math.round(selectedDriver.rating)} size={14} />}
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontWeight:900,fontSize:18,color:C.greenDark }}>{booking?.price} DA</div>
              <div style={{ fontSize:11,color:C.textMuted }}>{booking?.distanceKm?.toFixed(1)} km</div>
            </div>
          </div>
          <div style={{ background:C.dark,borderRadius:14,padding:12,textAlign:"center" }}>
            <div style={{ fontSize:11,color:"#ffffff88",marginBottom:4 }}>{t.verifyCode} — {t.giveDriver}</div>
            <div style={{ fontSize:32,fontWeight:900,color:"#fff",letterSpacing:8 }}>{Math.floor(1000+Math.random()*9000)}</div>
          </div>
        </div>
        {selectedDriver?.phone&&<a href={`tel:${selectedDriver.phone}`} style={{ display:"flex",alignItems:"center",gap:10,background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:12,padding:"12px 14px",marginBottom:10,textDecoration:"none" }}>
          <span style={{ fontSize:22 }}>📞</span>
          <div style={{ flex:1 }}><div style={{ fontSize:11,color:C.textMuted }}>{t.driverPhone}</div><div style={{ fontSize:16,fontWeight:900,color:C.green,direction:"ltr" }}>{selectedDriver.phone}</div></div>
          <div style={{ background:C.green,borderRadius:8,padding:"6px 12px",fontSize:12,color:"#fff",fontWeight:700 }}>{t.call}</div>
        </a>}
        {/* Chat Button */}
        <button onClick={()=>setShowChat(true)} style={{ width:"100%",background:C.blueLight,border:`1px solid ${C.blue}44`,borderRadius:12,padding:"12px",color:C.blue,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          <span style={{ fontSize:18 }}>💬</span>{t.chat}
        </button>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={()=>setShowReport(true)} style={{ flex:1,background:`${C.orange}15`,border:`1px solid ${C.orange}44`,borderRadius:12,padding:12,color:C.orange,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:12 }}>🚨</button>
          <button onClick={cancelBooking} style={{ flex:1,background:C.redLight,border:"none",borderRadius:12,padding:12,color:C.red,fontFamily:"inherit",fontWeight:700,cursor:"pointer" }}>{t.cancelBtn}</button>
          <button onClick={()=>{setElapsed(0);setScreen("ride");}} style={{ flex:2,background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:12,padding:12,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer" }}>{t.trackTrip}</button>
        </div>
      </div>
      <SOSButton passengerName={passengerName} bookingId={bookingId} />
    </div>
  );

  // RIDE
  if(screen==="ride"){
    const mins=Math.floor(elapsed/60),secs=elapsed%60;
    if(showRating) return (
      <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
        {finalRating>0?(
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:24,gap:16 }}>
            <div style={{ fontSize:80 }}>{finalRating>=4?"🌟":"⭐"}</div>
            <div style={{ fontWeight:900,fontSize:24,color:C.text }}>{t.thankRating}</div>
            <div style={{ background:C.goldLight,borderRadius:16,padding:"16px 24px",textAlign:"center",border:`1px solid ${C.gold}44` }}>
              <div style={{ fontSize:13,color:C.gold,fontWeight:700 }}>🎁 {lang==="ar"?"ربحت 5 نقاط على هذه الرحلة!":"Vous avez gagné 5 points!"}</div>
              <div style={{ fontSize:20,fontWeight:900,color:C.gold,marginTop:4 }}>⭐ {(passengerData?.points||0)} {lang==="ar"?"نقطة":"points"}</div>
            </div>
            <button onClick={resetTrip} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:16,padding:"16px 40px",color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer",marginTop:8 }}>{t.backHome}</button>
          </div>
        ):(
          <RatingModal booking={{...booking,id:bookingId,passengerId:user?.uid,driverId:selectedDriver?.uid}} driver={selectedDriver} onSubmit={r=>setFinalRating(r)} onSkip={resetTrip} lang={lang} />
        )}
      </div>
    );
    return (
      <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"Cairo,sans-serif",direction:isRTL?"rtl":"ltr" }}>
        {fcmToast&&<NotificationToast notification={fcmToast} onClose={()=>setFcmToast(null)} />}
        {showForceLogout&&<ForceLogoutModal lang={lang} onConfirm={handleForceLogout} onCancel={handleForceLogoutCancel} />}
        {showChat&&bookingId&&<ChatBox bookingId={bookingId} userId={user?.uid} userName={passengerName} otherName={selectedDriver?.name||"السائق"} lang={lang} onClose={()=>setShowChat(false)} />}
        {showReport&&<ReportModal targetId={selectedDriver?.uid||bookingId} targetName={selectedDriver?.name||"السائق"} targetType="driver" reporterId={user?.uid} reporterName={passengerName} onClose={()=>setShowReport(false)} lang={lang} />}
        <PassengerTrackingMap passengerLocation={passengerGPS||(originPlace?getLatLng(originPlace):null)} driverLocation={driverLocation} destinationLocation={destPlace?getLatLng(destPlace):null} mode="ride" lang={lang} />
        <div style={{ margin:"14px 20px",background:C.card,borderRadius:24,padding:20,boxShadow:C.shadow }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
            <div style={{ background:C.greenLight,borderRadius:12,padding:"8px 14px" }}><div style={{ fontSize:10,color:C.green }}>{t.tripDuration}</div><div style={{ fontWeight:800,color:C.greenDark }}>{mins}:{secs.toString().padStart(2,"0")}</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:11,color:C.textMuted }}>{t.dest}</div><div style={{ fontWeight:700,color:C.text,fontSize:12,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{destText}</div></div>
            <div style={{ background:C.dark,borderRadius:12,padding:"8px 14px",textAlign:"center" }}><div style={{ fontSize:10,color:"#ffffff88" }}>{t.price}</div><div style={{ fontWeight:800,color:"#fff" }}>{booking?.price} DA</div></div>
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:8 }}>
            <button onClick={()=>setShowChat(true)} style={{ flex:1,background:C.blueLight,border:`1px solid ${C.blue}44`,borderRadius:12,padding:"10px",color:C.blue,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              <span>💬</span>{t.chat}
            </button>
            <button onClick={()=>setShowReport(true)} style={{ width:44,background:`${C.orange}15`,border:`1px solid ${C.orange}44`,borderRadius:12,padding:"10px",color:C.orange,fontFamily:"inherit",cursor:"pointer",fontSize:16 }}>🚨</button>
          </div>
          {destPlace&&<button onClick={()=>{ const d=getLatLng(destPlace); openNavigation(d.lat,d.lng); }} style={{ width:"100%",background:`linear-gradient(135deg,${C.googleBlue},#1557b0)`,border:"none",borderRadius:14,padding:13,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}><span style={{ fontSize:18 }}>🗺️</span>{t.trackRoute}</button>}
          <button onClick={finishRide} style={{ width:"100%",background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:16,cursor:"pointer" }}>{t.arrived}</button>
        </div>
        <SOSButton passengerName={passengerName} bookingId={bookingId} />
      </div>
    );
  }
  return null;
}

// ===== MAIN =====
export default function App() {
  const mapsResult = useJsApiLoader({ googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || "", libraries: LIBRARIES, language: "ar", region: "DZ" });
  const isLoaded = mapsResult.isLoaded;
  const loadError = mapsResult.loadError;
  const[screen,setScreen]=useState("welcome");
  const[role,setRole]=useState(null);
  const[user,setUser]=useState(null);
  const[lang,setLang]=useState(localStorage.getItem("taxidz_lang")||"ar");

  const changeLang=l=>{setLang(l);localStorage.setItem("taxidz_lang",l);};
  const resetGuardRef = useRef(false);

  useEffect(()=>{
    const u=onAuthStateChanged(auth,async u=>{
      if(u){
        setUser(u);
        if(resetGuardRef.current || sessionStorage.getItem("taxidz_reset_in_progress")) return; // بصدد استرجاع كلمة المرور — لا تنتقل تلقائياً للتطبيق
        const savedRole=localStorage.getItem("taxidz_role");
        if(savedRole){setRole(savedRole);setScreen("app");return;}
        try {
          await new Promise(r=>setTimeout(r,800));
          // تحقق من كلا الـ collections
          const savedRole=localStorage.getItem("taxidz_role");
          if(savedRole==="passenger"){
            const pSnap=await getDoc(doc(db,"passengers",u.uid));
            if(pSnap.exists()){const d=pSnap.data();if(d.name)localStorage.setItem("taxidz_name",d.name);if(d.phone)localStorage.setItem("taxidz_phone",d.phone);setRole("passenger");setScreen("app");return;}
          }
          if(savedRole==="driver"){
            const dSnap=await getDoc(doc(db,"drivers",u.uid));
            if(dSnap.exists()){setRole("driver");setScreen("app");return;}
          }
          // بدون دور محفوظ — ابحث في كليهما
          const pSnap=await getDoc(doc(db,"passengers",u.uid));
          if(pSnap.exists()){const d=pSnap.data();if(d.name)localStorage.setItem("taxidz_name",d.name);if(d.phone)localStorage.setItem("taxidz_phone",d.phone);localStorage.setItem("taxidz_role","passenger");setRole("passenger");setScreen("app");return;}
          const dSnap=await getDoc(doc(db,"drivers",u.uid));
          if(dSnap.exists()){localStorage.setItem("taxidz_role","driver");setRole("driver");setScreen("app");return;}
        } catch(e){console.log("Auth check:",e);}
        setScreen("welcome");
      } else {
        setUser(null);setRole(null);setScreen("welcome");localStorage.removeItem("taxidz_role");
      }
    });
    return()=>u();
  },[]);

  const handleLogout=async()=>{
    if(role==="driver"&&user?.uid){try{await setDoc(doc(db,"drivers",user.uid),{isOnline:false},{merge:true});}catch(e){}}
    try{await signOut(auth);}catch(e){}
    setUser(null);setRole(null);setScreen("welcome");
    ["taxidz_role","taxidz_phone","taxidz_name"].forEach(k=>localStorage.removeItem(k));
  };

  const handleAuthSuccess=r=>{setRole(r);localStorage.setItem("taxidz_role",r);setScreen("app");};

  if(loadError) return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg }}><div style={{ textAlign:"center" }}><div style={{ fontSize:48 }}>⚠️</div><div style={{ fontWeight:800,color:C.text }}>خطأ في الخريطة</div></div></div>;
  if(!isLoaded) return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg }}><div style={{ textAlign:"center" }}><img src="/logo192.png" alt="" style={{ width:80,height:80,marginBottom:16 }} onError={e=>e.target.style.display="none"} /><div style={{ fontWeight:700,color:C.text }}>جارٍ تحميل AL-BURAQ...</div></div></div>;

  return (
    <div style={{ maxWidth:390,margin:"0 auto",minHeight:"100vh" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      {screen==="welcome"&&<WelcomeScreen onSelect={r=>{setRole(r);setScreen("auth");}} lang={lang} setLang={changeLang} />}
      {screen==="auth"&&<AuthForm role={role} onSuccess={handleAuthSuccess} onBack={()=>{setRole(null);setScreen("welcome");}} lang={lang} setLang={changeLang} resetGuardRef={resetGuardRef} />}
      {screen==="app"&&role==="passenger"&&<PassengerApp onLogout={handleLogout} user={user} lang={lang} setLang={changeLang} />}
      {screen==="app"&&role==="driver"&&<DriverDashboard user={user} onLogout={handleLogout} />}
    </div>
  );
}