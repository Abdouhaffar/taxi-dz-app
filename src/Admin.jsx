import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

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
} catch (e) { console.log(e); }

const SUPER_ADMIN_EMAIL = "abdouhaffar@gmail.com";
const SUPER_ADMIN_CODE = "123456";

const C = {
  bg: "#070b14",
  sidebar: "#0d1117",
  card: "#0d1117",
  cardHover: "#161b22",
  border: "#21262d",
  green: "#238636",
  greenLight: "#2ea043",
  greenGlow: "#23863622",
  orange: "#d97706",
  orangeLight: "#f59e0b",
  red: "#da3633",
  redLight: "#f85149",
  redGlow: "#da363322",
  blue: "#1f6feb",
  blueLight: "#388bfd",
  blueGlow: "#1f6feb22",
  purple: "#8b5cf6",
  purpleGlow: "#8b5cf622",
  yellow: "#e3b341",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#484f58",
  accent: "#58a6ff",
};

// ===== HELPERS =====
const Badge = ({ color, children }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>
);

const StatCard = ({ icon, label, value, sub, color, trend }) => (
  <div style={{ background: C.card, borderRadius: 12, padding: "20px 22px", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
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
  <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, #1f6feb, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, overflow: "hidden", flexShrink: 0, border: `2px solid ${C.border}` }}>
    {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name?.[0] || "?").toUpperCase()}
  </div>
);

const Btn = ({ onClick, children, color = C.blue, outline = false, small = false, disabled = false }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ background: outline ? "transparent" : color, border: `1px solid ${color}`, borderRadius: 8, padding: small ? "5px 12px" : "8px 16px", color: outline ? color : "#fff", fontFamily: "inherit", fontWeight: 700, cursor: disabled ? "default" : "pointer", fontSize: small ? 12 : 13, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", transition: "all 0.15s" }}>
    {children}
  </button>
);

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
      if (email === SUPER_ADMIN_EMAIL && code === SUPER_ADMIN_CODE) {
        onLogin({ email, role: "super", name: "عبد الواحد هفار" });
        return;
      }
      // Sub admin check
      let found = false;
      const unsub = onSnapshot(collection(db, "admins"), snap => {
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.email === email && data.code === code && data.approved) {
            found = true;
            onLogin({ email, role: "sub", name: data.name, id: d.id });
          }
        });
        if (!found) setError("البريد أو الرمز غير صحيح، أو لم يتم قبولك بعد");
        unsub();
        setLoading(false);
      });
    } catch (e) {
      setError("حدث خطأ"); setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #1f6feb, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "0 8px 32px #1f6feb44" }}>🛡️</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>TaxiDZ Admin</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>لوحة التحكم الإدارية</div>
        </div>

        <div style={{ background: C.card, borderRadius: 16, padding: 28, border: `1px solid ${C.border}`, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>البريد الإلكتروني</div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@taxidz.dz" type="email"
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>رمز الدخول</div>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="••••••" type="password"
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr" }} />
            </div>
            {error && <div style={{ background: C.redGlow, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.redLight, textAlign: "center" }}>{error}</div>}
            <button onClick={handle} disabled={loading}
              style={{ background: "linear-gradient(135deg, #1f6feb, #8b5cf6)", border: "none", borderRadius: 8, padding: "13px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px #1f6feb44" }}>
              {loading ? "جارٍ الدخول..." : "🔑 دخول"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textDim, textAlign: "center", marginTop: 16 }}>للحصول على حساب أدمن ثانوي تواصل مع المدير الرئيسي</div>
        </div>
      </div>
    </div>
  );
}

// ===== SIDEBAR =====
function Sidebar({ tab, setTab, admin, onLogout, counts }) {
  const isSuperAdmin = admin?.role === "super";
  const navItems = [
    { id: "dashboard", icon: "📊", label: "الرئيسية" },
    { id: "drivers", icon: "🚕", label: "السائقون", badge: counts.pendingDrivers },
    { id: "passengers", icon: "👥", label: "الركاب" },
    ...(isSuperAdmin ? [{ id: "admins", icon: "🛡️", label: "الأدمنات", badge: counts.pendingAdmins }] : []),
    { id: "reports", icon: "📈", label: "التقارير" },
    { id: "settings", icon: "⚙️", label: "الإعدادات" },
  ];

  return (
    <div style={{ width: 220, minHeight: "100vh", background: C.sidebar, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 100 }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#1f6feb,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>TaxiDZ</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)}
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

      {/* Admin info */}
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

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon="🚕" label="إجمالي السائقين" value={drivers.length} sub={`${approved.length} معتمد`} color={C.green} trend="12% هذا الأسبوع" />
        <StatCard icon="⏳" label="بانتظار الموافقة" value={pending.length} sub="طلبات جديدة" color={C.orange} />
        <StatCard icon="👥" label="إجمالي الركاب" value={passengers.length} sub="مستخدم نشط" color={C.blue} trend="8% هذا الأسبوع" />
        <StatCard icon="❌" label="طلبات مرفوضة" value={rejected.length} color={C.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Pending drivers */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
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

        {/* Activity */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
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
    catch (e) { console.log(e); }
    setLoading(false); setSelected(null);
  };

  const rejectDriver = async (id) => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try { await updateDoc(doc(db, "drivers", id), { verificationStatus: "rejected", rejectionReason: rejectReason, rejectedAt: serverTimestamp() }); }
    catch (e) { console.log(e); }
    setLoading(false); setShowReject(null); setRejectReason(""); setSelected(null);
  };

  const deleteDriver = async (id) => {
    if (!window.confirm("هل تريد حذف هذا السائق نهائياً؟")) return;
    try { await deleteDoc(doc(db, "drivers", id)); }
    catch (e) { console.log(e); }
    setSelected(null);
  };

  const statusBadge = (s) => {
    if (s === "approved") return <Badge color={C.green}>✅ معتمد</Badge>;
    if (s === "rejected") return <Badge color={C.red}>❌ مرفوض</Badge>;
    return <Badge color={C.orange}>⏳ بانتظار</Badge>;
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      {/* List */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>🚕 إدارة السائقين</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>مراجعة وإدارة طلبات التوثيق</div>
        </div>

        {/* Filters */}
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

        {/* Search */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم، البريد، اللوحة، الولاية..."
            style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "rtl" }} />
        </div>

        {/* Table */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
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

      {/* Detail panel */}
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

          {/* Info */}
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

          {/* Photos */}
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

          {/* Rejection reason */}
          {selected.verificationStatus === "rejected" && selected.rejectionReason && (
            <div style={{ marginTop: 14, background: C.redGlow, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>سبب الرفض</div>
              <div style={{ fontSize: 12, color: C.text }}>{selected.rejectionReason}</div>
            </div>
          )}

          {/* Actions */}
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

      {/* Reject modal */}
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
    try { await deleteDoc(doc(db, "passengers", id)); } catch (e) { console.log(e); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>👥 إدارة الركاب</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>{passengers.length} راكب مسجل</div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم، البريد، الهاتف..."
        style={{ width: "100%", maxWidth: 400, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: "inherit", fontSize: 13, color: C.text, outline: "none", direction: "rtl", marginBottom: 16 }} />

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
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
    } catch (e) { setError("خطأ في الإضافة"); }
    setLoading(false);
  };

  const approveAdmin = async (id) => {
    try { await updateDoc(doc(db, "admins", id), { approved: true, approvedAt: serverTimestamp() }); }
    catch (e) { console.log(e); }
  };

  const deleteAdmin = async (id) => {
    if (!window.confirm("حذف هذا الأدمن؟")) return;
    try { await deleteDoc(doc(db, "admins", id)); } catch (e) { console.log(e); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>🛡️ إدارة الأدمنات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>أنت الوحيد الذي يمكنه قبول أو حذف الأدمنات</div>
      </div>

      {/* Add admin */}
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

      {/* Admins list */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
          <span>الاسم</span>
          <span>البريد</span>
          <span>الحالة</span>
          <span>إجراء</span>
        </div>
        {/* Super admin row */}
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
        {/* Wilayas */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
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

        {/* Car brands */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
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

        {/* Summary */}
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

// ===== SETTINGS =====
function SettingsPanel({ admin }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>⚙️ الإعدادات</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>إعدادات التطبيق والنظام</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
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
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
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

// ===== MAIN =====
export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [drivers, setDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    if (!admin || !db) return;
    const u1 = onSnapshot(collection(db, "drivers"), snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "passengers"), snap => setPassengers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = admin.role === "super" ? onSnapshot(collection(db, "admins"), snap => setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })))) : () => {};
    return () => { u1(); u2(); u3(); };
  }, [admin]);

  if (!admin) return <AdminLogin onLogin={setAdmin} />;

  const counts = {
    pendingDrivers: drivers.filter(d => d.verificationStatus === "pending" || !d.verificationStatus).length,
    pendingAdmins: admins.filter(a => !a.approved).length,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#21262d;border-radius:4px} select option{background:#0d1117;color:#e6edf3}`}</style>

      <Sidebar tab={tab} setTab={setTab} admin={admin} onLogout={() => setAdmin(null)} counts={counts} />

      <main style={{ flex: 1, marginRight: 220, padding: "32px 28px", overflowY: "auto", minHeight: "100vh" }}>
        {tab === "dashboard" && <Dashboard drivers={drivers} passengers={passengers} admins={admins} />}
        {tab === "drivers" && <DriversPanel drivers={drivers} isSuperAdmin={admin.role === "super"} />}
        {tab === "passengers" && <PassengersPanel passengers={passengers} isSuperAdmin={admin.role === "super"} />}
        {tab === "admins" && admin.role === "super" && <AdminsPanel admins={admins} currentAdmin={admin} />}
        {tab === "reports" && <ReportsPanel drivers={drivers} passengers={passengers} />}
        {tab === "settings" && <SettingsPanel admin={admin} />}
      </main>
    </div>
  );
}