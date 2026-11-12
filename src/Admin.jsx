import { useState, useEffect } from "react";
import { DashboardPro, LiveOps, RidesPanel, SafetyPanel, GlobalSearch, PricingPanel, RegionsPanel, PromosPanel, MissionsAdmin, ComplaintsPro, AccountsPanel, adminProStyles, useIsMobile } from "./AdminPro";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, orderBy, addDoc, increment } from "firebase/firestore";

// Firebase مستقل لصفحة الإدارة
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SUPER_ADMIN_EMAIL = "abdouhaffar@gmail.com";

// يعرض سبب فشل أي عملية كتابة بدل ما يختفي بصمت (خصوصاً permission-denied من قواعد Firestore)
const showErr = (e, action) => {
  console.error(action, e);
  const code = e?.code || "";
  let msg = e?.message || "خطأ غير معروف";
  if (code === "permission-denied") {
    msg = "🔒 مرفوض من قواعد أمان Firestore — تأكد أن قواعد Firestore تسمح للأدمن بالكتابة في هذا الجدول";
  }
  alert(`❌ فشلت العملية${action ? " (" + action + ")" : ""}:\n${msg}`);
};

const C = {
  bg: "#0f0b0d",
  sidebar: "#161113",
  card: "#161113",
  cardHover: "#211a1d",
  border: "#33262b",
  green: "#7c5cfc",
  greenLight: "#a78bfa",
  greenGlow: "#7c5cfc22",
  orange: "#a78bfa",
  orangeLight: "#a78bfa",
  red: "#da3633",
  redLight: "#f85149",
  redGlow: "#da363322",
  blue: "#7c5cfc",
  blueLight: "#a78bfa",
  blueGlow: "#7c5cfc22",
  purple: "#c4b5fd",
  purpleGlow: "#c4b5fd22",
  yellow: "#a78bfa",
  text: "#fff5f6",
  textMuted: "#c7a9ae",
  textDim: "#7a5c62",
  accent: "#a78bfa",
};

// ===== HELPERS =====
const Badge = ({ color, children }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>
);

const StatCard = ({ icon, label, value, sub, color, trend }) => (
  <div style={{ background: C.card, borderRadius: "4px 16px 16px 16px", padding: "20px 22px", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{sub}</div>}
        {trend && <div style={{ fontSize: 12, color: C.green, marginTop: 6, fontWeight: 600 }}>↑ {trend}</div>}
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
    </div>
  </div>
);

const Avatar = ({ src, name, size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, #7c5cfc, #c4b5fd)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, overflow: "hidden", flexShrink: 0, border: `2px solid ${C.border}` }}>
    {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name?.[0] || "?").toUpperCase()}
  </div>
);

const Btn = ({ onClick, children, color = C.blue, outline = false, small = false, disabled = false }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ background: outline ? "transparent" : color, border: `1px solid ${color}`, borderRadius: 8, padding: small ? "5px 12px" : "8px 16px", color: outline ? color : "#fff", fontFamily: "inherit", fontWeight: 700, cursor: disabled ? "default" : "pointer", fontSize: small ? 12 : 13, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", transition: "all 0.15s" }}>
    {children}
  </button>
);

// ===== LOGIN (دخول + تحقق ثنائي + استرجاع الرمز) =====
const fnCall = (n) => httpsCallable(getFunctions(app, "europe-west1"), n);
const niceErr = (e) => (e?.message || "حدث خطأ غير متوقع").replace(/^.*?: /, "");
const loginInput = { width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr" };
const loginBtn = (loading) => ({ background: "linear-gradient(135deg, #7c5cfc, #c4b5fd)", border: "none", borderRadius: 8, padding: "13px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px #7c5cfc44", width: "100%" });
const linkBtn = { background: "none", border: "none", color: C.blueLight, fontFamily: "inherit", fontSize: 12, cursor: "pointer", padding: 4 };

function AdminLogin({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | otp | forgot | reset
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCode2, setNewCode2] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const go = (m) => { setMode(m); setError(""); setOtp(""); };
  const isSuper = (e) => e.trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  const handle = async () => {
    if (!email || !code) { setError("أدخل البريد والرمز"); return; }
    setLoading(true); setError(""); setInfo("");
    try {
      if (isSuper(email)) {
        try {
          await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), code);
          onLogin({ email, role: "super", name: "عبد الواحد هفار" });
        } catch (authErr) {
          const msgs = {
            "auth/wrong-password": "كلمة المرور خاطئة",
            "auth/invalid-credential": "البريد أو كلمة المرور خاطئة",
            "auth/user-not-found": "الحساب غير موجود في Firebase",
            "auth/too-many-requests": "محاولات كثيرة — انتظر قليلاً أو استرجع كلمة المرور",
          };
          setError(msgs[authErr.code] || `خطأ: ${authErr.code}`);
        }
        setLoading(false); return;
      }
      const res = await fnCall("adminSignIn")({ email: email.trim().toLowerCase(), code });
      if (res.data.needOtp) { setChallenge(res.data.challenge); setHint(res.data.hint || ""); go("otp"); setLoading(false); return; }
      await signInWithCustomToken(auth, res.data.token);
      onLogin({ email, role: "sub", name: res.data.name, id: res.data.id });
    } catch (e) { setError(niceErr(e)); }
    setLoading(false);
  };

  const verify2fa = async () => {
    if (otp.length !== 6) { setError("أدخل الرمز المكوّن من 6 أرقام"); return; }
    setLoading(true); setError("");
    try {
      const res = await fnCall("adminVerify2fa")({ challenge, otp });
      await signInWithCustomToken(auth, res.data.token);
      onLogin({ email, role: "sub", name: res.data.name, id: res.data.id });
    } catch (e) { setError(niceErr(e)); }
    setLoading(false);
  };

  const sendReset = async () => {
    if (!email) { setError("أدخل بريدك الإلكتروني"); return; }
    setLoading(true); setError(""); setInfo("");
    try {
      if (isSuper(email)) {
        await sendPasswordResetEmail(auth, email.trim().toLowerCase());
        setInfo("أُرسل رابط تعيين كلمة المرور إلى بريدك. افتحه واختر كلمة جديدة ثم ارجع للدخول.");
        go("login");
      } else {
        await fnCall("adminForgot")({ email: email.trim().toLowerCase() });
        setInfo("إذا كان البريد مسجلاً فقد أُرسل إليه رمز من 6 أرقام (صالح 10 دقائق).");
        go("reset");
      }
    } catch (e) { setError(niceErr(e)); }
    setLoading(false);
  };

  const doReset = async () => {
    if (otp.length !== 6) { setError("أدخل الرمز المكوّن من 6 أرقام"); return; }
    if (newCode !== newCode2) { setError("الرمزان غير متطابقين"); return; }
    setLoading(true); setError("");
    try {
      await fnCall("adminReset")({ email: email.trim().toLowerCase(), otp, newCode });
      setCode(""); setNewCode(""); setNewCode2("");
      setInfo("تم تعيين الرمز الجديد ✅ يمكنك الدخول الآن.");
      go("login");
    } catch (e) { setError(niceErr(e)); }
    setLoading(false);
  };

  const Field = ({ label, children }) => (<div><div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>{label}</div>{children}</div>);
  const Msg = () => (<>
    {error && <div style={{ background: C.redGlow, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.redLight, textAlign: "center" }}>{error}</div>}
    {info && <div style={{ background: "#16a34a22", border: "1px solid #16a34a55", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#4ade80", textAlign: "center" }}>{info}</div>}
  </>);
  const onEnter = (fn) => (e) => { if (e.key === "Enter") fn(); };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: "rtl" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #7c5cfc, #c4b5fd)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "0 8px 32px #7c5cfc44" }}>🛡️</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>TaxiDZ Admin</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>لوحة التحكم الإدارية</div>
        </div>
        <div style={{ background: C.card, borderRadius: "6px 22px 22px 22px", padding: 28, border: `1px solid ${C.border}`, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "login" && (<>
              <Field label="البريد الإلكتروني"><input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@taxidz.dz" type="email" autoComplete="username" style={loginInput} /></Field>
              <Field label="رمز الدخول"><input value={code} onChange={e => setCode(e.target.value)} onKeyDown={onEnter(handle)} placeholder="••••••••" type="password" autoComplete="current-password" style={loginInput} /></Field>
              <Msg />
              <button onClick={handle} disabled={loading} style={loginBtn(loading)}>{loading ? "جارٍ الدخول..." : "🔑 دخول"}</button>
              <button onClick={() => go("forgot")} style={linkBtn}>نسيت الرمز / كلمة المرور؟</button>
            </>)}
            {mode === "otp" && (<>
              <div style={{ textAlign: "center", color: C.text, fontWeight: 800, fontSize: 16 }}>🔐 التحقق بخطوتين</div>
              <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13 }}>أرسلنا رمزاً من 6 أرقام إلى <span dir="ltr">{hint}</span></div>
              <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={onEnter(verify2fa)} inputMode="numeric" autoFocus placeholder="000000" style={{ ...loginInput, textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: 800 }} />
              <Msg />
              <button onClick={verify2fa} disabled={loading} style={loginBtn(loading)}>{loading ? "جارٍ التحقق..." : "تأكيد"}</button>
              <button onClick={() => go("login")} style={linkBtn}>← رجوع</button>
            </>)}
            {mode === "forgot" && (<>
              <div style={{ textAlign: "center", color: C.text, fontWeight: 800, fontSize: 16 }}>استرجاع الدخول</div>
              <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13 }}>اكتب بريدك وسنرسل إليه رمز تحقق</div>
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onEnter(sendReset)} type="email" placeholder="admin@taxidz.dz" style={loginInput} />
              <Msg />
              <button onClick={sendReset} disabled={loading} style={loginBtn(loading)}>{loading ? "جارٍ الإرسال..." : "إرسال الرمز"}</button>
              <button onClick={() => go("login")} style={linkBtn}>← رجوع</button>
            </>)}
            {mode === "reset" && (<>
              <div style={{ textAlign: "center", color: C.text, fontWeight: 800, fontSize: 16 }}>تعيين رمز جديد</div>
              <Msg />
              <Field label="الرمز المرسل إلى بريدك (6 أرقام)"><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" style={{ ...loginInput, textAlign: "center", letterSpacing: 6, fontWeight: 800 }} /></Field>
              <Field label="الرمز الجديد (8 أحرف على الأقل، حروف وأرقام)"><input value={newCode} onChange={e => setNewCode(e.target.value)} type="password" autoComplete="new-password" style={loginInput} /></Field>
              <Field label="أعد كتابة الرمز الجديد"><input value={newCode2} onChange={e => setNewCode2(e.target.value)} onKeyDown={onEnter(doReset)} type="password" autoComplete="new-password" style={loginInput} /></Field>
              <button onClick={doReset} disabled={loading} style={loginBtn(loading)}>{loading ? "جارٍ الحفظ..." : "حفظ الرمز الجديد"}</button>
              <button onClick={sendReset} disabled={loading} style={linkBtn}>إعادة إرسال الرمز</button>
              <button onClick={() => go("login")} style={linkBtn}>← رجوع</button>
            </>)}
          </div>
          {mode === "login" && <div style={{ fontSize: 12, color: C.textDim, textAlign: "center", marginTop: 16 }}>للحصول على حساب أدمن ثانوي تواصل مع المدير الرئيسي</div>}
        </div>
      </div>
    </div>
  );
}

// ===== SIDEBAR =====
function Sidebar({ tab, setTab, admin, onLogout, counts, isMobile, open, onClose }) {
  const isSuperAdmin = admin?.role === "super";
  const navItems = [
    { id: "dashboard", icon: "📊", label: "الرئيسية" },
    { id: "live", icon: "🗺️", label: "العمليات المباشرة" },
    { id: "rides", icon: "🧾", label: "الرحلات" },
    { id: "safety", icon: "🆘", label: "الطوارئ", badge: counts.openSos },
    { id: "drivers", icon: "🚕", label: "السائقون", badge: counts.pendingDrivers },
    { id: "passengers", icon: "👥", label: "الركاب" },
    ...(isSuperAdmin ? [{ id: "admins", icon: "🛡️", label: "الأدمنات", badge: counts.pendingAdmins }] : []),
    { id: "pricing", icon: "💰", label: "التسعير" },
    { id: "regions", icon: "🗺️", label: "المناطق" },
    { id: "missions", icon: "🎯", label: "المهام والحوافز" },
    { id: "accounts", icon: "⛔", label: "الحسابات والإيقاف" },
    { id: "promos", icon: "🎟️", label: "العروض والخصومات" },
    { id: "reports", icon: "📈", label: "التقارير" },
    { id: "analytics", icon: "💹", label: "التحليلات" },
    { id: "complaints", icon: "🚨", label: "التبليغات", badge: counts.pendingReports },
    { id: "subscriptions", icon: "💳", label: "الاشتراكات", badge: counts.pendingSubscriptions },
    { id: "settings", icon: "⚙️", label: "الإعدادات" },
  ];

  return (
    <div style={{ width: 220, minHeight: "100vh", background: C.sidebar, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 150, transform: isMobile && !open ? "translateX(100%)" : "none", transition: "transform .25s ease", overflowY: "auto" }}>
      <div style={{ padding: "20px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c5cfc,#c4b5fd)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>TaxiDZ</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Admin Panel</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); onClose && onClose(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", background: tab === item.id ? C.blueGlow : "transparent", color: tab === item.id ? C.blueLight : C.textMuted, fontFamily: "inherit", fontWeight: tab === item.id ? 700 : 500, fontSize: 13, cursor: "pointer", marginBottom: 2, textAlign: "right", position: "relative", transition: "all 0.15s" }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge > 0 && (
              <span style={{ background: C.red, color: "#fff", borderRadius: 20, fontSize: 10, padding: "1px 7px", fontWeight: 700 }}>{item.badge}</span>
            )}
            {tab === item.id && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: 4, background: C.blueLight }} />}
          </button>
        ))}
      </nav>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Avatar name={admin?.name} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin?.name || admin?.email}</div>
            <div style={{ fontSize: 10, color: isSuperAdmin ? C.yellow : C.accent }}>{isSuperAdmin ? "👑 أدمن رئيسي" : "🔹 أدمن ثانوي"}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ width: "100%", background: C.redGlow, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "8px", color: C.redLight, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
          🚪 تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

// ===== DASHBOARD =====
function Dashboard({ drivers, passengers, admins }) {
  const pending = drivers.filter(d => d.verificationStatus === "pending");
  const approved = drivers.filter(d => d.verificationStatus === "approved");
  const rejected = drivers.filter(d => d.verificationStatus === "rejected");

  const activity = [
    { text: "سائق جديد طلب التوثيق", time: "منذ 5 دقائق", icon: "🚕", color: C.orange },
    { text: "راكب جديد انضم للتطبيق", time: "منذ 12 دقيقة", icon: "👤", color: C.blue },
    { text: "تم قبول سائق من ورقلة", time: "منذ ساعة", icon: "✅", color: C.green },
    { text: "سائق جديد من تمنراست", time: "منذ ساعتين", icon: "🚕", color: C.orange },
    { text: "تم رفض طلب توثيق", time: "منذ 3 ساعات", icon: "❌", color: C.red },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>📊 لوحة المعلومات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>نظرة عامة على نشاط التطبيق</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon="🚕" label="إجمالي السائقين" value={drivers.length} sub={`${approved.length} معتمد`} color={C.green} trend="12% هذا الأسبوع" />
        <StatCard icon="⏳" label="بانتظار الموافقة" value={pending.length} sub="طلبات جديدة" color={C.orange} />
        <StatCard icon="👥" label="إجمالي الركاب" value={passengers.length} sub="مستخدم نشط" color={C.blue} trend="8% هذا الأسبوع" />
        <StatCard icon="❌" label="طلبات مرفوضة" value={rejected.length} color={C.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
            <span>⏳ أحدث الطلبات المعلقة</span>
            <Badge color={C.orange}>{pending.length}</Badge>
          </div>
          {pending.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>لا توجد طلبات معلقة ✅</div>}
          {pending.slice(0, 4).map(d => (
            <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <Avatar src={d.selfieUrl} name={d.name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name || d.email}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{d.wilaya || "—"} · {d.carBrand} {d.carModel}</div>
              </div>
              <Badge color={C.orange}>معلق</Badge>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>🕐 آخر النشاطات</div>
          {activity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: i < activity.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: a.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.text }}>{a.text}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== DRIVERS =====
function DriversPanel({ drivers, isSuperAdmin }) {
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(null);
  const [loading, setLoading] = useState(false);

  const filtered = drivers.filter(d => {
    const matchFilter = filter === "all" || d.verificationStatus === filter || (!d.verificationStatus && filter === "pending");
    const matchSearch = !search || d.name?.includes(search) || d.email?.includes(search) || d.plateNumber?.includes(search) || d.wilaya?.includes(search);
    return matchFilter && matchSearch;
  });

  const counts = {
    all: drivers.length,
    pending: drivers.filter(d => d.verificationStatus === "pending" || !d.verificationStatus).length,
    approved: drivers.filter(d => d.verificationStatus === "approved").length,
    rejected: drivers.filter(d => d.verificationStatus === "rejected").length,
  };

  const approveDriver = async (id) => {
    setLoading(true);
    try { await updateDoc(doc(db, "drivers", id), { verificationStatus: "approved", approvedAt: serverTimestamp() }); }
    catch (e) { showErr(e, "قبول السائق"); }
    setLoading(false); setSelected(null);
  };

  const rejectDriver = async (id) => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try { await updateDoc(doc(db, "drivers", id), { verificationStatus: "rejected", rejectionReason: rejectReason, rejectedAt: serverTimestamp() }); }
    catch (e) { showErr(e, "رفض السائق"); }
    setLoading(false); setShowReject(null); setRejectReason(""); setSelected(null);
  };

  const deleteDriver = async (id) => {
    if (!window.confirm("هل تريد حذف هذا السائق نهائياً؟")) return;
    try { await deleteDoc(doc(db, "drivers", id)); }
    catch (e) { showErr(e, "حذف السائق"); }
    setSelected(null);
  };

  const statusBadge = (s) => {
    if (s === "approved") return <Badge color={C.green}>✅ معتمد</Badge>;
    if (s === "rejected") return <Badge color={C.red}>❌ مرفوض</Badge>;
    return <Badge color={C.orange}>⏳ بانتظار</Badge>;
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>🚕 إدارة السائقين</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>مراجعة وإدارة طلبات التوثيق</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { id: "pending", label: `⏳ معلق (${counts.pending})` },
            { id: "approved", label: `✅ معتمد (${counts.approved})` },
            { id: "rejected", label: `❌ مرفوض (${counts.rejected})` },
            { id: "all", label: `الكل (${counts.all})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ background: filter === f.id ? C.blueGlow : C.card, border: `1px solid ${filter === f.id ? C.blue : C.border}`, borderRadius: 20, padding: "6px 14px", color: filter === f.id ? C.blueLight : C.textMuted, fontFamily: "inherit", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16, position: "relative" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم، البريد، اللوحة، الولاية..."
            style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "rtl" }} />
        </div>

        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>السائق</span>
            <span>السيارة</span>
            <span>الولاية</span>
            <span>الحالة</span>
            <span>إجراء</span>
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: C.textMuted, fontSize: 14 }}>لا توجد نتائج</div>
          )}
          {filtered.map(d => (
            <div key={d.id} onClick={() => setSelected(d)}
              style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected?.id === d.id ? C.blueGlow : "transparent", transition: "all 0.15s", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Avatar src={d.selfieUrl} name={d.name} size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.name || "—"}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.email}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.text }}>{d.carBrand} {d.carModel} {d.carYear}</div>
                <div style={{ fontSize: 11, color: C.textMuted, direction: "ltr" }}>{d.plateNumber || "—"}</div>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{d.wilaya?.split(" - ")[1] || d.wilaya || "—"}</div>
              <div>{statusBadge(d.verificationStatus)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {d.verificationStatus !== "approved" && (
                  <Btn small color={C.green} onClick={e => { e.stopPropagation(); approveDriver(d.id); }}>قبول</Btn>
                )}
                {d.verificationStatus !== "rejected" && (
                  <Btn small color={C.red} outline onClick={e => { e.stopPropagation(); setShowReject(d); }}>رفض</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ width: 320, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, overflowY: "auto", maxHeight: "calc(100vh - 80px)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>تفاصيل السائق</div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <Avatar src={selected.selfieUrl} name={selected.name} size={72} />
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginTop: 10 }}>{selected.name || "—"}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{selected.email}</div>
            <div style={{ marginTop: 8 }}>{statusBadge(selected.verificationStatus)}</div>
          </div>

          {[
            { label: "الجنس", value: selected.gender },
            { label: "تاريخ الميلاد", value: selected.birthDate },
            { label: "نوع السائق", value: selected.driverType },
            { label: "الولاية", value: selected.wilaya },
            { label: "الدائرة", value: selected.daira },
            { label: "السيارة", value: `${selected.carBrand || ""} ${selected.carModel || ""} ${selected.carYear || ""}` },
            { label: "اللون", value: selected.carColor },
            { label: "اللوحة", value: selected.plateNumber, ltr: true },
            { label: "رخصة سياقة", value: selected.hasLicense ? "✅ نعم" : "❌ لا" },
          ].map((item, i) => item.value && (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>{item.label}</span>
              <span style={{ color: C.text, fontWeight: 600, direction: item.ltr ? "ltr" : "rtl" }}>{item.value}</span>
            </div>
          ))}

          {[
            { label: "صورة السيلفي", url: selected.selfieUrl },
            { label: "السيارة من الأمام", url: selected.carFrontUrl },
            { label: "السيارة من الجانب", url: selected.carSideUrl },
            { label: "البطاقة الرمادية", url: selected.grayCardUrl },
            { label: "رخصة السياقة", url: selected.licenseUrl },
          ].filter(p => p.url).map((photo, i) => (
            <div key={i} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>{photo.label}</div>
              <img src={photo.url} alt={photo.label} style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, maxHeight: 160, objectFit: "cover", cursor: "pointer" }}
                onClick={() => window.open(photo.url.startsWith("data:") ? photo.url : photo.url)} />
            </div>
          ))}

          {selected.verificationStatus === "rejected" && selected.rejectionReason && (
            <div style={{ marginTop: 14, background: C.redGlow, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>سبب الرفض</div>
              <div style={{ fontSize: 12, color: C.text }}>{selected.rejectionReason}</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
            {selected.verificationStatus !== "approved" && (
              <Btn onClick={() => approveDriver(selected.id)} color={C.green} disabled={loading}>✅ قبول السائق</Btn>
            )}
            {selected.verificationStatus !== "rejected" && (
              <Btn onClick={() => setShowReject(selected)} color={C.red} outline disabled={loading}>❌ رفض مع سبب</Btn>
            )}
            {isSuperAdmin && (
              <Btn onClick={() => deleteDriver(selected.id)} color={C.red} outline>🗑️ حذف نهائي</Btn>
            )}
          </div>
        </div>
      )}

      {showReject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, border: `1px solid ${C.border}`, direction: "rtl", fontFamily: "inherit" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 16 }}>❌ رفض طلب التوثيق</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
              السائق: <span style={{ color: C.text, fontWeight: 600 }}>{showReject.name}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>سبب الرفض (سيظهر للسائق) *</div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="مثال: الصور غير واضحة، رقم اللوحة غير صحيح..."
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, resize: "none", outline: "none", height: 100, direction: "rtl", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => { setShowReject(null); setRejectReason(""); }} outline color={C.textMuted}>إلغاء</Btn>
              <button onClick={() => rejectDriver(showReject.id)} disabled={!rejectReason.trim() || loading}
                style={{ flex: 1, background: C.red, border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontFamily: "inherit", fontWeight: 700, cursor: !rejectReason.trim() ? "default" : "pointer", opacity: !rejectReason.trim() ? 0.5 : 1, fontSize: 13 }}>
                {loading ? "جارٍ الرفض..." : "❌ تأكيد الرفض"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PASSENGERS =====
function PassengersPanel({ passengers, isSuperAdmin }) {
  const [search, setSearch] = useState("");
  const filtered = passengers.filter(p => !search || p.name?.includes(search) || p.email?.includes(search) || p.phone?.includes(search));

  const deletePassenger = async (id) => {
    if (!window.confirm("حذف هذا الراكب؟")) return;
    try { await deleteDoc(doc(db, "passengers", id)); } catch (e) { showErr(e, "حذف الراكب"); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>👥 إدارة الركاب</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>{passengers.length} راكب مسجل</div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم، البريد، الهاتف..."
        style={{ width: "100%", maxWidth: 400, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "rtl", marginBottom: 16 }} />

      <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
          <span>الراكب</span>
          <span>الهاتف</span>
          <span>الحالة</span>
          <span>إجراء</span>
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>لا توجد نتائج</div>}
        {filtered.map(p => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar name={p.name || p.email} size={36} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name || "—"}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{p.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.text, direction: "ltr" }}>{p.phone || "—"}</div>
            <div><Badge color={C.green}>✅ نشط</Badge></div>
            <div>
              {isSuperAdmin && <Btn small color={C.red} outline onClick={() => deletePassenger(p.id)}>🗑️</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ADMINS =====
function AdminsPanel({ admins, currentAdmin }) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addAdmin = async () => {
    if (!newName || !newEmail || !newCode) { setError("أكمل جميع الحقول"); return; }
    setLoading(true); setError("");
    try {
      await setDoc(doc(db, "admins", `admin_${Date.now()}`), {
        name: newName, email: newEmail, code: newCode,
        approved: false, createdAt: serverTimestamp(), createdBy: currentAdmin.email,
      });
      setNewName(""); setNewEmail(""); setNewCode("");
    } catch (e) { showErr(e, "إضافة أدمن"); setError(e.message || "خطأ في الإضافة"); }
    setLoading(false);
  };

  const approveAdmin = async (id) => {
    try { await updateDoc(doc(db, "admins", id), { approved: true, approvedAt: serverTimestamp() }); }
    catch (e) { showErr(e, "قبول الأدمن"); }
  };

  const deleteAdmin = async (id) => {
    if (!window.confirm("حذف هذا الأدمن؟")) return;
    try { await deleteDoc(doc(db, "admins", id)); } catch (e) { showErr(e, "حذف الأدمن"); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>🛡️ إدارة الأدمنات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>أنت الوحيد الذي يمكنه قبول أو حذف الأدمنات</div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>➕ إضافة أدمن ثانوي جديد</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>الاسم</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم الأدمن"
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "rtl" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>البريد</div>
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@taxidz.dz" type="email"
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "ltr" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>رمز الدخول</div>
            <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="رمز سري"
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "ltr" }} />
          </div>
          <Btn onClick={addAdmin} color={C.green} disabled={loading}>➕ إضافة</Btn>
        </div>
        {error && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</div>}
      </div>

      <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
          <span>الاسم</span>
          <span>البريد</span>
          <span>الحالة</span>
          <span>إجراء</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center", background: C.purpleGlow }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Avatar name="A" size={36} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>عبد الواحد هفار</div>
              <Badge color={C.yellow}>👑 أدمن رئيسي</Badge>
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{SUPER_ADMIN_EMAIL}</div>
          <Badge color={C.green}>✅ نشط</Badge>
          <div style={{ fontSize: 12, color: C.textDim }}>—</div>
        </div>
        {admins.length === 0 && <div style={{ textAlign: "center", padding: 30, color: C.textMuted, fontSize: 13 }}>لا يوجد أدمنات ثانويون بعد</div>}
        {admins.map(a => (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar name={a.name} size={36} />
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.name}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{a.email}</div>
            <div>{a.approved ? <Badge color={C.green}>✅ مقبول</Badge> : <Badge color={C.orange}>⏳ بانتظار</Badge>}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {!a.approved && <Btn small color={C.green} onClick={() => approveAdmin(a.id)}>قبول</Btn>}
              <Btn small color={C.red} outline onClick={() => deleteAdmin(a.id)}>🗑️</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== REPORTS =====
function ReportsPanel({ drivers, passengers }) {
  const wilayaStats = {};
  drivers.forEach(d => {
    const w = d.wilaya?.split(" - ")[1] || d.wilaya || "غير محدد";
    wilayaStats[w] = (wilayaStats[w] || 0) + 1;
  });
  const topWilayas = Object.entries(wilayaStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = topWilayas[0]?.[1] || 1;

  const brandStats = {};
  drivers.forEach(d => { if (d.carBrand) brandStats[d.carBrand] = (brandStats[d.carBrand] || 0) + 1; });
  const topBrands = Object.entries(brandStats).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>📈 التقارير والإحصائيات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>تحليل بيانات التطبيق</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>📍 أكثر الولايات نشاطاً</div>
          {topWilayas.length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>لا توجد بيانات بعد</div>}
          {topWilayas.map(([wilaya, count], i) => (
            <div key={wilaya} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text }}>{wilaya}</span>
                <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>{count} سائق</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>🚗 أكثر الماركات شيوعاً</div>
          {topBrands.length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>لا توجد بيانات بعد</div>}
          {topBrands.map(([brand, count]) => (
            <div key={brand} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{brand}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ height: 4, width: 60, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(count / (topBrands[0]?.[1] || 1)) * 100}%`, background: C.green, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, minWidth: 20 }}>{count}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>📊 ملخص عام</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { label: "نسبة القبول", value: drivers.length ? `${Math.round((drivers.filter(d => d.verificationStatus === "approved").length / drivers.length) * 100)}%` : "—", color: C.green },
              { label: "نسبة الرفض", value: drivers.length ? `${Math.round((drivers.filter(d => d.verificationStatus === "rejected").length / drivers.length) * 100)}%` : "—", color: C.red },
              { label: "معدل الراكب/سائق", value: drivers.length ? `${(passengers.length / drivers.length).toFixed(1)}x` : "—", color: C.blue },
              { label: "إجمالي المستخدمين", value: drivers.length + passengers.length, color: C.purple },
            ].map((s, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ANALYTICS (الإيرادات اليومية، معدل الإلغاء، متوسط وقت الانتظار) =====
function AnalyticsPanel({ bookings }) {
  const DAYS = 7;
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const last7 = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (DAYS - 1 - i)); return d;
  });

  const completed = bookings.filter(b => b.status === "completed" || b.status === "rated");
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const total = bookings.length;

  const revenueByDay = {};
  completed.forEach(b => {
    const d = b.completedAt?.toDate?.() || b.createdAt?.toDate?.();
    if (!d) return;
    const k = dayKey(d);
    revenueByDay[k] = (revenueByDay[k] || 0) + (b.price || 0);
  });
  const revenueSeries = last7.map(d => ({ label: d.toLocaleDateString("ar-DZ", { weekday: "short", day: "numeric" }), value: revenueByDay[dayKey(d)] || 0 }));
  const maxRevenue = Math.max(1, ...revenueSeries.map(r => r.value));
  const totalRevenue7d = revenueSeries.reduce((s, r) => s + r.value, 0);

  const cancellationRate = total ? Math.round((cancelled.length / total) * 100) : 0;

  const waitTimes = [];
  bookings.forEach(b => {
    const created = b.createdAt?.toDate?.();
    const accepted = b.acceptedAt?.toDate?.();
    if (created && accepted) waitTimes.push((accepted - created) / 60000); // بالدقائق
  });
  const avgWait = waitTimes.length ? (waitTimes.reduce((s, w) => s + w, 0) / waitTimes.length) : null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>💹 التحليلات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>مؤشرات الأداء التشغيلي</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard icon="💰" label="إيرادات آخر 7 أيام" value={`${totalRevenue7d.toLocaleString()} دج`} sub={`${completed.length} رحلة مكتملة (كل الوقت)`} color={C.green} />
        <StatCard icon="🚫" label="معدل الإلغاء" value={`${cancellationRate}%`} sub={`${cancelled.length} من ${total} طلب`} color={cancellationRate > 20 ? C.red : C.orange} />
        <StatCard icon="⏱️" label="متوسط وقت الانتظار" value={avgWait !== null ? `${avgWait.toFixed(1)} دق` : "—"} sub="من الطلب حتى قبول سائق" color={C.blue} />
      </div>

      <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>💰 الإيرادات اليومية (آخر 7 أيام)</div>
        {totalRevenue7d === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>لا توجد رحلات مكتملة في هذه الفترة بعد</div>}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, padding: "0 4px" }}>
          {revenueSeries.map((r, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>{r.value > 0 ? r.value.toLocaleString() : ""}</div>
              <div style={{ width: "100%", height: Math.max(3, (r.value / maxRevenue) * 110), background: `linear-gradient(180deg, ${C.green}, ${C.greenDark || C.green})`, borderRadius: 6 }} />
              <div style={{ fontSize: 10, color: C.textMuted }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== SETTINGS =====
function SecurityCard({ admin }) {
  const isSuper = admin?.role === "super";
  const [cur, setCur] = useState(""), [n1, setN1] = useState(""), [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const [twofa, setTwofa] = useState(false);
  useEffect(() => {
    if (!isSuper) return;
    return onSnapshot(doc(db, "settings", "security"), s => setTwofa(s.data()?.admin2fa === true), () => {});
  }, [isSuper]);
  const strong = (c) => c.length >= 8 && /[A-Za-z]/.test(c) && /[0-9]/.test(c);
  const change = async () => {
    setMsg(null);
    if (!cur) return setMsg({ bad: 1, t: "أدخل الرمز الحالي" });
    if (!strong(n1)) return setMsg({ bad: 1, t: "الرمز الجديد: 8 أحرف على الأقل، حروف وأرقام" });
    if (n1 !== n2) return setMsg({ bad: 1, t: "الرمزان غير متطابقين" });
    setBusy(true);
    try {
      if (isSuper) {
        const u = auth.currentUser;
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
        await updatePassword(u, n1);
      } else {
        await fnCall("adminChangeCode")({ oldCode: cur, newCode: n1 });
      }
      setCur(""); setN1(""); setN2(""); setMsg({ t: "تم تغيير الرمز بنجاح ✅" });
    } catch (e) {
      const m = { "auth/wrong-password": "الرمز الحالي غير صحيح", "auth/invalid-credential": "الرمز الحالي غير صحيح", "auth/too-many-requests": "محاولات كثيرة، انتظر قليلاً", "auth/requires-recent-login": "أعد تسجيل الدخول ثم حاول" };
      setMsg({ bad: 1, t: m[e?.code] || niceErr(e) });
    }
    setBusy(false);
  };
  const toggle2fa = async () => {
    try { await setDoc(doc(db, "settings", "security"), { admin2fa: !twofa, updatedAt: serverTimestamp() }, { merge: true }); }
    catch (e) { setMsg({ bad: 1, t: "تعذّر الحفظ: " + niceErr(e) }); }
  };
  const inp = { ...loginInput, marginBottom: 10 };
  return (
    <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>🔐 الأمان</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{isSuper ? "تغيير كلمة مرور المدير الرئيسي" : "تغيير رمز الدخول"}</div>
      <input value={cur} onChange={e => setCur(e.target.value)} type="password" placeholder="الرمز الحالي" autoComplete="current-password" style={inp} />
      <input value={n1} onChange={e => setN1(e.target.value)} type="password" placeholder="الرمز الجديد (8+ أحرف، حروف وأرقام)" autoComplete="new-password" style={inp} />
      <input value={n2} onChange={e => setN2(e.target.value)} type="password" placeholder="أعد كتابة الرمز الجديد" autoComplete="new-password" style={inp} />
      {msg && <div style={{ fontSize: 13, marginBottom: 10, color: msg.bad ? C.redLight : "#4ade80" }}>{msg.t}</div>}
      <Btn onClick={change} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الرمز الجديد"}</Btn>
      {isSuper && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>التحقق بخطوتين للأدمنات الثانويين</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>رمز يصل للبريد عند كل دخول. يتطلب إعداد البريد (MAIL_USER / MAIL_PASS) في الخادم.</div>
          </div>
          <Btn onClick={toggle2fa} color={twofa ? C.green : C.textMuted} outline={!twofa}>{twofa ? "مفعّل ✓" : "معطّل"}</Btn>
        </div>
      )}
      {isSuper && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 14 }}>لحماية أقوى لحسابك الرئيسي: فعّل التحقق بخطوتين في حساب Gmail نفسه.</div>}
    </div>
  );
}

function SettingsPanel({ admin }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>⚙️ الإعدادات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>إعدادات التطبيق والنظام</div>
      </div>
      <SecurityCard admin={admin} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>💰 نظام التسعير</div>
          {[
            { label: "السعر لكل كيلومتر", value: "30 دج" },
            { label: "الحد الأدنى للرحلة", value: "100 دج" },
            { label: "معامل الفئة المريحة", value: "×1.4" },
            { label: "معامل فئة XL", value: "×1.8" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>{s.label}</span>
              <span style={{ color: C.green, fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>📱 معلومات التطبيق</div>
          {[
            { label: "اسم التطبيق", value: "TaxiDZ" },
            { label: "الإصدار", value: "1.0.0" },
            { label: "Firebase Project", value: "taxi-dz-ee993" },
            { label: "الأدمن الرئيسي", value: SUPER_ADMIN_EMAIL },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>{s.label}</span>
              <span style={{ color: C.text, fontWeight: 600, direction: "ltr", fontSize: 12 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== COMPLAINTS PANEL =====
function ComplaintsPanel({ reports, drivers, passengers, isSuperAdmin }) {
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);

  const filtered = reports.filter(r => filter === "all" || r.status === filter);

  const resolveReport = async (id) => {
    try { await updateDoc(doc(db, "reports", id), { status: "resolved", resolvedAt: serverTimestamp() }); } catch(e) { showErr(e, "معالجة التبليغ"); }
  };

  const dismissReport = async (id) => {
    try { await updateDoc(doc(db, "reports", id), { status: "dismissed", dismissedAt: serverTimestamp() }); } catch(e) { showErr(e, "تجاهل التبليغ"); }
  };

  const deleteUser = async (targetId, targetType) => {
    if (!window.confirm(`حذف هذا ${targetType === "driver" ? "السائق" : "الراكب"} نهائياً؟`)) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, targetType === "driver" ? "drivers" : "passengers", targetId));
      const relatedReports = reports.filter(r => r.targetId === targetId);
      for (const r of relatedReports) await deleteDoc(doc(db, "reports", r.id));
    } catch(e) { showErr(e, "حذف المستخدم"); }
    setLoading(false);
  };

  const reportCounts = {};
  reports.forEach(r => { reportCounts[r.targetId] = (reportCounts[r.targetId] || 0) + 1; });

  const statusColor = s => s === "pending" ? C.orange : s === "resolved" ? C.green : C.textMuted;
  const statusLabel = s => s === "pending" ? "⏳ معلق" : s === "resolved" ? "✅ تمت المعالجة" : "🚫 مُهمل";

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>🚨 التبليغات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>{reports.length} تبليغ إجمالي · {reports.filter(r=>r.status==="pending").length} معلق</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "pending", label: `⏳ معلق (${reports.filter(r=>r.status==="pending").length})` },
          { id: "resolved", label: `✅ معالج (${reports.filter(r=>r.status==="resolved").length})` },
          { id: "dismissed", label: `🚫 مُهمل (${reports.filter(r=>r.status==="dismissed").length})` },
          { id: "all", label: `الكل (${reports.length})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ background: filter === f.id ? C.blueGlow : C.card, border: `1px solid ${filter === f.id ? C.blue : C.border}`, borderRadius: 20, padding: "6px 14px", color: filter === f.id ? C.blueLight : C.textMuted, fontFamily: "inherit", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: C.card, borderRadius: "4px 18px 18px 18px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 2fr 1fr 1fr", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
          <span>المُبلَّغ عنه</span><span>المُبلِّغ</span><span>السبب</span><span>الحالة</span><span>إجراء</span>
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>لا توجد تبليغات</div>}
        {filtered.map(r => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 2fr 1fr 1fr", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.targetName}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{r.targetType === "driver" ? "🚕 سائق" : "👤 راكب"}</div>
              {reportCounts[r.targetId] > 1 && (
                <div style={{ background: `${C.red}22`, color: C.red, borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700, display: "inline-block", marginTop: 3 }}>
                  🚨 {reportCounts[r.targetId]} تبليغات
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.text }}>{r.reporterName}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{r.reporterType === "driver" ? "سائق" : "راكب"}</div>
            </div>
            <div style={{ fontSize: 12, color: C.text }}>{r.reason?.substring(0, 50)}{r.reason?.length > 50 ? "..." : ""}</div>
            <div><Badge color={statusColor(r.status)}>{statusLabel(r.status)}</Badge></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {r.status === "pending" && (<>
                <Btn small color={C.green} onClick={() => resolveReport(r.id)}>✅ معالج</Btn>
                <Btn small color={C.textMuted} outline onClick={() => dismissReport(r.id)}>🚫 تجاهل</Btn>
              </>)}
              {isSuperAdmin && reportCounts[r.targetId] >= 2 && (
                <Btn small color={C.red} onClick={() => deleteUser(r.targetId, r.targetType)} disabled={loading}>🗑️ حذف</Btn>
              )}
            </div>
          </div>
        ))}
      </div>

      {Object.entries(reportCounts).filter(([,c]) => c >= 3).length > 0 && (
        <div style={{ background: C.redGlow, border: `1px solid ${C.red}44`, borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: C.red, marginBottom: 10, fontSize: 14 }}>⚠️ مستخدمون بتبليغات متعددة</div>
          {Object.entries(reportCounts).filter(([,c]) => c >= 3).map(([id, count]) => {
            const report = reports.find(r => r.targetId === id);
            return (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{report?.targetName}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{report?.targetType === "driver" ? "🚕 سائق" : "👤 راكب"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge color={C.red}>{count} تبليغات 🚨</Badge>
                  {isSuperAdmin && <Btn small color={C.red} onClick={() => deleteUser(id, report?.targetType)} disabled={loading}>🗑️ حذف</Btn>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== SUBSCRIPTION PANEL =====
function SubscriptionPanel({ drivers, isSuperAdmin }) {
  const [loading, setLoading] = useState(false);

  const pendingDrivers = drivers.filter(d => d.subscriptionRequest?.status === "pending");
  const activeDrivers = drivers.filter(d => d.subscription?.status === "active" && d.subscription?.expiresAt?.toDate?.() > new Date());

  const approveSubscription = async (driver) => {
    setLoading(true);
    try {
      const req = driver.subscriptionRequest;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + req.duration * 24 * 60 * 60 * 1000);
      await updateDoc(doc(db, "drivers", driver.id), {
        subscription: {
          planId: req.planId,
          planLabel: req.planLabel,
          price: req.price,
          duration: req.duration,
          status: "active",
          activatedAt: serverTimestamp(),
          expiresAt: expiresAt,
        },
        "subscriptionRequest.status": "approved",
        ...(req.creditApplied > 0 && (driver.compensationCredit || 0) > 0 ? { compensationCredit: increment(-Math.min(req.creditApplied, driver.compensationCredit || 0)) } : {}),
      });
    } catch(e) { showErr(e, "تفعيل الاشتراك"); }
    setLoading(false);
  };

  const rejectSubscription = async (driverId) => {
    try {
      await updateDoc(doc(db, "drivers", driverId), {
        "subscriptionRequest.status": "rejected",
      });
    } catch(e) { showErr(e, "رفض الاشتراك"); }
  };

  const toggleSubscriptionSystem = async (enabled) => {
    try {
      await setDoc(doc(db, "settings", "app"), { subscriptionEnabled: enabled }, { merge: true });
      alert(enabled ? "✅ تم تفعيل نظام الاشتراكات!" : "⏸️ تم إيقاف نظام الاشتراكات");
    } catch(e) { showErr(e, "تبديل نظام الاشتراكات"); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>💳 الاشتراكات</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{pendingDrivers.length} طلب معلق · {activeDrivers.length} اشتراك نشط</div>
        </div>
        {isSuperAdmin && (
          <div style={{ display:"flex", gap:8 }}>
            <Btn small color={C.green} onClick={() => toggleSubscriptionSystem(true)}>🟢 تفعيل</Btn>
            <Btn small color={C.textMuted} outline onClick={() => toggleSubscriptionSystem(false)}>⏸️ إيقاف</Btn>
          </div>
        )}
      </div>

      {pendingDrivers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: C.orange, marginBottom: 10, fontSize: 14 }}>⏳ طلبات تنتظر الموافقة ({pendingDrivers.length})</div>
          {pendingDrivers.map(driver => (
            <div key={driver.id} style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 10, border: `1px solid ${C.orange}44` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{driver.name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{driver.phone}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{driver.subscriptionRequest?.planLabel}</div>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontWeight: 900, fontSize: 20, color: C.orange }}>{driver.subscriptionRequest?.price} دج</div>
                  {driver.subscriptionRequest?.creditApplied > 0 && <div style={{ fontSize: 11, color: "#ffd24d" }}>🎁 تعويض -{driver.subscriptionRequest.creditApplied} · يدفع {driver.subscriptionRequest.payable} دج</div>}
                  <div style={{ fontSize: 11, color: C.textMuted }}>{driver.subscriptionRequest?.duration} يوم</div>
                </div>
              </div>
              {driver.subscriptionRequest?.receipt && (
                <div style={{ borderRadius: 12, overflow:"hidden", marginBottom: 12, maxHeight: 200 }}>
                  <img src={driver.subscriptionRequest.receipt} alt="إيصال" style={{ width:"100%", objectFit:"cover", display:"block" }} />
                </div>
              )}
              <div style={{ display:"flex", gap:8 }}>
                <Btn color={C.red} outline onClick={() => rejectSubscription(driver.id)} disabled={loading}>❌ رفض</Btn>
                <Btn color={C.green} onClick={() => approveSubscription(driver)} disabled={loading}>✅ تأكيد الاشتراك</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 700, color: C.green, marginBottom: 10, fontSize: 14 }}>🟢 الاشتراكات النشطة ({activeDrivers.length})</div>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:11, color:C.textMuted, fontWeight:700 }}>
          <span>السائق</span><span>العرض</span><span>انتهاء</span><span>الحالة</span>
        </div>
        {activeDrivers.length === 0 && <div style={{ textAlign:"center", padding:30, color:C.textMuted }}>لا توجد اشتراكات نشطة</div>}
        {activeDrivers.map(d => {
          const exp = d.subscription?.expiresAt?.toDate?.();
          const daysLeft = exp ? Math.ceil((exp - new Date()) / (1000*60*60*24)) : 0;
          return (
            <div key={d.id} style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{d.name}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{d.wilaya}</div>
              </div>
              <div style={{ fontSize:12, color:C.text }}>{d.subscription?.planLabel}</div>
              <div style={{ fontSize:12, color:daysLeft<=2?C.red:C.textMuted }}>{daysLeft} يوم</div>
              <Badge color={C.green}>نشط ✅</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== MAIN =====
export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [drivers, setDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [reports, setReports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [sos, setSos] = useState([]);
  const [menu, setMenu] = useState(false);
  const isMobile = useIsMobile();
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    if (!admin || !db) return;
    setLoadErr("");
    const u1 = onSnapshot(collection(db, "drivers"), snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setLoadErr("تعذر قراءة بيانات السائقين: " + (e.code || e.message)));
    const u2 = onSnapshot(collection(db, "passengers"), snap => setPassengers(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setLoadErr("تعذر قراءة بيانات الركاب: " + (e.code || e.message)));
    const u3 = admin.role === "super" ? onSnapshot(collection(db, "admins"), snap => setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })))) : () => {};
    const u4 = onSnapshot(collection(db, "reports"), snap => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(collection(db, "bookings"), snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => setLoadErr("تعذر قراءة بيانات الرحلات: " + (e.code || e.message)));
    const u6 = onSnapshot(collection(db, "sos_alerts"), snap => setSos(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [admin]);

  if (!admin) return <AdminLogin onLogin={setAdmin} />;

  const counts = {
    pendingDrivers: drivers.filter(d => d.verificationStatus === "pending" || !d.verificationStatus).length,
    pendingAdmins: admins.filter(a => !a.approved).length,
    pendingReports: reports.filter(r => r.status === "pending").length,
    openSos: sos.filter(x => !x.resolved).length,
    pendingSubscriptions: drivers.filter(d => d.subscriptionRequest?.status === "pending").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: "rtl", display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#33262b;border-radius:4px} select option{background:#161113;color:#fff5f6}${adminProStyles}`}</style>

      <Sidebar tab={tab} setTab={setTab} admin={admin} onLogout={() => setAdmin(null)} counts={counts} isMobile={isMobile} open={menu} onClose={() => setMenu(false)} />
      {isMobile && menu && <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 140 }} />}

      <main style={{ flex: 1, marginRight: isMobile ? 0 : 220, padding: isMobile ? "16px 14px 40px" : "24px 28px", overflowY: "auto", minHeight: "100vh", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
          {isMobile && <button onClick={() => setMenu(true)} style={{ width: 42, height: 42, borderRadius: 12, background: C.card || "#161113", border: `1px solid ${C.border}`, color: "#fff", fontSize: 18, cursor: "pointer" }}>☰</button>}
          <GlobalSearch drivers={drivers} passengers={passengers} bookings={bookings} onNav={setTab} />
          <button onClick={() => setTab("safety")} title="الطوارئ" style={{ position: "relative", width: 42, height: 42, borderRadius: 12, background: counts.openSos ? "#f8514922" : "#161113", border: `1px solid ${counts.openSos ? "#f85149" : C.border}`, cursor: "pointer", fontSize: 18 }}>🔔{counts.openSos > 0 && <span style={{ position: "absolute", top: -5, left: -5, background: "#f85149", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 800 }}>{counts.openSos}</span>}</button>
        </div>
        {loadErr && <div style={{ background: C.redGlow, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px 16px", color: C.redLight, fontSize: 13, marginBottom: 20 }}>⚠️ {loadErr}</div>}
        {tab === "dashboard" && <DashboardPro bookings={bookings} drivers={drivers} passengers={passengers} reports={reports} sos={sos} onNav={setTab} isMobile={isMobile} />}
        {tab === "live" && <LiveOps bookings={bookings} drivers={drivers} sos={sos} isMobile={isMobile} />}
        {tab === "rides" && <RidesPanel bookings={bookings} isMobile={isMobile} />}
        {tab === "pricing" && <PricingPanel db={db} adminName={admin.name} canEdit={admin.role === "super"} />}
        {tab === "regions" && <RegionsPanel db={db} adminName={admin.name} canEdit={admin.role === "super"} />}
        {tab === "missions" && <MissionsAdmin db={db} canEdit={admin.role === "super"} />}
        {tab === "promos" && <PromosPanel db={db} canEdit={admin.role === "super"} />}
        {tab === "safety" && <SafetyPanel sos={sos} db={db} isMobile={isMobile} />}
        {tab === "drivers" && <DriversPanel drivers={drivers} isSuperAdmin={admin.role === "super"} />}
        {tab === "passengers" && <PassengersPanel passengers={passengers} isSuperAdmin={admin.role === "super"} />}
        {tab === "admins" && admin.role === "super" && <AdminsPanel admins={admins} currentAdmin={admin} />}
        {tab === "reports" && <ReportsPanel drivers={drivers} passengers={passengers} />}
        {tab === "analytics" && <AnalyticsPanel bookings={bookings} />}
        {tab === "complaints" && <ComplaintsPro reports={reports} drivers={drivers} passengers={passengers} bookings={bookings} db={db} adminName={admin.name} isSuper={admin.role === "super"} isMobile={isMobile} />}
        {tab === "accounts" && <AccountsPanel drivers={drivers} passengers={passengers} db={db} adminName={admin.name} isSuper={admin.role === "super"} isMobile={isMobile} />}
        {tab === "subscriptions" && <SubscriptionPanel drivers={drivers} isSuperAdmin={admin.role === "super"} />}
        {tab === "settings" && <SettingsPanel admin={admin} />}
      </main>
    </div>
  );
}
