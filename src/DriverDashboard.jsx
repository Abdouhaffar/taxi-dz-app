import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, collection, query, where, addDoc, orderBy, getDocs, limit, increment } from "firebase/firestore";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { db } from "./firebase";

const LIBRARIES = ["places"];
const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
const SESSION_KEY = "taxidz_session_id";

const C = {
  bg:"#0f1117", card:"#1a1d27", border:"#2a2d3e",
  green:"#00b37e", greenLight:"#00b37e22", greenDark:"#007a55",
  orange:"#f97316", orangeDark:"#ea580c",
  red:"#ef4444", redLight:"#ef444422",
  blue:"#3b82f6", blueLight:"#3b82f615",
  yellow:"#f59e0b", yellowLight:"#f59e0b22",
  gold:"#d4a017", goldLight:"#d4a01722",
  text:"#ffffff", textMuted:"#94a3b8", textLight:"#64748b",
};

const BASE_PRICE=40, PRICE_PER_KM=30, MIN_PRICE=100;
const calcPrice=(km)=>{ if(!km||km<=0) return MIN_PRICE; const p=Math.round(BASE_PRICE+km*PRICE_PER_KM); return km<2?Math.max(p,MIN_PRICE):p; };
const getDistKm=(lat1,lng1,lat2,lng2)=>{ const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); };
const openNavigation=(lat,lng)=>window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`,"_blank");

const WILAYAS=["01 - أدرار","02 - الشلف","03 - الأغواط","04 - أم البواقي","05 - باتنة","06 - بجاية","07 - بسكرة","08 - بشار","09 - البليدة","10 - البويرة","11 - تمنراست","12 - تبسة","13 - تلمسان","14 - تيارت","15 - تيزي وزو","16 - الجزائر العاصمة","17 - الجلفة","18 - جيجل","19 - سطيف","20 - سعيدة","21 - سكيكدة","22 - سيدي بلعباس","23 - عنابة","24 - قالمة","25 - قسنطينة","26 - المدية","27 - مستغانم","28 - المسيلة","29 - معسكر","30 - ورقلة","31 - وهران","32 - البيض","33 - إليزي","34 - برج بوعريريج","35 - بومرداس","36 - الطارف","37 - تندوف","38 - تيسمسيلت","39 - الوادي","40 - خنشلة","41 - سوق أهراس","42 - تيبازة","43 - ميلة","44 - عين الدفلى","45 - النعامة","46 - عين تموشنت","47 - غرداية","48 - غليزان","49 - تيميمون","50 - برج باجي مختار","51 - أولاد جلال","52 - بني عباس","53 - عين صالح","54 - إن قزام","55 - تقرت","56 - جانت","57 - المغير","58 - المنيعة","59 - بريكة","60 - أفلو","61 - الأبيض سيدي الشيخ","62 - قصر الشلالة","63 - بوسعادة","64 - مسعد","65 - عين وسارة","66 - بئر العاتر","67 - القنطرة","68 - العريشة","69 - قصر البخاري"];
const CAR_BRANDS=["RENAULT","PEUGEOT","TOYOTA","HYUNDAI","KIA","VOLKSWAGEN","DACIA","FORD","NISSAN","MERCEDES","BMW","SUZUKI","MITSUBISHI","SEAT","OPEL","CITROEN","FIAT","HONDA","MAZDA","CHEVROLET","أخرى (أدخل يدوياً)"];
const CAR_MODELS={ RENAULT:["Clio","Symbol","Logan","Megane","Kangoo","Fluence","Captur"],PEUGEOT:["206","207","208","301","308","405","406","Partner"],TOYOTA:["Corolla","Yaris","Camry","RAV4","Hilux"],HYUNDAI:["i10","i20","i30","Accent","Elantra","Tucson"],KIA:["Picanto","Rio","Cerato","Sportage"],VOLKSWAGEN:["Golf","Polo","Passat","Tiguan","Jetta"],DACIA:["Logan","Sandero","Duster","Dokker","Lodgy"],FORD:["Fiesta","Focus","Fusion","Transit"],NISSAN:["Micra","Sunny","Almera","Tiida","Qashqai"],MERCEDES:["C200","E200","A180","Sprinter","Vito"],BMW:["316i","318i","320i","520i"],SUZUKI:["Alto","Swift","Vitara","Jimny"],MITSUBISHI:["Lancer","Colt","Galant","Outlander"],SEAT:["Ibiza","Leon","Altea"],OPEL:["Corsa","Astra","Vectra","Zafira"],CITROEN:["C3","C4","C5","Berlingo"],FIAT:["Punto","Bravo","Tipo","Doblo"],HONDA:["Jazz","Civic","Accord","CR-V"],MAZDA:["Mazda2","Mazda3","Mazda6","CX-5"],CHEVROLET:["Aveo","Cruze","Captiva","Spark"],"أخرى (أدخل يدوياً)":[] };
const YEARS=Array.from({length:30},(_,i)=>String(2024-i));
const COLORS=["أبيض","أسود","رمادي","فضي","أحمر","أزرق","أخضر","بيج","بني","برتقالي","بنفسجي","ذهبي","أصفر"];
const STEPS=[{id:"info",label:"معلوماتك",icon:"👤"},{id:"vehicle",label:"السيارة",icon:"🚗"},{id:"docs",label:"الوثائق",icon:"📄"}];

const REPORT_REASONS_PASSENGER=["سلوك غير لائق","إلغاء متكرر بعد القبول","معلومات مزيفة","تحرش أو إزعاج","رفض الدفع","تهديد أو عنف","أخرى"];

// ===== REPORT MODAL =====
function DriverReportModal({ targetId, targetName, driverId, driverName, onClose }) {
  const [selected,setSelected]=useState("");
  const [custom,setCustom]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const handleSubmit=async()=>{
    if(!selected) return; setSaving(true);
    try { await addDoc(collection(db,"reports"),{targetId,targetName,targetType:"passenger",reporterId:driverId,reporterName:driverName,reason:selected==="أخرى"?custom:selected,status:"pending",createdAt:serverTimestamp()}); setDone(true); } catch(e){}
    setSaving(false);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.card,borderRadius:"24px 24px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:430,fontFamily:"'Cairo',sans-serif",direction:"rtl" }}>
        {done?(
          <div style={{ textAlign:"center",padding:"20px 0" }}>
            <div style={{ fontSize:56,marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:8 }}>تم إرسال التبليغ</div>
            <button onClick={onClose} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:"12px 32px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer" }}>إغلاق</button>
          </div>
        ):(
          <>
            <div style={{ textAlign:"center",marginBottom:20 }}><div style={{ fontSize:40,marginBottom:8 }}>🚨</div><div style={{ fontWeight:900,fontSize:18,color:C.text }}>تبليغ عن {targetName}</div></div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
              {REPORT_REASONS_PASSENGER.map((r,i)=>(
                <div key={i} onClick={()=>setSelected(r)} style={{ padding:"12px 16px",borderRadius:12,border:`2px solid ${selected===r?C.red:C.border}`,background:selected===r?C.redLight:C.bg,cursor:"pointer",fontSize:14,color:selected===r?C.red:C.text,fontWeight:selected===r?700:500,display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",border:`2px solid ${selected===r?C.red:C.textLight}`,background:selected===r?C.red:"transparent",flexShrink:0 }} />{r}
                </div>
              ))}
            </div>
            {selected==="أخرى"&&<textarea value={custom} onChange={e=>setCustom(e.target.value)} rows={3} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",resize:"none",direction:"rtl",marginBottom:12 }} />}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={onClose} style={{ flex:1,background:C.border,border:"none",borderRadius:14,padding:14,color:C.text,fontFamily:"inherit",fontWeight:600,cursor:"pointer" }}>إلغاء</button>
              <button onClick={handleSubmit} disabled={!selected||saving} style={{ flex:2,background:selected?`linear-gradient(135deg,${C.red},#dc2626)`:C.border,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:selected?"pointer":"default" }}>
                {saving?"جارٍ...":"🚨 إرسال التبليغ"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== PASSWORD RESET =====
function DriverPasswordReset({ onClose }) {
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const handleReset=async()=>{
    if(!email){setError("أدخل بريدك الإلكتروني");return;}
    setLoading(true);setError("");
    try { const{sendPasswordResetEmail,getAuth}=await import("firebase/auth"); await sendPasswordResetEmail(getAuth(),email); setSent(true); }
    catch(e){setError("البريد غير موجود أو خاطئ");}
    setLoading(false);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)",padding:20 }}>
      <div style={{ background:C.card,borderRadius:24,padding:28,width:"100%",maxWidth:380,fontFamily:"'Cairo',sans-serif",direction:"rtl",border:`1px solid ${C.border}` }}>
        {sent?(
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:56,marginBottom:12 }}>📧</div>
            <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:8 }}>تم إرسال رابط الاسترجاع!</div>
            <div style={{ fontSize:13,color:C.textMuted,marginBottom:20 }}>تحقق من بريدك الإلكتروني</div>
            <button onClick={onClose} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:"12px 32px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer" }}>موافق</button>
          </div>
        ):(
          <>
            <div style={{ textAlign:"center",marginBottom:20 }}><div style={{ fontSize:48,marginBottom:8 }}>🔐</div><div style={{ fontWeight:900,fontSize:18,color:C.text }}>نسيت كلمة المرور؟</div></div>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",direction:"ltr",textAlign:"left",marginBottom:12 }} />
            {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.red,marginBottom:12 }}>{error}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={onClose} style={{ flex:1,background:C.border,border:"none",borderRadius:14,padding:14,color:C.text,fontFamily:"inherit",fontWeight:600,cursor:"pointer" }}>إلغاء</button>
              <button onClick={handleReset} disabled={loading} style={{ flex:2,background:`linear-gradient(135deg,#3b82f6,#1d4ed8)`,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",opacity:loading?0.7:1 }}>
                {loading?"جارٍ...":"📧 إرسال الرابط"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== CHAT BOX =====
function ChatBox({ bookingId, userId, userName, otherName, onClose }) {
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState("");
  const bottomRef=useRef(null);
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
    try { await addDoc(collection(db,"chats",bookingId,"messages"),{text:msg,senderId:userId,senderName:userName,createdAt:serverTimestamp()}); } catch(e){}
  };
  return (
    <div style={{ position:"fixed",inset:0,background:C.bg,zIndex:1500,display:"flex",flexDirection:"column",fontFamily:"'Cairo',sans-serif",direction:"rtl" }}>
      <div style={{ background:C.card,padding:"48px 20px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}` }}>
        <button onClick={onClose} style={{ width:36,height:36,borderRadius:10,background:`${C.blue}22`,border:"none",color:C.blue,cursor:"pointer",fontSize:16 }}>←</button>
        <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:16,color:C.text }}>💬 المحادثة</div><div style={{ fontSize:12,color:C.textMuted }}>{otherName}</div></div>
        <div style={{ width:10,height:10,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite" }} />
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10 }}>
        {messages.length===0&&<div style={{ textAlign:"center",padding:"40px 0",color:C.textMuted,fontSize:13 }}>ابدأ المحادثة مع {otherName}</div>}
        {messages.map(m=>{
          const isMe=m.senderId===userId;
          return (
            <div key={m.id} style={{ display:"flex",justifyContent:isMe?"flex-start":"flex-end" }}>
              <div style={{ maxWidth:"75%",background:isMe?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.card,borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",border:isMe?"none":`1px solid ${C.border}` }}>
                <div style={{ fontSize:14,color:isMe?"#fff":C.text }}>{m.text}</div>
                <div style={{ fontSize:10,color:isMe?"#ffffff88":C.textLight,marginTop:4,textAlign:"left" }}>
                  {m.createdAt?.toDate?.()?.toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"})||""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ background:C.card,padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center" }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="اكتب رسالة..."
          style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:24,padding:"12px 18px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",direction:"rtl" }} />
        <button onClick={sendMsg} disabled={!text.trim()} style={{ width:46,height:46,borderRadius:"50%",background:text.trim()?`linear-gradient(135deg,${C.green},${C.greenDark})`:C.border,border:"none",cursor:text.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>➤</button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ===== SUBSCRIPTION SCREEN =====
function SubscriptionScreen({ uid, driverData, subscriptionEnabled, onBack }) {
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("choose"); // choose | confirm | pending
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const receiptRef = useRef(null);

  const plans = [
    { id:"daily", label:"العرض اليومي", price:100, duration:1, icon:"🌙", color:C.blue, desc:"24 ساعة كاملة" },
    { id:"weekly", label:"العرض الأسبوعي", price:600, duration:7, icon:"📅", color:C.green, desc:"7 أيام · وفر 100 دج", badge:"الأكثر طلباً" },
    { id:"monthly", label:"العرض الشهري", price:2200, duration:30, icon:"📆", color:C.gold, desc:"30 يوماً · وفر 800 دج", badge:"الأوفر" },
  ];

  const currentPlan = driverData?.subscription;
  const isActive = currentPlan?.status === "active" && currentPlan?.expiresAt?.toDate?.() > new Date();
  const daysLeft = isActive ? Math.ceil((currentPlan.expiresAt.toDate() - new Date()) / (1000*60*60*24)) : 0;

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setReceipt(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submitRequest = async () => {
    if (!selected || !receipt) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "drivers", uid), {
        subscriptionRequest: {
          planId: selected.id,
          planLabel: selected.label,
          price: selected.price,
          duration: selected.duration,
          receipt,
          status: "pending",
          requestedAt: serverTimestamp(),
        }
      }, { merge: true });
      setStep("pending");
    } catch(e) { console.log(e); }
    setSaving(false);
  };

  // إذا الاشتراكات معطّلة
  if (!subscriptionEnabled) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl" }}>
      <div style={{ display:"flex", alignItems:"center", padding:"48px 20px 16px", gap:12 }}>
        <button onClick={onBack} style={{ width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:C.text }}>←</button>
        <div style={{ fontWeight:800, fontSize:18, color:C.text }}>💳 الاشتراكات</div>
      </div>
      <div style={{ margin:"40px 20px", background:C.card, borderRadius:24, padding:40, border:`1px solid ${C.border}`, textAlign:"center" }}>
        <div style={{ fontSize:72, marginBottom:20 }}>🎁</div>
        <div style={{ fontWeight:900, fontSize:22, color:C.green, marginBottom:12 }}>التطبيق مجاني حالياً!</div>
        <div style={{ fontSize:14, color:C.textMuted, lineHeight:1.8, marginBottom:20 }}>
          استمتع بجميع مميزات AL-BURAQ مجاناً خلال فترة الإطلاق.<br/>
          سيتم إشعارك عند تفعيل نظام الاشتراكات.
        </div>
        <div style={{ background:C.goldLight, borderRadius:16, padding:"16px 20px", border:`1px solid ${C.gold}44` }}>
          <div style={{ fontSize:13, color:C.gold, fontWeight:700 }}>⭐ أنت من المستخدمين الأوائل</div>
          <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>ستحصل على مزايا خاصة عند تفعيل الاشتراكات</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Cairo',sans-serif", direction:"rtl", paddingBottom:40 }}>
      <div style={{ display:"flex", alignItems:"center", padding:"48px 20px 16px", gap:12 }}>
        <button onClick={onBack} style={{ width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:C.text }}>←</button>
        <div style={{ fontWeight:800, fontSize:18, color:C.text }}>💳 الاشتراكات</div>
      </div>

      {/* الاشتراك الحالي */}
      {isActive && (
        <div style={{ margin:"0 20px 16px", background:`linear-gradient(135deg,${C.green},${C.greenDark})`, borderRadius:20, padding:20, color:"#fff" }}>
          <div style={{ fontSize:13, opacity:0.8, marginBottom:4 }}>اشتراكك النشط</div>
          <div style={{ fontSize:20, fontWeight:900, marginBottom:4 }}>{currentPlan.planLabel}</div>
          <div style={{ fontSize:13, opacity:0.8 }}>⏳ يتبقى {daysLeft} يوم</div>
        </div>
      )}

      {step === "choose" && (<>
        <div style={{ padding:"0 20px", marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.text, marginBottom:12 }}>اختر عرضك</div>
          {plans.map(plan=>(
            <div key={plan.id} onClick={()=>setSelected(plan)}
              style={{ background:C.card, borderRadius:20, padding:20, marginBottom:10, border:`2px solid ${selected?.id===plan.id?plan.color:C.border}`, cursor:"pointer", position:"relative", overflow:"hidden", transition:"all 0.2s" }}>
              {plan.badge && <div style={{ position:"absolute", top:12, left:12, background:plan.color, color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{plan.badge}</div>}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div style={{ width:48,height:48,borderRadius:14,background:`${plan.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{plan.icon}</div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{plan.label}</div>
                    <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{plan.desc}</div>
                  </div>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontWeight:900, fontSize:22, color:plan.color }}>{plan.price} دج</div>
                  <div style={{ fontSize:11, color:C.textMuted }}>{plan.duration} يوم</div>
                </div>
              </div>
              {selected?.id===plan.id && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:plan.color, borderRadius:"20px 20px 0 0" }} />}
            </div>
          ))}
        </div>

        {/* معلومات الدفع */}
        <div style={{ margin:"0 20px 16px", background:C.card, borderRadius:20, padding:20, border:`1px solid ${C.border}` }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.text, marginBottom:12 }}>💳 طريقة الدفع</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ background:`${C.blue}15`, borderRadius:14, padding:"14px 16px", border:`1px solid ${C.blue}33` }}>
              <div style={{ fontWeight:700, color:C.blue, fontSize:13, marginBottom:4 }}>🏦 تحويل CCP / Baridimob</div>
              <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>رقم الحساب: <span style={{ direction:"ltr", display:"inline-block" }}>00799999999 — كلي 99</span></div>
              <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>الاسم: AL-BURAQ TAXI DZ</div>
            </div>
            <div style={{ background:`${C.green}15`, borderRadius:14, padding:"12px 16px", border:`1px solid ${C.green}33` }}>
              <div style={{ fontSize:12, color:C.green, fontWeight:700 }}>📌 بعد التحويل أرسل إيصال الدفع للتفعيل</div>
            </div>
          </div>
        </div>

        <div style={{ padding:"0 20px" }}>
          <button onClick={()=>selected&&setStep("confirm")} disabled={!selected}
            style={{ width:"100%", background:selected?`linear-gradient(135deg,${selected.color},${selected.color}cc)`:C.border, border:"none", borderRadius:16, padding:16, color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:16, cursor:selected?"pointer":"default" }}>
            {selected?`اشترك في ${selected.label} — ${selected.price} دج`:"اختر عرضاً أولاً"}
          </button>
        </div>
      </>)}

      {step === "confirm" && selected && (
        <div style={{ padding:"0 20px" }}>
          <div style={{ background:C.card, borderRadius:20, padding:20, border:`1px solid ${C.border}`, marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:16, color:C.text, marginBottom:16 }}>تأكيد الاشتراك</div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.textMuted }}>العرض</span>
              <span style={{ color:C.text, fontWeight:700 }}>{selected.label}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.textMuted }}>المبلغ</span>
              <span style={{ color:selected.color, fontWeight:900, fontSize:18 }}>{selected.price} دج</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0" }}>
              <span style={{ color:C.textMuted }}>المدة</span>
              <span style={{ color:C.text, fontWeight:700 }}>{selected.duration} يوم</span>
            </div>
          </div>

          {/* رفع الإيصال */}
          <div style={{ background:C.card, borderRadius:20, padding:20, border:`1px solid ${C.border}`, marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.text, marginBottom:12 }}>📸 إيصال الدفع</div>
            <input type="file" accept="image/*" ref={receiptRef} onChange={handleReceiptUpload} style={{ display:"none" }} />
            {receipt ? (
              <div style={{ position:"relative", borderRadius:12, overflow:"hidden", border:`2px solid ${C.green}` }}>
                <img src={receipt} alt="إيصال" style={{ width:"100%", maxHeight:200, objectFit:"cover", display:"block" }} />
                <div style={{ position:"absolute", top:8, right:8, background:C.green, borderRadius:20, padding:"3px 10px", fontSize:11, color:"#fff", fontWeight:700 }}>✅ تم الرفع</div>
                <button onClick={()=>receiptRef.current?.click()} style={{ position:"absolute", bottom:8, left:8, background:C.card, border:"none", borderRadius:8, padding:"6px 12px", color:C.text, fontFamily:"inherit", cursor:"pointer", fontSize:12, fontWeight:700 }}>🔄 تغيير</button>
              </div>
            ) : (
              <div onClick={()=>receiptRef.current?.click()} style={{ height:140, borderRadius:12, border:`2px dashed ${C.border}`, background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, cursor:"pointer" }}>
                <span style={{ fontSize:36 }}>📷</span>
                <span style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>اضغط لرفع صورة الإيصال</span>
                <span style={{ fontSize:11, color:C.textLight }}>JPG, PNG</span>
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setStep("choose")} style={{ flex:1, background:C.border, border:"none", borderRadius:14, padding:14, color:C.text, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>← رجوع</button>
            <button onClick={submitRequest} disabled={!receipt||saving}
              style={{ flex:2, background:receipt?`linear-gradient(135deg,${selected.color},${selected.color}cc)`:C.border, border:"none", borderRadius:14, padding:14, color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:receipt?"pointer":"default", fontSize:15 }}>
              {saving?"جارٍ الإرسال...":"✅ إرسال طلب الاشتراك"}
            </button>
          </div>
        </div>
      )}

      {step === "pending" && (
        <div style={{ margin:"40px 20px", background:C.card, borderRadius:24, padding:40, border:`1px solid ${C.border}`, textAlign:"center" }}>
          <div style={{ fontSize:64, marginBottom:16 }}>⏳</div>
          <div style={{ fontWeight:900, fontSize:20, color:C.text, marginBottom:12 }}>طلبك قيد المراجعة</div>
          <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.8, marginBottom:20 }}>
            سيتم مراجعة إيصال الدفع وتفعيل اشتراكك خلال<br/>
            <span style={{ color:C.orange, fontWeight:700 }}>24 ساعة كحد أقصى</span>
          </div>
          <button onClick={onBack} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`, border:"none", borderRadius:14, padding:"12px 32px", color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:"pointer" }}>🏠 العودة للرئيسية</button>
        </div>
      )}
    </div>
  );
}

// ===== EARNINGS SCREEN =====
function EarningsScreen({ uid, driverData, onBack }) {
  const [rides,setRides]=useState([]);
  const [period,setPeriod]=useState("today");
  useEffect(()=>{
    const fetchRides=async()=>{
      try {
        const q=query(collection(db,"bookings"),where("driverId","==",uid),where("status","in",["completed","rated"]),orderBy("createdAt","desc"),limit(30));
        const snap=await getDocs(q);
        setRides(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch(e){console.log(e);}
    };
    fetchRides();
  },[uid]);

  const now=new Date();
  const filterRides=(r)=>{
    const d=r.createdAt?.toDate?.();
    if(!d) return false;
    if(period==="today") return d.toDateString()===now.toDateString();
    if(period==="week") return (now-d)<7*24*60*60*1000;
    if(period==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  };
  const filtered=rides.filter(filterRides);
  const totalEarnings=filtered.reduce((s,r)=>s+(r.price||0),0);
  const totalKm=filtered.reduce((s,r)=>s+(r.distanceKm||0),0);

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl" }}>
      <div style={{ display:"flex",alignItems:"center",padding:"48px 20px 16px",gap:12 }}>
        <button onClick={onBack} style={{ width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:C.text }}>←</button>
        <div style={{ fontWeight:800,fontSize:18,color:C.text }}>📊 الإيرادات والرحلات</div>
      </div>

      {/* Period selector */}
      <div style={{ display:"flex",gap:8,padding:"0 20px",marginBottom:16 }}>
        {[{id:"today",label:"اليوم"},{id:"week",label:"الأسبوع"},{id:"month",label:"الشهر"},{id:"all",label:"الكل"}].map(p=>(
          <button key={p.id} onClick={()=>setPeriod(p.id)} style={{ flex:1,padding:"8px",borderRadius:12,border:`1px solid ${period===p.id?C.green:C.border}`,background:period===p.id?C.greenLight:C.card,color:period===p.id?C.green:C.textMuted,fontFamily:"inherit",cursor:"pointer",fontSize:12,fontWeight:period===p.id?700:500 }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"0 20px",marginBottom:16 }}>
        <div style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,borderRadius:20,padding:20,textAlign:"center" }}>
          <div style={{ fontSize:28,fontWeight:900,color:"#fff" }}>{totalEarnings.toLocaleString()} دج</div>
          <div style={{ fontSize:12,color:"#ffffff88",marginTop:4 }}>إجمالي الإيرادات</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,${C.blue},#1d4ed8)`,borderRadius:20,padding:20,textAlign:"center" }}>
          <div style={{ fontSize:28,fontWeight:900,color:"#fff" }}>{filtered.length}</div>
          <div style={{ fontSize:12,color:"#ffffff88",marginTop:4 }}>عدد الرحلات</div>
        </div>
        <div style={{ background:C.card,borderRadius:20,padding:16,border:`1px solid ${C.border}`,textAlign:"center" }}>
          <div style={{ fontSize:20,fontWeight:900,color:C.orange }}>{totalKm.toFixed(1)} كم</div>
          <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>المسافة الكلية</div>
        </div>
        <div style={{ background:C.card,borderRadius:20,padding:16,border:`1px solid ${C.border}`,textAlign:"center" }}>
          <div style={{ fontSize:20,fontWeight:900,color:C.yellow }}>⭐ {driverData?.rating||"جديد"}</div>
          <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>متوسط التقييم</div>
        </div>
      </div>

      {/* Rides list */}
      <div style={{ padding:"0 20px 30px" }}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:12 }}>آخر الرحلات</div>
        {filtered.length===0&&<div style={{ textAlign:"center",padding:"30px 0",color:C.textMuted }}>لا توجد رحلات في هذه الفترة</div>}
        {filtered.map(r=>(
          <div key={r.id} style={{ background:C.card,borderRadius:16,padding:14,marginBottom:10,border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <div style={{ fontSize:12,color:C.textMuted }}>{r.createdAt?.toDate?.()?.toLocaleDateString("ar-DZ")||"—"}</div>
              <div style={{ fontWeight:900,fontSize:16,color:C.green }}>{r.price} دج</div>
            </div>
            <div style={{ fontSize:13,color:C.text,marginBottom:2 }}>📍 {r.originText?.substring(0,30)||"—"}</div>
            <div style={{ fontSize:13,color:C.text,marginBottom:8 }}>🏁 {r.destText?.substring(0,30)||"—"}</div>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ background:`${C.blue}22`,borderRadius:10,padding:"4px 10px",fontSize:12,color:C.blue }}>{r.distanceKm?.toFixed(1)} كم</div>
              {r.passengerRating&&<div style={{ background:C.yellowLight,borderRadius:10,padding:"4px 10px",fontSize:12,color:C.yellow }}>⭐ {r.passengerRating}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== FIELDS =====
function SelectField({ label, value, onChange, options, placeholder, required=true }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:13,color:C.textMuted,marginBottom:6,fontWeight:600 }}>{label} {required&&"*"}</div>
      <div style={{ position:"relative" }}>
        <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",fontFamily:"inherit",fontSize:14,color:value?C.text:C.textLight,outline:"none",cursor:"pointer",appearance:"none",direction:"rtl" }}>
          <option value="" disabled>{placeholder}</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <div style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.textMuted,pointerEvents:"none" }}>▼</div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type="text", dir="rtl", required=true }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:13,color:C.textMuted,marginBottom:6,fontWeight:600 }}>{label} {required&&"*"}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",direction:dir,textAlign:dir==="ltr"?"left":"right" }} />
    </div>
  );
}

const compressToBase64=(file,maxWidth=800)=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=ev=>{ const img=new Image(); img.onload=()=>{ const canvas=document.createElement("canvas"); let{width,height}=img; if(width>maxWidth){height=(height*maxWidth)/width;width=maxWidth;} canvas.width=width;canvas.height=height;canvas.getContext("2d").drawImage(img,0,0,width,height); resolve(canvas.toDataURL("image/jpeg",0.7)); }; img.onerror=reject; img.src=ev.target.result; };
  reader.onerror=reject; reader.readAsDataURL(file);
});

function PhotoUpload({ label, preview, onSelect, required=true }) {
  const inputRef=useRef(null);
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
        <div style={{ fontSize:13,color:C.textMuted,fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:11,color:required?C.orange:C.textLight,fontWeight:600 }}>{required?"إلزامي":"اختياري"}</div>
      </div>
      <input type="file" accept="image/*" ref={inputRef} onChange={onSelect} style={{ display:"none" }} />
      {preview?(
        <div style={{ position:"relative",borderRadius:12,overflow:"hidden",border:`2px solid ${C.green}` }}>
          <img src={preview} alt={label} style={{ width:"100%",height:160,objectFit:"cover",display:"block" }} />
          <button onClick={()=>inputRef.current?.click()} style={{ position:"absolute",bottom:8,left:8,background:C.card,border:"none",borderRadius:8,padding:"6px 12px",color:C.text,fontFamily:"inherit",cursor:"pointer",fontSize:12,fontWeight:700 }}>🔄 تغيير</button>
          <div style={{ position:"absolute",top:8,right:8,background:C.green,borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700 }}>✅</div>
        </div>
      ):(
        <div onClick={()=>inputRef.current?.click()} style={{ height:130,borderRadius:12,border:`2px dashed ${C.border}`,background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer" }}>
          <span style={{ fontSize:32 }}>📷</span>
          <span style={{ fontSize:13,color:C.textMuted,fontWeight:600 }}>اضغط لرفع الصورة</span>
          <span style={{ fontSize:11,color:C.textLight }}>JPG, PNG — أقصى 5MB</span>
        </div>
      )}
    </div>
  );
}

// ===== VERIFICATION FORM =====
function DriverVerificationForm({ uid, userEmail, existingData, onDone, isUpdate=false }) {
  const [step,setStep]=useState(isUpdate?1:0);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [gender,setGender]=useState(existingData?.gender||"");
  const [firstName,setFirstName]=useState(existingData?.firstName||"");
  const [lastName,setLastName]=useState(existingData?.lastName||"");
  const [birthDate,setBirthDate]=useState(existingData?.birthDate||"");
  const [driverType,setDriverType]=useState(existingData?.driverType||"تاكسي");
  const [wilaya,setWilaya]=useState(existingData?.wilaya||"");
  const [daira,setDaira]=useState(existingData?.daira||"");
  const [hasLicense,setHasLicense]=useState(existingData?.hasLicense||false);
  const [hasCar,setHasCar]=useState(existingData?.hasCar||false);
  const [carYear,setCarYear]=useState(existingData?.carYear||"");
  const [carBrand,setCarBrand]=useState(existingData?.carBrand||"");
  const [carBrandManual,setCarBrandManual]=useState("");
  const [carModel,setCarModel]=useState(existingData?.carModel||"");
  const [carModelManual,setCarModelManual]=useState("");
  const [carColor,setCarColor]=useState(existingData?.carColor||"");
  const [plateNumber,setPlateNumber]=useState(existingData?.plateNumber||"");
  const [ownerConfirm,setOwnerConfirm]=useState(existingData?.ownerConfirm||"");
  const [selfieB64,setSelfieB64]=useState(null);
  const [carFrontB64,setCarFrontB64]=useState(null);
  const [carSideB64,setCarSideB64]=useState(null);
  const [grayCardB64,setGrayCardB64]=useState(null);
  const [licenseB64,setLicenseB64]=useState(null);

  const isManualBrand=carBrand==="أخرى (أدخل يدوياً)";
  const finalBrand=isManualBrand?carBrandManual:carBrand;
  const isManualModel=isManualBrand||carModel==="أخرى";
  const finalModel=isManualModel?carModelManual:carModel;

  const handlePhoto=async(e,setter)=>{ const file=e.target.files[0];if(!file) return;if(file.size>5*1024*1024){setError("الصورة أكبر من 5MB");return;}setError("");try{setter(await compressToBase64(file));}catch{setError("خطأ في الصورة");} };
  const validateStep=()=>{
    if(step===0&&(!gender||!firstName||!lastName||!birthDate||!wilaya)){setError("يرجى إكمال جميع الحقول ⚠️");return false;}
    if(step===1&&(!carYear||!finalBrand||!finalModel||!carColor||!plateNumber||!ownerConfirm)){setError("يرجى إكمال بيانات السيارة ⚠️");return false;}
    if(step===2&&!isUpdate&&(!carFrontB64||!carSideB64||!grayCardB64)){setError("يرجى رفع الصور الإلزامية ⚠️");return false;}
    if(step===2&&isUpdate&&!grayCardB64){setError("يرجى رفع صورة البطاقة الرمادية الجديدة ⚠️");return false;}
    return true;
  };
  const handleSubmit=async()=>{
    if(!validateStep()) return;
    // التحقق من السن القانوني (18 سنة)
    if(birthDate && !isUpdate){
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if(m < 0 || (m===0 && today.getDate() < birth.getDate())) age--;
      if(age < 18){
        setError("⚠️ يجب أن يكون عمرك 18 سنة أو أكثر للتسجيل كسائق");
        return;
      }
    }
    setSaving(true);setError("");
    try {
      const updateData={ verificationStatus:"pending",carYear,carBrand:finalBrand,carModel:finalModel,carColor,plateNumber:plateNumber.trim().toUpperCase(),ownerConfirm,hasLicense,hasCar,grayCardUrl:grayCardB64,rejectionReason:null,submittedAt:serverTimestamp() };
      if(!isUpdate) Object.assign(updateData,{ uid,email:userEmail||"",name:`${firstName} ${lastName}`,firstName,lastName,gender,birthDate,driverType,wilaya,daira,selfieUrl:selfieB64,carFrontUrl:carFrontB64,carSideUrl:carSideB64,licenseUrl:licenseB64||null,role:"driver",isOnline:false,location:null,rating:0,totalRatings:0,totalRides:0,points:0 });
      else { if(selfieB64) updateData.selfieUrl=selfieB64; if(carFrontB64) updateData.carFrontUrl=carFrontB64; if(carSideB64) updateData.carSideUrl=carSideB64; if(licenseB64) updateData.licenseUrl=licenseB64; }
      await setDoc(doc(db,"drivers",uid),updateData,{merge:true});
      onDone();
    } catch(err){setError("خطأ: "+(err.message||"حاول مرة أخرى"));}
    setSaving(false);
  };
  const modelOptions=carBrand&&!isManualBrand?[...(CAR_MODELS[carBrand]||[]),"أخرى"]:[];
  const stepsToShow=isUpdate?STEPS.slice(1):STEPS;
  const currentStepIdx=isUpdate?step-1:step;
  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl" }}>
      <div style={{ background:C.card,padding:"48px 20px 20px",borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:13,color:C.textMuted,marginBottom:4 }}>{isUpdate?"تحديث بيانات السيارة":"توثيق حساب السائق"}</div>
        <div style={{ fontSize:20,fontWeight:900,color:C.text,marginBottom:16 }}>{STEPS[step].icon} {STEPS[step].label}</div>
        <div style={{ display:"flex",gap:6 }}>{stepsToShow.map((s,i)=><div key={s.id} style={{ flex:1,height:4,borderRadius:2,background:i<=currentStepIdx?C.orange:C.border,transition:"all 0.3s" }} />)}</div>
      </div>
      <div style={{ padding:"20px 20px 120px" }}>
        {step===0&&!isUpdate&&(<>
          <SelectField label="الجنس" value={gender} onChange={setGender} placeholder="اختر الجنس" options={["ذكر","أنثى"]} />
          <InputField label="الاسم" value={firstName} onChange={setFirstName} placeholder="أدخل اسمك" />
          <InputField label="اللقب" value={lastName} onChange={setLastName} placeholder="أدخل لقبك" />
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13,color:C.textMuted,marginBottom:6,fontWeight:600 }}>تاريخ الميلاد *</div>
            <input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",fontFamily:"inherit",fontSize:14,color:C.text,outline:"none",direction:"ltr" }} />
          </div>
          <SelectField label="نوع السائق" value={driverType} onChange={setDriverType} placeholder="اختر" options={["تاكسي","سيارة خاصة","حافلة صغيرة"]} />
          <SelectField label="الولاية" value={wilaya} onChange={setWilaya} placeholder="اختر ولايتك" options={WILAYAS} />
          <InputField label="الدائرة" value={daira} onChange={setDaira} placeholder="أدخل الدائرة" required={false} />
          <div style={{ background:C.card,borderRadius:14,padding:16,marginBottom:14,border:`1px solid ${C.border}` }}>
            {[{label:"لديّ سيارة خاصة",value:hasCar,set:setHasCar},{label:"لديّ رخصة سياقة سارية",value:hasLicense,set:setHasLicense}].map((item,i)=>(
              <div key={i} onClick={()=>item.set(!item.value)} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",cursor:"pointer",borderBottom:i===0?`1px solid ${C.border}`:"none" }}>
                <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${item.value?C.orange:C.border}`,background:item.value?C.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{item.value&&<span style={{ color:"#fff",fontSize:13,fontWeight:900 }}>✓</span>}</div>
                <span style={{ fontSize:13,color:C.text }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>)}
        {step===1&&(<>
          {isUpdate&&<div style={{ background:`${C.orange}22`,borderRadius:12,padding:"10px 14px",marginBottom:16,border:`1px solid ${C.orange}44` }}><div style={{ fontSize:12,color:C.orange,fontWeight:600 }}>🔄 أدخل بيانات سيارتك الجديدة — ستُعاد المصادقة من الإدارة</div></div>}
          <SelectField label="سنة الصنع" value={carYear} onChange={setCarYear} placeholder="اختر السنة" options={YEARS} />
          <SelectField label="الماركة" value={carBrand} onChange={v=>{setCarBrand(v);setCarModel("");setCarModelManual("");setCarBrandManual("");}} placeholder="اختر الماركة" options={CAR_BRANDS} />
          {isManualBrand&&<InputField label="أدخل الماركة يدوياً" value={carBrandManual} onChange={setCarBrandManual} placeholder="مثال: LADA..." dir="ltr" />}
          {!isManualBrand&&carBrand&&<SelectField label="الموديل" value={carModel} onChange={setCarModel} placeholder="اختر الموديل" options={modelOptions} />}
          {(isManualBrand||carModel==="أخرى")&&<InputField label="أدخل الموديل يدوياً" value={carModelManual} onChange={setCarModelManual} placeholder="مثال: 206 Plus..." dir="ltr" />}
          <SelectField label="اللون" value={carColor} onChange={setCarColor} placeholder="اختر اللون" options={COLORS} />
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13,color:C.textMuted,marginBottom:6,fontWeight:600 }}>رقم اللوحة *</div>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:10,padding:"12px 14px",fontSize:14,color:C.green,fontWeight:700,whiteSpace:"nowrap" }}>🇩🇿 DZ</div>
              <input value={plateNumber} onChange={e=>setPlateNumber(e.target.value.toUpperCase())} placeholder="213-01-DZ" maxLength={15} style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",fontFamily:"inherit",fontSize:15,color:C.text,outline:"none",direction:"ltr",textAlign:"left",fontWeight:700 }} />
            </div>
          </div>
          <SelectField label="هل تملك إذن باستخدام السيارة؟" value={ownerConfirm} onChange={setOwnerConfirm} placeholder="اختر" options={["نعم، أنا المالك","نعم، لديّ إذن المالك"]} />
        </>)}
        {step===2&&(<>
          {isUpdate&&<div style={{ background:`${C.blue}15`,borderRadius:12,padding:"10px 14px",marginBottom:16,border:`1px solid ${C.blue}44` }}><div style={{ fontSize:12,color:C.blue,fontWeight:600 }}>📌 البطاقة الرمادية إلزامية · باقي الصور اختيارية</div></div>}
          <PhotoUpload label="🤳 صورة شخصية (سيلفي)" preview={selfieB64} onSelect={e=>handlePhoto(e,setSelfieB64)} required={false} />
          <PhotoUpload label="🚗 صورة السيارة من الأمام" preview={carFrontB64} onSelect={e=>handlePhoto(e,setCarFrontB64)} required={!isUpdate} />
          <PhotoUpload label="🚗 صورة السيارة من الجانب" preview={carSideB64} onSelect={e=>handlePhoto(e,setCarSideB64)} required={!isUpdate} />
          <PhotoUpload label="📄 البطاقة الرمادية" preview={grayCardB64} onSelect={e=>handlePhoto(e,setGrayCardB64)} required={true} />
          <PhotoUpload label="🪪 رخصة السياقة" preview={licenseB64} onSelect={e=>handlePhoto(e,setLicenseB64)} required={false} />
        </>)}
        {error&&<div style={{ background:C.redLight,borderRadius:12,padding:"12px 16px",color:C.red,fontSize:13,marginBottom:16,border:`1px solid ${C.red}44`,textAlign:"center" }}>{error}</div>}
        <div style={{ display:"flex",gap:10,marginTop:8 }}>
          {step>(isUpdate?1:0)&&<button onClick={()=>{setStep(s=>s-1);setError("");}} style={{ flex:1,background:C.border,border:"none",borderRadius:14,padding:"14px",color:C.text,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14 }}>← السابق</button>}
          {step<STEPS.length-1
            ?<button onClick={()=>{if(validateStep()){setError("");setStep(s=>s+1);}}} style={{ flex:2,background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:15 }}>التالي →</button>
            :<button onClick={handleSubmit} disabled={saving} style={{ flex:2,background:saving?C.border:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:saving?"default":"pointer",fontSize:15,opacity:saving?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {saving?<><span style={{ width:16,height:16,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 1s linear infinite" }} />جارٍ الحفظ...</>:"✅ إرسال للمراجعة"}
            </button>}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function useDriverStatus(uid) {
  const [status,setStatus]=useState(null);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!uid){setLoading(false);return;}
    const u=onSnapshot(doc(db,"drivers",uid),snap=>{if(snap.exists()){const d=snap.data();setStatus(d.verificationStatus||"none");setData(d);}else{setStatus("none");setData(null);}setLoading(false);},()=>{setStatus("none");setLoading(false);});
    return()=>u();
  },[uid]);
  return{status,data,loading};
}

function PendingView({onLogout}) {
  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ background:C.card,borderRadius:24,padding:40,textAlign:"center",maxWidth:360,width:"100%",border:`1px solid ${C.border}` }}>
        <img src="/logo192.png" alt="" style={{ width:80,height:80,objectFit:"contain",marginBottom:16 }} onError={e=>e.target.style.display="none"} />
        <div style={{ fontSize:72,marginBottom:16 }}>⏳</div>
        <div style={{ fontWeight:900,fontSize:22,color:C.text,marginBottom:12 }}>طلبك قيد المراجعة</div>
        <div style={{ fontSize:14,color:C.textMuted,lineHeight:1.8,marginBottom:20 }}>تم إرسال بياناتك للأدمن.<br/>عادةً <span style={{ color:C.orange,fontWeight:700 }}>24-48 ساعة</span></div>
        <button onClick={onLogout} style={{ background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 20px",color:C.textMuted,fontFamily:"inherit",cursor:"pointer",fontSize:13 }}>🚪 تسجيل الخروج</button>
      </div>
    </div>
  );
}

function RejectedView({data,onRetry}) {
  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ background:C.card,borderRadius:24,padding:32,textAlign:"center",maxWidth:360,width:"100%",border:`1px solid ${C.red}44` }}>
        <div style={{ fontSize:64,marginBottom:16 }}>❌</div>
        <div style={{ fontWeight:900,fontSize:20,color:C.red,marginBottom:12 }}>تم رفض التوثيق</div>
        {data?.rejectionReason&&<div style={{ background:C.redLight,borderRadius:12,padding:"14px",marginBottom:20,textAlign:"right",border:`1px solid ${C.red}44` }}><div style={{ fontSize:12,color:C.red,marginBottom:4,fontWeight:700 }}>سبب الرفض:</div><div style={{ fontSize:14,color:C.text }}>{data.rejectionReason}</div></div>}
        <button onClick={onRetry} style={{ width:"100%",background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:15 }}>🔄 إعادة التوثيق</button>
      </div>
    </div>
  );
}

// ===== GPS MAP =====
function DriverGPSMap({ driverLocation, passengerLocation, destLocation, mode }) {
  const [directions,setDirections]=useState(null);
  const mapRef=useRef(null);
  const makeMarker=(emoji,color)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><circle cx='22' cy='22' r='20' fill='${color}' stroke='white' stroke-width='3'/><text x='22' y='29' text-anchor='middle' font-size='20'>${emoji}</text></svg>`);
  const target=mode==="pickup"?passengerLocation:destLocation;
  useEffect(()=>{ if(!driverLocation||!target||!window.google){setDirections(null);return;} new window.google.maps.DirectionsService().route({origin:driverLocation,destination:target,travelMode:"DRIVING"},(r,s)=>{if(s==="OK")setDirections(r);}); },[driverLocation,target]);
  useEffect(()=>{ if(driverLocation&&mapRef.current) mapRef.current.panTo(driverLocation); },[driverLocation]);
  return (
    <div style={{ margin:"0 20px",borderRadius:16,overflow:"hidden",border:`2px solid ${mode==="pickup"?C.orange:C.green}` }}>
      <div style={{ background:C.card,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <span style={{ fontSize:13,fontWeight:700,color:C.text }}>{mode==="pickup"?"🗺️ التوجه نحو الراكب":"🗺️ التوجه نحو الوجهة"}</span>
        {driverLocation&&target&&<span style={{ fontSize:12,color:mode==="pickup"?C.orange:C.green,fontWeight:700 }}>{getDistKm(driverLocation.lat,driverLocation.lng,target.lat,target.lng).toFixed(1)} كم</span>}
      </div>
      <GoogleMap mapContainerStyle={{ width:"100%",height:"220px" }} center={driverLocation||passengerLocation||{lat:36.737,lng:3.086}} zoom={15} onLoad={m=>mapRef.current=m} options={{ disableDefaultUI:true,zoomControl:true }}>
        {driverLocation&&<Marker position={driverLocation} icon={{ url:makeMarker("🚕","#0a0f1e"),scaledSize:new window.google.maps.Size(44,44) }} />}
        {passengerLocation&&mode==="pickup"&&<Marker position={passengerLocation} icon={{ url:makeMarker("📍",C.green),scaledSize:new window.google.maps.Size(44,44) }} />}
        {destLocation&&mode==="ride"&&<Marker position={destLocation} icon={{ url:makeMarker("🏁",C.blue),scaledSize:new window.google.maps.Size(44,44) }} />}
        {directions&&<DirectionsRenderer directions={directions} options={{ polylineOptions:{ strokeColor:mode==="pickup"?C.orange:C.green,strokeWeight:5,strokeOpacity:0.85 },suppressMarkers:true }} />}
      </GoogleMap>
    </div>
  );
}

// ===== MAIN DASHBOARD =====
export default function DriverDashboard({ user, onLogout }) {
  const {isLoaded}=useJsApiLoader({googleMapsApiKey:process.env.REACT_APP_GOOGLE_MAPS_KEY||"",libraries:LIBRARIES,language:"ar",region:"DZ"});
  const {status,data,loading}=useDriverStatus(user?.uid);
  const [online,setOnline]=useState(false);
  const [tab,setTab]=useState("home");
  const [bookings,setBookings]=useState([]);
  const [acceptedBooking,setAcceptedBooking]=useState(null);
  const [driverScreen,setDriverScreen]=useState("dashboard");
  const [driverLocation,setDriverLocation]=useState(null);
  const [showReport,setShowReport]=useState(false);
  const [showSessionAlert,setShowSessionAlert]=useState(false);
  const [showReset,setShowReset]=useState(false);
  const [showChangeVehicle,setShowChangeVehicle]=useState(false);
  const [showChat,setShowChat]=useState(false);
  const [showEarnings,setShowEarnings]=useState(false);
  const [showSubscription,setShowSubscription]=useState(false);
  const watchIdRef=useRef(null);

  // Session management للسائق
  useEffect(()=>{
    if(!user?.uid||status!=="approved") return;
    const initSession = async () => {
      let sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem(SESSION_KEY, sessionId);
      }
      try {
        await setDoc(doc(db,"drivers",user.uid),{ activeSession:sessionId, lastSeen:serverTimestamp() },{ merge:true });
      } catch(e) {}
    };
    initSession();

    // مراقبة الجلسة للسائق
    const sessionUnsub = onSnapshot(doc(db,"drivers",user.uid), snap=>{
      if (!snap.exists()) return;
      const savedSession = localStorage.getItem(SESSION_KEY);
      const activeSession = snap.data()?.activeSession;
      if (activeSession && savedSession && activeSession !== savedSession) {
        setShowSessionAlert(true);
      }
    });
    return()=>sessionUnsub();
  },[user?.uid,status]);

  // تفعيل الاتصال تلقائياً
  useEffect(()=>{
    if(status!=="approved"||!user?.uid) return;
    const goOnline=async()=>{
      setOnline(true);
      navigator.geolocation?.getCurrentPosition(async pos=>{
        const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
        setDriverLocation(loc);
        try { await setDoc(doc(db,"drivers",user.uid),{isOnline:true,location:loc},{merge:true}); } catch(e){}
      });
    };
    goOnline();
    return()=>{ if(user?.uid) setDoc(doc(db,"drivers",user.uid),{isOnline:false},{merge:true}).catch(()=>{}); };
  },[status,user?.uid]);

  const startTracking=(bookingId)=>{
    if(!navigator.geolocation) return;
    watchIdRef.current=navigator.geolocation.watchPosition(async pos=>{
      const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      setDriverLocation(loc);
      try { await updateDoc(doc(db,"bookings",bookingId),{driverCurrentLocation:loc,driverLocationUpdatedAt:serverTimestamp()}); await setDoc(doc(db,"drivers",user.uid),{location:loc},{merge:true}); } catch(e){}
    },err=>console.log("GPS:",err),{enableHighAccuracy:true,maximumAge:2000,timeout:5000});
  };
  const stopTracking=()=>{ if(watchIdRef.current){navigator.geolocation.clearWatch(watchIdRef.current);watchIdRef.current=null;} };

  const toggleOnline=async()=>{
    const n=!online; setOnline(n);
    try { navigator.geolocation?.getCurrentPosition(async pos=>{ const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};if(n)setDriverLocation(loc);await setDoc(doc(db,"drivers",user.uid),{isOnline:n,location:n?loc:null},{merge:true}); },async()=>{ await setDoc(doc(db,"drivers",user.uid),{isOnline:n},{merge:true}); }); } catch(e){}
  };

  useEffect(()=>{
    if(!online||!user?.uid){setBookings([]);return;}
    const q=query(collection(db,"bookings"),where("status","==","pending"));
    const u=onSnapshot(q,snap=>{
      const now=Date.now();
      setBookings(snap.docs.map(d=>({id:d.id,...d.data()})).filter(b=>(now-(b.createdAt?.toMillis?.())||0)<10*60*1000));
    });
    return()=>u();
  },[online,user?.uid]);

  const acceptBooking=async(booking)=>{
    try {
      await updateDoc(doc(db,"bookings",booking.id),{status:"accepted",driverId:user.uid,driverInfo:{name:data?.name||"السائق",phone:data?.phone||"",carBrand:data?.carBrand||"",carModel:data?.carModel||"",carColor:data?.carColor||"",plateNumber:data?.plateNumber||"",rating:data?.rating||null,selfieUrl:data?.selfieUrl||null,carFrontUrl:data?.carFrontUrl||null,uid:user.uid},acceptedAt:serverTimestamp()});
      setAcceptedBooking(booking);setDriverScreen("pickup");setBookings([]);startTracking(booking.id);
      // نقاط للسائق عند قبول الرحلة
      await updateDoc(doc(db,"drivers",user.uid),{totalRides:increment(1)});
    } catch(e){console.log(e);}
  };
  const rejectBooking=(id)=>setBookings(p=>p.filter(b=>b.id!==id));
  const endRide=async()=>{
    stopTracking();
    if(acceptedBooking?.id){try{await updateDoc(doc(db,"bookings",acceptedBooking.id),{status:"completed",completedAt:serverTimestamp()});}catch(e){}}
    setAcceptedBooking(null);setDriverScreen("dashboard");setShowChat(false);setShowReport(false);
  };
  const handleRetry=async()=>{try{await setDoc(doc(db,"drivers",user.uid),{verificationStatus:"none",submittedAt:null,rejectionReason:null},{merge:true});}catch(e){}};

  if(loading) return <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo',sans-serif" }}><div style={{ textAlign:"center" }}><img src="/logo192.png" alt="" style={{ width:80,height:80,objectFit:"contain",marginBottom:16 }} onError={e=>e.target.style.display="none"} /><div style={{ color:C.textMuted,fontSize:14 }}>جارٍ التحقق...</div></div></div>;
  if(status==="none") return <DriverVerificationForm uid={user?.uid} userEmail={user?.email} existingData={null} onDone={()=>{}} isUpdate={false} />;
  if(status==="rejected") return <RejectedView data={data} onRetry={handleRetry} />;
  if(status==="pending") return <PendingView onLogout={onLogout} />;
  if(showChangeVehicle) return <DriverVerificationForm uid={user?.uid} userEmail={user?.email} existingData={data} onDone={()=>setShowChangeVehicle(false)} isUpdate={true} />;
  if(showEarnings) return <EarningsScreen uid={user?.uid} driverData={data} onBack={()=>setShowEarnings(false)} />;
  if(showSubscription) return <SubscriptionScreen uid={user?.uid} driverData={data} subscriptionEnabled={false} onBack={()=>setShowSubscription(false)} />;

  const passengerLoc=acceptedBooking?{lat:acceptedBooking.originLat,lng:acceptedBooking.originLng}:null;
  const destLoc=acceptedBooking?{lat:acceptedBooking.destLat,lng:acceptedBooking.destLng}:null;
  const distToTarget=driverLocation&&(driverScreen==="pickup"?passengerLoc:destLoc)?getDistKm(driverLocation.lat,driverLocation.lng,(driverScreen==="pickup"?passengerLoc:destLoc).lat,(driverScreen==="pickup"?passengerLoc:destLoc).lng):null;
  const eta=distToTarget?Math.max(1,Math.round(distToTarget/0.5)):null;

  const stats=[
    {label:"إجمالي الرحلات",value:data?.totalRides||0,icon:"🚕",color:C.green},
    {label:"التقييم",value:data?.rating||"جديد ⭐",icon:"🏆",color:C.yellow},
    {label:"الطلبات الآن",value:bookings.length,icon:"🔔",color:C.orange},
    {label:"النقاط",value:data?.points||0,icon:"⭐",color:C.gold},
  ];

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo',sans-serif",direction:"rtl" }}>
      {showChat&&acceptedBooking&&<ChatBox bookingId={acceptedBooking.id} userId={user?.uid} userName={data?.name||"السائق"} otherName={acceptedBooking.passengerName||"الراكب"} onClose={()=>setShowChat(false)} />}
      {showSessionAlert&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:24,backdropFilter:"blur(8px)" }}>
          <div style={{ background:C.card,borderRadius:24,padding:28,width:"100%",maxWidth:380,fontFamily:"'Cairo',sans-serif",direction:"rtl",border:`1px solid ${C.red}44` }}>
            <div style={{ textAlign:"center",marginBottom:20 }}>
              <div style={{ fontSize:56,marginBottom:12 }}>🔐</div>
              <div style={{ fontWeight:900,fontSize:20,color:C.text,marginBottom:8 }}>حسابك مفتوح في جهاز آخر!</div>
              <div style={{ fontSize:13,color:C.textMuted,lineHeight:1.7 }}>تم اكتشاف أن حسابك مفتوح في جهاز آخر. هل تريد إغلاق الجهاز الآخر والمتابعة هنا؟</div>
            </div>
            <div style={{ background:C.redLight,borderRadius:14,padding:"12px 16px",marginBottom:20,border:`1px solid ${C.red}44` }}>
              <div style={{ fontSize:12,color:C.red,fontWeight:600 }}>⚠️ إذا فقدت هاتفك — اضغط "إغلاق الجهاز الآخر" لحماية حسابك فوراً</div>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={async()=>{
                import("firebase/auth").then(({getAuth,signOut:so})=>{ so(getAuth()).then(()=>{ localStorage.removeItem(SESSION_KEY); localStorage.removeItem("taxidz_role"); }); });
              }} style={{ flex:1,background:C.border,border:"none",borderRadius:14,padding:14,color:C.text,fontFamily:"inherit",fontWeight:600,cursor:"pointer",fontSize:13 }}>تسجيل الخروج</button>
              <button onClick={async()=>{
                const newId=generateSessionId();
                localStorage.setItem(SESSION_KEY,newId);
                try{await setDoc(doc(db,"drivers",user.uid),{activeSession:newId,lastSeen:serverTimestamp()},{merge:true});}catch(e){}
                setShowSessionAlert(false);
              }} style={{ flex:2,background:`linear-gradient(135deg,${C.red},#dc2626)`,border:"none",borderRadius:14,padding:14,color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:13 }}>✅ إغلاق الجهاز الآخر</button>
            </div>
          </div>
        </div>
      )}
      {showReport&&acceptedBooking&&<DriverReportModal targetId={acceptedBooking.passengerId} targetName={acceptedBooking.passengerName||"الراكب"} driverId={user?.uid} driverName={data?.name||"السائق"} onClose={()=>setShowReport(false)} />}
      {showReset&&<DriverPasswordReset onClose={()=>setShowReset(false)} />}

      {/* Header */}
      <div style={{ background:C.card,padding:"48px 20px 16px",borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <div style={{ width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`3px solid ${C.border}`,overflow:"hidden" }}>
              {data?.selfieUrl?<img src={data.selfieUrl} alt="av" style={{ width:"100%",height:"100%",objectFit:"cover" }} />:"👨‍✈️"}
            </div>
            <div>
              <div style={{ fontSize:16,fontWeight:800,color:C.text }}>{data?.name||"سائق"}</div>
              <div style={{ fontSize:12,color:C.textMuted }}>{data?.carBrand} {data?.carModel} {data?.carYear}</div>
              {data?.plateNumber&&<div style={{ fontSize:11,color:C.textLight,direction:"ltr",display:"inline-block" }}>🔢 {data.plateNumber}</div>}
            </div>
          </div>
          <div onClick={toggleOnline} style={{ width:56,height:30,borderRadius:15,background:online?C.green:C.border,position:"relative",cursor:"pointer",transition:"all 0.3s" }}>
            <div style={{ position:"absolute",top:3,right:online?3:"auto",left:online?"auto":3,width:24,height:24,borderRadius:"50%",background:"#fff",transition:"all 0.3s",boxShadow:"0 2px 4px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
        {online&&<div style={{ background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:10,padding:"8px 14px",fontSize:13,color:C.green,fontWeight:700,display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ width:8,height:8,borderRadius:"50%",background:C.green,display:"inline-block",animation:"pulse 2s infinite" }} />🟢 متصل · {bookings.length} طلب
        </div>}
      </div>

      <div style={{ paddingBottom:100 }}>
        {tab==="home"&&(<>
          <div style={{ padding:"14px 20px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {stats.map((s,i)=>(
              <div key={i} onClick={i===0?()=>setShowEarnings(true):undefined} style={{ background:C.card,borderRadius:16,padding:16,border:`1px solid ${C.border}`,cursor:i===0?"pointer":"default" }}>
                <div style={{ fontSize:22,marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:18,fontWeight:900,color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* شاشة التوجه للراكب */}
          {acceptedBooking&&driverScreen==="pickup"&&isLoaded&&(
            <div style={{ margin:"14px 0" }}>
              <DriverGPSMap driverLocation={driverLocation} passengerLocation={passengerLoc} destLocation={destLoc} mode="pickup" />
              <div style={{ margin:"10px 20px",background:C.card,borderRadius:18,padding:16,border:`2px solid ${C.orange}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                  <div style={{ fontWeight:800,fontSize:14,color:C.orange }}>🚶 في طريقك للراكب</div>
                  {eta&&<div style={{ background:`${C.orange}22`,borderRadius:20,padding:"4px 12px",fontSize:13,color:C.orange,fontWeight:700 }}>⏱ ~{eta} دق</div>}
                </div>
                <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:4 }}>👤 {acceptedBooking.passengerName}</div>
                <div style={{ fontSize:12,color:C.textMuted,marginBottom:8 }}>📍 {acceptedBooking.originText}</div>
                {distToTarget&&<div style={{ background:`${C.green}22`,borderRadius:10,padding:"6px 12px",fontSize:13,color:C.green,fontWeight:700,marginBottom:10,display:"inline-block" }}>{distToTarget<1?`${Math.round(distToTarget*1000)} م`:`${distToTarget.toFixed(1)} كم`} متبقية</div>}
                <a href={`tel:${acceptedBooking.passengerPhone}`} style={{ display:"flex",alignItems:"center",gap:10,background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:12,padding:"10px 14px",marginBottom:10,textDecoration:"none" }}>
                  <span style={{ fontSize:20 }}>📞</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:11,color:C.textMuted }}>رقم الراكب</div><div style={{ fontSize:15,fontWeight:900,color:C.green,direction:"ltr" }}>{acceptedBooking.passengerPhone}</div></div>
                  <div style={{ background:C.green,borderRadius:8,padding:"5px 10px",fontSize:12,color:"#fff",fontWeight:700 }}>☎️</div>
                </a>
                {/* Chat */}
                <button onClick={()=>setShowChat(true)} style={{ width:"100%",background:C.blueLight,border:`1px solid ${C.blue}44`,borderRadius:12,padding:"10px",color:C.blue,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:13,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <span style={{ fontSize:16 }}>💬</span> محادثة مع الراكب
                </button>
                <button onClick={()=>passengerLoc&&openNavigation(passengerLoc.lat,passengerLoc.lng)} style={{ width:"100%",background:`linear-gradient(135deg,#1a73e8,#1557b0)`,border:"none",borderRadius:10,padding:"12px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:13,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <span style={{ fontSize:18 }}>🗺️</span> انطلق — Google Maps
                </button>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setShowReport(true)} style={{ flex:1,background:`${C.orange}22`,border:`1px solid ${C.orange}44`,borderRadius:10,padding:"11px",color:C.orange,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:12 }}>🚨 بلّغ</button>
                  <button onClick={endRide} style={{ flex:1,background:C.redLight,border:`1px solid ${C.red}44`,borderRadius:10,padding:"11px",color:C.red,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:12 }}>❌ إلغاء</button>
                  <button onClick={()=>setDriverScreen("ride")} style={{ flex:2,background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:10,padding:"11px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:12 }}>✅ وصلت</button>
                </div>
              </div>
            </div>
          )}

          {/* شاشة الرحلة الجارية */}
          {acceptedBooking&&driverScreen==="ride"&&isLoaded&&(
            <div style={{ margin:"14px 0" }}>
              <DriverGPSMap driverLocation={driverLocation} passengerLocation={passengerLoc} destLocation={destLoc} mode="ride" />
              <div style={{ margin:"10px 20px",background:C.card,borderRadius:18,padding:16,border:`2px solid ${C.green}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                  <div style={{ fontWeight:800,fontSize:14,color:C.green }}>🚗 الرحلة جارية</div>
                  {distToTarget&&<div style={{ background:`${C.blue}22`,borderRadius:20,padding:"4px 12px",fontSize:13,color:C.blue,fontWeight:700 }}>{distToTarget<1?`${Math.round(distToTarget*1000)} م`:`${distToTarget.toFixed(1)} كم`} للوجهة</div>}
                </div>
                <div style={{ fontSize:13,color:C.textMuted,marginBottom:12 }}>🏁 {acceptedBooking.destText}</div>
                <div style={{ display:"flex",gap:8,marginBottom:12 }}>
                  <div style={{ flex:1,background:`${C.green}22`,borderRadius:10,padding:"8px",textAlign:"center" }}><div style={{ fontSize:18,fontWeight:900,color:C.green }}>{acceptedBooking.price} دج</div><div style={{ fontSize:10,color:C.textMuted }}>السعر</div></div>
                  <div style={{ flex:1,background:`${C.orange}22`,borderRadius:10,padding:"8px",textAlign:"center" }}><div style={{ fontSize:18,fontWeight:900,color:C.orange }}>🟢</div><div style={{ fontSize:10,color:C.textMuted }}>GPS نشط</div></div>
                </div>
                <button onClick={()=>setShowChat(true)} style={{ width:"100%",background:C.blueLight,border:`1px solid ${C.blue}44`,borderRadius:12,padding:"10px",color:C.blue,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:13,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <span style={{ fontSize:16 }}>💬</span> محادثة مع الراكب
                </button>
                <button onClick={()=>destLoc&&openNavigation(destLoc.lat,destLoc.lng)} style={{ width:"100%",background:`linear-gradient(135deg,#1a73e8,#1557b0)`,border:"none",borderRadius:10,padding:"12px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:13,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <span style={{ fontSize:18 }}>🗺️</span> تتبع مسار الرحلة — Google Maps
                </button>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setShowReport(true)} style={{ flex:1,background:`${C.orange}22`,border:`1px solid ${C.orange}44`,borderRadius:10,padding:"11px",color:C.orange,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:12 }}>🚨 بلّغ</button>
                  <button onClick={endRide} style={{ flex:2,background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:12,padding:"13px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:14 }}>🏁 إنهاء الرحلة</button>
                </div>
              </div>
            </div>
          )}

          {/* الطلبات */}
          {online&&bookings.length>0&&!acceptedBooking&&(
            <div style={{ padding:"14px 20px 0" }}>
              <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:12 }}>🔔 طلبات جديدة ({bookings.length})</div>
              {bookings.map(r=>(
                <div key={r.id} style={{ background:C.card,borderRadius:18,padding:16,marginBottom:10,border:`1px solid ${C.orange}44` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:14,color:C.text }}>{r.passengerName||"راكب"}</div>
                          <div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>📍 {r.originText?.substring(0,30)}...</div>
                      <div style={{ fontSize:12,color:C.textMuted }}>🏁 {r.destText?.substring(0,30)}...</div>
                      {/* المسافة بين السائق والراكب */}
                      {driverLocation&&<div style={{ fontSize:11,color:C.blue,marginTop:3,fontWeight:700 }}>
                        🚗→👤 {getDistKm(driverLocation.lat,driverLocation.lng,r.originLat,r.originLng).toFixed(1)} كم منك
                      </div>}
                      <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>
                        📏 {r.distanceKm?.toFixed(1)} كم · 👥 {r.passengers||1} {r.passengers>1?"ركاب":"راكب"}
                        {r.luggageWeight&&` · 🧳 ${r.luggageWeight==="less25"?"<25كغ":r.luggageWeight==="25to40"?"25-40كغ":">40كغ"}`}
                      </div>
                      {r.luggageDesc&&<div style={{ fontSize:11,color:C.textMuted }}>📦 {r.luggageDesc}</div>}
                      <div style={{ fontSize:11,color:r.price>=calcPrice(r.distanceKm)?C.green:C.red,marginTop:3 }}>المعيار: {calcPrice(r.distanceKm)} دج {r.price>=calcPrice(r.distanceKm)?"✅":"⚠️"}</div>
                    </div>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ fontSize:22,fontWeight:900,color:C.orange }}>{r.price} دج</div>
                      <div style={{ fontSize:11,color:C.textMuted }}>{r.distanceKm?.toFixed(1)} كم</div>
                    </div>
                  </div>
                  <a href={`tel:${r.passengerPhone}`} style={{ display:"flex",alignItems:"center",gap:10,background:C.greenLight,border:`1px solid ${C.green}44`,borderRadius:12,padding:"10px 14px",marginBottom:10,textDecoration:"none" }}>
                    <span style={{ fontSize:20 }}>📞</span>
                    <div style={{ flex:1 }}><div style={{ fontSize:11,color:C.textMuted }}>رقم الراكب</div><div style={{ fontSize:15,fontWeight:900,color:C.green,direction:"ltr" }}>{r.passengerPhone}</div></div>
                    <div style={{ background:C.green,borderRadius:8,padding:"5px 10px",fontSize:12,color:"#fff",fontWeight:700 }}>☎️</div>
                  </a>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>rejectBooking(r.id)} style={{ flex:1,background:C.redLight,border:`1px solid ${C.red}44`,borderRadius:10,padding:"12px",color:C.red,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14 }}>❌</button>
                    <button onClick={()=>acceptBooking(r)} style={{ flex:3,background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:10,padding:"12px",color:"#fff",fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:14 }}>✅ قبول {r.price} دج</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {online&&bookings.length===0&&!acceptedBooking&&(
            <div style={{ margin:"16px 20px",background:C.card,borderRadius:20,padding:32,border:`1px solid ${C.border}`,textAlign:"center" }}>
              <div style={{ fontSize:48,marginBottom:12 }}>🕐</div>
              <div style={{ fontWeight:700,fontSize:16,color:C.text,marginBottom:8 }}>لا توجد طلبات حالياً</div>
              <div style={{ fontSize:13,color:C.textMuted }}>انتظر... ستصلك طلبات قريباً</div>
            </div>
          )}

          {!online&&(
            <div style={{ margin:"16px 20px",background:C.card,borderRadius:20,padding:32,border:`1px solid ${C.border}`,textAlign:"center" }}>
              <div style={{ fontSize:56,marginBottom:16 }}>😴</div>
              <div style={{ fontWeight:700,fontSize:18,color:C.text,marginBottom:8 }}>أنت غير متصل</div>
              <button onClick={toggleOnline} style={{ background:`linear-gradient(135deg,${C.green},${C.greenDark})`,border:"none",borderRadius:14,padding:"14px 40px",color:"#fff",fontFamily:"inherit",fontWeight:800,fontSize:15,cursor:"pointer" }}>🟢 تفعيل الاتصال</button>
            </div>
          )}
        </>)}

        {tab==="profile"&&(
          <div style={{ padding:"20px 20px 100px" }}>
            <div style={{ background:C.card,borderRadius:20,padding:28,border:`1px solid ${C.border}`,textAlign:"center",marginBottom:14 }}>
              <div style={{ width:80,height:80,borderRadius:"50%",background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 16px",border:`4px solid ${C.border}`,overflow:"hidden" }}>
                {data?.selfieUrl?<img src={data.selfieUrl} alt="av" style={{ width:"100%",height:"100%",objectFit:"cover" }} />:"👨‍✈️"}
              </div>
              <div style={{ fontWeight:900,fontSize:20,color:C.text,marginBottom:4 }}>{data?.name||"سائق"}</div>
              <div style={{ fontSize:13,color:C.textMuted,marginBottom:4 }}>{data?.email||user?.email}</div>
              <div style={{ fontSize:13,color:C.textMuted,marginBottom:4 }}>🚗 {data?.carBrand} {data?.carModel} {data?.carYear} · {data?.carColor}</div>
              <div style={{ fontSize:13,color:C.textMuted,marginBottom:4 }}>📍 {data?.wilaya}</div>
              {data?.plateNumber&&<div style={{ fontSize:13,color:C.textLight,direction:"ltr",marginBottom:8 }}>🔢 {data.plateNumber}</div>}
              <div style={{ display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap" }}>
                <div style={{ background:C.greenLight,color:C.green,padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700 }}>✅ معتمد</div>
                <div style={{ background:C.yellowLight,color:C.yellow,padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700 }}>⭐ {data?.rating||"جديد"}</div>
                <div style={{ background:C.goldLight,color:C.gold,padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700 }}>🏆 {data?.totalRides||0} رحلة</div>
              </div>
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <button onClick={()=>setShowSubscription(true)} style={{ background:`linear-gradient(135deg,${C.goldLight},#fff8e1)`,border:`1px solid ${C.gold}44`,borderRadius:16,padding:"16px 20px",color:C.text,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:12,textAlign:"right" }}>
                <span style={{ fontSize:22 }}>💳</span>
                <div style={{ flex:1 }}><div style={{ fontWeight:700, color:C.gold }}>الاشتراكات والعروض</div><div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>🎁 مجاني حالياً خلال فترة الإطلاق</div></div>
                <span style={{ color:C.textMuted }}>←</span>
              </button>
              <button onClick={()=>setShowEarnings(true)} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 20px",color:C.text,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:12,textAlign:"right" }}>
                <span style={{ fontSize:22 }}>📊</span>
                <div style={{ flex:1 }}><div style={{ fontWeight:700 }}>الإيرادات والرحلات</div><div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>إحصاءات مفصلة بالفترات</div></div>
                <span style={{ color:C.textMuted }}>←</span>
              </button>
              <button onClick={()=>setShowChangeVehicle(true)} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 20px",color:C.text,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:12,textAlign:"right" }}>
                <span style={{ fontSize:22 }}>🚗</span>
                <div style={{ flex:1 }}><div style={{ fontWeight:700 }}>تغيير السيارة</div><div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>تحديث بيانات سيارتك</div></div>
                <span style={{ color:C.textMuted }}>←</span>
              </button>
              <button onClick={()=>setShowReset(true)} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px 20px",color:C.text,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:12,textAlign:"right" }}>
                <span style={{ fontSize:22 }}>🔐</span>
                <div style={{ flex:1 }}><div style={{ fontWeight:700 }}>تغيير / استرجاع كلمة المرور</div><div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>إرسال رابط الاسترجاع لبريدك</div></div>
                <span style={{ color:C.textMuted }}>←</span>
              </button>
              <button onClick={onLogout} style={{ background:C.redLight,border:`1px solid ${C.red}44`,borderRadius:16,padding:16,color:C.red,fontFamily:"inherit",fontWeight:800,fontSize:15,cursor:"pointer" }}>🚪 تسجيل الخروج</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",padding:"8px 0 20px",zIndex:100 }}>
        {[{id:"home",label:"الرئيسية",icon:"🏠"},{id:"profile",label:"حسابي",icon:"👤"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 0" }}>
            <div style={{ fontSize:22,opacity:tab===t.id?1:0.4 }}>{t.icon}</div>
            <div style={{ fontSize:10,color:tab===t.id?C.green:C.textLight,fontWeight:tab===t.id?700:400 }}>{t.label}</div>
          </button>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
