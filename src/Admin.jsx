import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const SUPER_ADMIN_EMAIL = "abdouhaffar@gmail.com";
const SUPER_ADMIN_CODE = "123456";

let app, auth, db;
try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) { console.log("Firebase error:", e); }

const C = {
  bg: "#0a0e1a",
  card: "#111827",
  cardBorder: "#1f2937",
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
  text: "#f9fafb",
  textMuted: "#9ca3af",
  textDim: "#4b5563",
  shadow: "0 4px 24px rgba(0,0,0,0.4)",
};

// ===== LOGIN =====
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!email || !code) { setError("أدخل البريد والرمز"); return; }
    setLoading(true); setError("");
    try {
      // Super admin check
      if (email === SUPER_ADMIN_EMAIL && code === SUPER_ADMIN_CODE) {
        await signInWithEmailAndPassword(auth, email, code + "@taxidz");
        onLogin({ email, role: "super" });
        return;
      }
      // Sub admin - check in Firestore
      const adminsSnap = await getDocs(collection(db, "admins"));
      const admin = adminsSnap.docs.find(d => d.data().email === email && d.data().code === code && d.data().approved);
      if (admin) {
        onLogin({ email, role: "sub", id: admin.id });
      } else {
        setError("البريد أو الرمز غير صحيح، أو لم يتم قبولك بعد");
      }
    } catch (e) {
      // Try as sub admin from Firestore only
      try {
        const adminsSnap = await getDocs(collection(db, "admins"));
        const admin = adminsSnap.docs.find(d => d.data().email === email && d.data().code === code && d.data().approved);
        if (admin) {
          onLogin({ email, role: "sub", id: admin.id });
        } else {
          setError("البريد أو الرمز غير صحيح، أو لم يتم قبولك بعد");
        }
      } catch {
        setError("حدث خطأ، حاول مرة أخرى");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>لوحة التحكم</div>
          <div style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>TaxiDZ Admin Panel</div>
        </div>
        <div style={{ background: C.card, borderRadius: 24, padding: 28, border: `1px solid ${C.cardBorder}`, display: "flex", flexDirection: "column", gap: 14 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email"
            style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: "13px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="رمز الدخول" type="password"
            style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: "13px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
          {error && <div style={{ background: C.redLight, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
          <button onClick={handle} disabled={loading} style={{ background: `linear-gradient(135deg,${C.green},#007a55)`, border: "none", borderRadius: 14, padding: 15, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "جارٍ الدخول..." : "🔑 دخول"}
          </button>
          <div style={{ fontSize: 12, color: C.textDim, textAlign: "center" }}>
            للحصول على حساب أدمن ثانوي، تواصل مع المدير الرئيسي
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== STAT CARD =====
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: 18, border: `1px solid ${C.cardBorder}`, display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ===== MAIN ADMIN =====
export default function AdminApp() {
  const [adminUser, setAdminUser] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [drivers, setDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);

  // New sub-admin form
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminCode, setNewAdminCode] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  const isSuperAdmin = adminUser?.role === "super";

  useEffect(() => {
    if (!adminUser) return;
    loadData();
  }, [adminUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load drivers
      const driversSnap = await getDocs(collection(db, "drivers"));
      setDrivers(driversSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load passengers
      const passengersSnap = await getDocs(collection(db, "passengers"));
      setPassengers(passengersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load admins (super only)
      if (adminUser?.role === "super") {
        const adminsSnap = await getDocs(collection(db, "admins"));
        setAdmins(adminsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      console.log("Load error:", e);
      // Use mock data if Firestore not set up
      setDrivers(MOCK_DRIVERS);
      setPassengers(MOCK_PASSENGERS);
    }
    setLoading(false);
  };

  const approveDriver = async (id) => {
    try {
      await updateDoc(doc(db, "drivers", id), { status: "approved", approvedAt: serverTimestamp() });
      setDrivers(p => p.map(d => d.id === id ? { ...d, status: "approved" } : d));
    } catch { setDrivers(p => p.map(d => d.id === id ? { ...d, status: "approved" } : d)); }
  };

  const rejectDriver = async (id) => {
    try {
      await updateDoc(doc(db, "drivers", id), { status: "rejected" });
      setDrivers(p => p.map(d => d.id === id ? { ...d, status: "rejected" } : d));
    } catch { setDrivers(p => p.map(d => d.id === id ? { ...d, status: "rejected" } : d)); }
  };

  const deleteDriver = async (id) => {
    if (!window.confirm("هل تريد حذف هذا السائق؟")) return;
    try { await deleteDoc(doc(db, "drivers", id)); } catch {}
    setDrivers(p => p.filter(d => d.id !== id));
  };

  const addAdmin = async () => {
    if (!newAdminEmail || !newAdminCode || !newAdminName) return;
    const newAdmin = { email: newAdminEmail, code: newAdminCode, name: newAdminName, approved: false, createdAt: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, "admins"), newAdmin);
      setAdmins(p => [...p, { id: ref.id, ...newAdmin }]);
    } catch { setAdmins(p => [...p, { id: Date.now().toString(), ...newAdmin }]); }
    setNewAdminEmail(""); setNewAdminCode(""); setNewAdminName("");
  };

  const approveAdmin = async (id) => {
    try { await updateDoc(doc(db, "admins", id), { approved: true }); } catch {}
    setAdmins(p => p.map(a => a.id === id ? { ...a, approved: true } : a));
  };

  const deleteAdmin = async (id) => {
    if (!window.confirm("هل تريد حذف هذا الأدمن؟")) return;
    try { await deleteDoc(doc(db, "admins", id)); } catch {}
    setAdmins(p => p.filter(a => a.id !== id));
  };

  if (!adminUser) return <AdminLogin onLogin={setAdminUser} />;

  const pendingDrivers = drivers.filter(d => d.status === "pending" || !d.status);
  const approvedDrivers = drivers.filter(d => d.status === "approved");

  const tabs = [
    { id: "dashboard", label: "الرئيسية", icon: "📊" },
    { id: "drivers", label: "السائقون", icon: "🚕", badge: pendingDrivers.length },
    { id: "passengers", label: "الركاب", icon: "👥" },
    ...(isSuperAdmin ? [{ id: "admins", label: "الأدمنات", icon: "🛡️" }] : []),
    { id: "settings", label: "الإعدادات", icon: "⚙️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#374151;border-radius:4px}`}</style>

      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.cardBorder}`, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>TaxiDZ Admin</div>
            <div style={{ fontSize: 11, color: isSuperAdmin ? C.yellow : C.green }}>
              {isSuperAdmin ? "👑 أدمن رئيسي" : "🔹 أدمن ثانوي"} · {adminUser.email}
            </div>
          </div>
        </div>
        <button onClick={() => { signOut(auth).catch(() => {}); setAdminUser(null); }}
          style={{ background: C.redLight, border: "none", borderRadius: 10, padding: "8px 14px", color: C.red, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>
          خروج 🚪
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.cardBorder}`, padding: "0 24px", display: "flex", gap: 4, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${C.green}` : "2px solid transparent", color: tab === t.id ? C.green : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: "14px 16px", whiteSpace: "nowrap", position: "relative" }}>
            {t.icon} {t.label}
            {t.badge > 0 && <span style={{ background: C.red, color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 20, marginRight: 6 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 20 }}>📊 لوحة المعلومات</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              <StatCard icon="🚕" label="إجمالي السائقين" value={drivers.length} color={C.green} />
              <StatCard icon="⏳" label="بانتظار الموافقة" value={pendingDrivers.length} color={C.orange} />
              <StatCard icon="✅" label="سائقون معتمدون" value={approvedDrivers.length} color={C.blue} />
              <StatCard icon="👥" label="إجمالي الركاب" value={passengers.length} color={C.purple} />
            </div>

            {/* Pending drivers alert */}
            {pendingDrivers.length > 0 && (
              <div style={{ background: C.orangeLight, border: `1px solid ${C.orange}44`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: C.orange, marginBottom: 12 }}>⚠️ سائقون ينتظرون الموافقة ({pendingDrivers.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingDrivers.slice(0, 3).map(d => (
                    <div key={d.id} style={{ background: C.card, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{d.name || d.email}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{d.phone || d.email}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => approveDriver(d.id)} style={{ background: C.green, border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}>قبول ✅</button>
                        <button onClick={() => rejectDriver(d.id)} style={{ background: C.redLight, border: "none", borderRadius: 8, padding: "6px 14px", color: C.red, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}>رفض ❌</button>
                      </div>
                    </div>
                  ))}
                </div>
                {pendingDrivers.length > 3 && <button onClick={() => setTab("drivers")} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", fontFamily: "inherit", marginTop: 8, fontSize: 13 }}>عرض الكل ({pendingDrivers.length}) ›</button>}
              </div>
            )}

            {/* Recent activity */}
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 14 }}>🕐 آخر النشاطات</div>
              {[
                { text: "سائق جديد طلب التسجيل", time: "منذ 5 دقائق", icon: "🚕", color: C.orange },
                { text: "راكب جديد انضم للتطبيق", time: "منذ 12 دقيقة", icon: "👤", color: C.blue },
                { text: "تم قبول سائق", time: "منذ ساعة", icon: "✅", color: C.green },
              ].map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${C.cardBorder}` : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: a.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{a.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DRIVERS */}
        {tab === "drivers" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 20 }}>🚕 إدارة السائقين</div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: `الكل (${drivers.length})`, filter: "all" },
                { label: `بانتظار الموافقة (${pendingDrivers.length})`, filter: "pending" },
                { label: `معتمدون (${approvedDrivers.length})`, filter: "approved" },
                { label: `مرفوضون (${drivers.filter(d => d.status === "rejected").length})`, filter: "rejected" },
              ].map(f => (
                <button key={f.filter} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 20, padding: "6px 14px", color: C.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>{f.label}</button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {drivers.length === 0 && (
                <div style={{ background: C.card, borderRadius: 16, padding: 32, textAlign: "center", border: `1px solid ${C.cardBorder}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🚕</div>
                  <div style={{ color: C.textMuted }}>لا يوجد سائقون بعد</div>
                </div>
              )}
              {drivers.map(d => (
                <div key={d.id} style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${d.status === "pending" ? C.orange : d.status === "approved" ? C.green : C.cardBorder}44` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      {/* Avatar / Selfie */}
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.cardBorder, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        {d.selfieUrl ? <img src={d.selfieUrl} alt="selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👨‍✈️"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{d.name || "—"}</div>
                        <div style={{ fontSize: 13, color: C.textMuted }}>{d.phone || d.email || "—"}</div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{d.carModel || "—"} · {d.carPlate || "—"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: d.status === "approved" ? C.greenLight : d.status === "rejected" ? C.redLight : C.orangeLight, color: d.status === "approved" ? C.green : d.status === "rejected" ? C.red : C.orange }}>
                        {d.status === "approved" ? "✅ معتمد" : d.status === "rejected" ? "❌ مرفوض" : "⏳ بانتظار"}
                      </span>
                    </div>
                  </div>

                  {/* Car photo */}
                  {d.carPhotoUrl && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>صورة السيارة</div>
                      <img src={d.carPhotoUrl} alt="car" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10 }} />
                    </div>
                  )}

                  {/* Documents info */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, background: d.selfieUrl ? C.greenLight : C.cardBorder, color: d.selfieUrl ? C.green : C.textMuted, padding: "3px 10px", borderRadius: 20 }}>
                      {d.selfieUrl ? "✅" : "❌"} سيلفي
                    </span>
                    <span style={{ fontSize: 11, background: d.carPhotoUrl ? C.greenLight : C.cardBorder, color: d.carPhotoUrl ? C.green : C.textMuted, padding: "3px 10px", borderRadius: 20 }}>
                      {d.carPhotoUrl ? "✅" : "❌"} صورة السيارة
                    </span>
                    <span style={{ fontSize: 11, background: d.licenseUrl ? C.greenLight : C.cardBorder, color: d.licenseUrl ? C.green : C.textMuted, padding: "3px 10px", borderRadius: 20 }}>
                      {d.licenseUrl ? "✅" : "❌"} رخصة القيادة
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    {d.status !== "approved" && (
                      <button onClick={() => approveDriver(d.id)} style={{ flex: 1, background: `linear-gradient(135deg,${C.green},#007a55)`, border: "none", borderRadius: 10, padding: "10px", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>✅ قبول</button>
                    )}
                    {d.status !== "rejected" && (
                      <button onClick={() => rejectDriver(d.id)} style={{ flex: 1, background: C.orangeLight, border: "none", borderRadius: 10, padding: "10px", color: C.orange, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>⏸️ تعليق</button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => deleteDriver(d.id)} style={{ background: C.redLight, border: "none", borderRadius: 10, padding: "10px 16px", color: C.red, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>🗑️</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PASSENGERS */}
        {tab === "passengers" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 20 }}>👥 إدارة الركاب</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {passengers.length === 0 && (
                <div style={{ background: C.card, borderRadius: 16, padding: 32, textAlign: "center", border: `1px solid ${C.cardBorder}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <div style={{ color: C.textMuted }}>لا يوجد ركاب بعد</div>
                </div>
              )}
              {passengers.map(p => (
                <div key={p.id} style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{p.name || p.email || "—"}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{p.phone || p.email || "—"}</div>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <button onClick={() => { if (window.confirm("حذف هذا الراكب؟")) setPassengers(pp => pp.filter(x => x.id !== p.id)); }}
                      style={{ background: C.redLight, border: "none", borderRadius: 8, padding: "6px 12px", color: C.red, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMINS - SUPER ONLY */}
        {tab === "admins" && isSuperAdmin && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 20 }}>🛡️ إدارة الأدمنات</div>

            {/* Add new admin */}
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.cardBorder}`, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 14 }}>➕ إضافة أدمن ثانوي</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="الاسم"
                  style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "11px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", textAlign: "right" }} />
                <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email"
                  style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "11px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
                <input value={newAdminCode} onChange={e => setNewAdminCode(e.target.value)} placeholder="رمز الدخول (كلمة المرور)"
                  style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "11px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
                <button onClick={addAdmin} style={{ background: `linear-gradient(135deg,${C.green},#007a55)`, border: "none", borderRadius: 10, padding: "12px", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>
                  ➕ إضافة الأدمن
                </button>
              </div>
            </div>

            {/* Admins list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {admins.map(a => (
                <div key={a.id} style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${a.approved ? C.green : C.orange}44`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{a.name || "—"}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{a.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: a.approved ? C.greenLight : C.orangeLight, color: a.approved ? C.green : C.orange }}>
                      {a.approved ? "✅ مقبول" : "⏳ بانتظار"}
                    </span>
                    {!a.approved && (
                      <button onClick={() => approveAdmin(a.id)} style={{ background: C.green, border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}>قبول</button>
                    )}
                    <button onClick={() => deleteAdmin(a.id)} style={{ background: C.redLight, border: "none", borderRadius: 8, padding: "6px 12px", color: C.red, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>🗑️</button>
                  </div>
                </div>
              ))}
              {admins.length === 0 && <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>لا يوجد أدمنات ثانويون بعد</div>}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 20 }}>⚙️ الإعدادات</div>
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.cardBorder}`, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 14 }}>💰 نظام التسعير</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                <span style={{ color: C.textMuted }}>السعر لكل كيلومتر</span>
                <span style={{ color: C.green, fontWeight: 700 }}>30 دج</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                <span style={{ color: C.textMuted }}>الحد الأدنى للرحلة</span>
                <span style={{ color: C.green, fontWeight: 700 }}>100 دج</span>
              </div>
            </div>
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 14 }}>📱 معلومات التطبيق</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                <span style={{ color: C.textMuted }}>اسم التطبيق</span>
                <span style={{ color: C.text, fontWeight: 700 }}>TaxiDZ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                <span style={{ color: C.textMuted }}>الإصدار</span>
                <span style={{ color: C.text, fontWeight: 700 }}>1.0.0</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mock data for when Firestore is not configured
const MOCK_DRIVERS = [
  { id: "1", name: "كريم بن علي", phone: "0550123456", email: "karim@gmail.com", carModel: "رونو سيمبول 2021", carPlate: "213-01-DZ", status: "pending", selfieUrl: null, carPhotoUrl: null, licenseUrl: null },
  { id: "2", name: "يوسف مزياني", phone: "0661234567", email: "youssef@gmail.com", carModel: "بيجو 301 2020", carPlate: "107-16-DZ", status: "approved", selfieUrl: null, carPhotoUrl: null, licenseUrl: null },
];
const MOCK_PASSENGERS = [
  { id: "1", name: "محمد أمين", phone: "0770123456", email: "amine@gmail.com" },
  { id: "2", name: "سارة بن علي", phone: "0550987654", email: "sara@gmail.com" },
];
