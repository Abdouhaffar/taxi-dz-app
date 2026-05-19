import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

// ===== CONSTANTS =====
const C = {
  bg: "#0f1117",
  card: "#1a1d27",
  border: "#2a2d3e",
  green: "#00b37e",
  greenLight: "#00b37e22",
  greenDark: "#007a55",
  orange: "#f97316",
  orangeDark: "#ea580c",
  red: "#ef4444",
  redLight: "#ef444422",
  blue: "#3b82f6",
  blueLight: "#3b82f615",
  yellow: "#f59e0b",
  text: "#ffffff",
  textMuted: "#94a3b8",
  textLight: "#64748b",
};

const PRICE_PER_KM = 30;
const MIN_PRICE = 100;

const calcPrice = (km) => {
  if (!km || km <= 0) return MIN_PRICE;
  return Math.max(Math.round(km * PRICE_PER_KM), MIN_PRICE);
};

// ===== VERIFICATION STEPS =====
const VERIFICATION_STEPS = [
  { id: "selfie", label: "صورة شخصية", icon: "🤳", desc: "صورة واضحة لوجهك بخلفية بسيطة", type: "image" },
  { id: "carFront", label: "صورة السيارة", icon: "🚗", desc: "الواجهة الأمامية مع لوحة الأرقام واضحة", type: "image" },
  { id: "plate", label: "رقم اللوحة", icon: "🔢", desc: "أدخل رقم لوحة السيارة", type: "text" },
  { id: "carModel", label: "موديل السيارة", icon: "📋", desc: "مثال: رونو سيمبول 2021", type: "text" },
];

// ===== MOCK REQUESTS =====
const MOCK_REQUESTS = [
  { id: 1, name: "أحمد سليم", phone: "+213550123456", from: "باب الزوار", to: "حيدرة", offer: 280, km: 9.3, avatar: "👨" },
  { id: 2, name: "نور الهدى", phone: "+213661234567", from: "القبة", to: "المطار", offer: 630, km: 21, avatar: "👩" },
];

// ===== HOOK: useDriverStatus =====
function useDriverStatus(uid) {
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, "drivers", uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setStatus(d.verificationStatus || "none");
          setData(d);
        } else {
          setStatus("none");
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Driver status error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { status, data, loading };
}

// ===== COMPONENT: DriverVerification =====
function DriverVerification({ uid, onVerified }) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState({ selfie: null, carFront: null });
  const [previews, setPreviews] = useState({ selfie: null, carFront: null });
  const [plateNumber, setPlateNumber] = useState("");
  const [carModel, setCarModel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef(null);

  const currentStep = VERIFICATION_STEPS[step];

  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError("يُسمح فقط بصور JPG, PNG, WEBP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviews(prev => ({ ...prev, [type]: ev.target.result }));
      setFiles(prev => ({ ...prev, [type]: file }));
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file, path) => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  };

  const handleSubmit = async () => {
    if (!files.selfie || !files.carFront || !plateNumber.trim() || !carModel.trim()) {
      setError("يرجى إكمال جميع البيانات");
      return;
    }

    setUploading(true); setError("");

    try {
      const [selfieUrl, carFrontUrl] = await Promise.all([
        uploadImage(files.selfie, `drivers/${uid}/selfie_${Date.now()}.jpg`),
        uploadImage(files.carFront, `drivers/${uid}/car_${Date.now()}.jpg`)
      ]);

      await updateDoc(doc(db, "drivers", uid), {
        verificationStatus: "pending",
        selfieUrl,
        carFrontUrl,
        plateNumber: plateNumber.trim().toUpperCase(),
        carModel: carModel.trim(),
        submittedAt: serverTimestamp(),
        reviewedAt: null,
        rejectionReason: null,
      });

      setSubmitted(true);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء الرفع، حاول مرة أخرى");
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: C.card, borderRadius: 24, padding: 40, textAlign: "center", maxWidth: 360, width: "100%", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>⏳</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 12 }}>طلبك قيد المراجعة</div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.8, marginBottom: 24 }}>
            تم إرسال بياناتك للأدمن للمراجعة.<br/>
            سيتم إشعارك فور الموافقة.<br/>
            <span style={{ color: C.orange, fontWeight: 700 }}>عادةً تستغرق المراجعة 24-48 ساعة</span>
          </div>
          <div style={{ background: C.greenLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.green}44` }}>
            <div style={{ fontSize: 13, color: C.green }}>✅ ستتمكن من استقبال الطلبات فور التوثيق</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", padding: "40px 20px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛡️</div>
        <div style={{ fontWeight: 900, fontSize: 24, color: C.text, marginBottom: 6 }}>توثيق الحساب</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>خطوة {step + 1} من {VERIFICATION_STEPS.length}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
        {VERIFICATION_STEPS.map((s, i) => (
          <div key={s.id} style={{ 
            flex: 1, 
            height: 4, 
            borderRadius: 2, 
            background: i <= step ? C.orange : C.border,
            transition: "all 0.3s ease"
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 400, margin: "0 auto", background: C.card, borderRadius: 24, padding: 28, border: `1px solid ${C.border}` }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{currentStep.icon}</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 4 }}>{currentStep.label}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{currentStep.desc}</div>
        </div>

        {currentStep.type === "image" && (
          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e, currentStep.id === "selfie" ? "selfie" : "carFront")}
              style={{ display: "none" }}
            />
            
            {previews[currentStep.id === "selfie" ? "selfie" : "carFront"] ? (
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 20, border: `2px solid ${C.green}` }}>
                <img 
                  src={previews[currentStep.id === "selfie" ? "selfie" : "carFront"]} 
                  alt="معاينة" 
                  style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
                />
                <button
                  onClick={() => {
                    const key = currentStep.id === "selfie" ? "selfie" : "carFront";
                    setPreviews(prev => ({ ...prev, [key]: null }));
                    setFiles(prev => ({ ...prev, [key]: null }));
                    setError("");
                  }}
                  style={{ 
                    position: "absolute", 
                    top: 10, 
                    left: 10, 
                    background: C.red, 
                    border: "none", 
                    borderRadius: 8, 
                    padding: "8px 14px", 
                    color: "#fff", 
                    fontFamily: "inherit", 
                    cursor: "pointer", 
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  🗑️ إعادة
                </button>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "20px 14px 14px" }}>
                  <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✅ تم اختيار الصورة</div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  width: "100%", 
                  height: 180, 
                  borderRadius: 16, 
                  border: `2px dashed ${C.border}`, 
                  background: C.bg, 
                  color: C.textMuted, 
                  fontFamily: "inherit", 
                  cursor: "pointer", 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: 10, 
                  marginBottom: 20,
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.orange}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <span style={{ fontSize: 36 }}>📷</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>اضغط لاختيار الصورة</span>
                <span style={{ fontSize: 11, color: C.textLight }}>JPG, PNG, WEBP — أقصى 5MB</span>
              </button>
            )}
          </div>
        )}

        {currentStep.id === "plate" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: C.bg, borderRadius: 14, padding: "4px 4px 4px 16px", display: "flex", alignItems: "center", border: `1px solid ${C.border}`, marginBottom: 8 }}>
              <span style={{ fontSize: 20, marginLeft: 8 }}>🇩🇿</span>
              <input
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="213-01-DZ"
                maxLength={12}
                style={{ 
                  flex: 1,
                  background: "transparent", 
                  border: "none", 
                  padding: "12px 0", 
                  fontFamily: "inherit", 
                  fontSize: 18, 
                  color: C.text, 
                  outline: "none", 
                  direction: "ltr",
                  fontWeight: 700,
                  letterSpacing: 1
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: C.textLight }}>مثال: 213-01-DZ, 107-16-DZ</div>
          </div>
        )}

        {currentStep.id === "carModel" && (
          <div style={{ marginBottom: 20 }}>
            <input
              value={carModel}
              onChange={e => setCarModel(e.target.value)}
              placeholder="رونو سيمبول 2021"
              style={{ 
                width: "100%", 
                background: C.bg, 
                border: `1px solid ${C.border}`, 
                borderRadius: 14, 
                padding: "16px", 
                fontFamily: "inherit", 
                fontSize: 16, 
                color: C.text, 
                outline: "none", 
                textAlign: "right",
                marginBottom: 8
              }}
            />
            <div style={{ fontSize: 12, color: C.textLight }}>أدخل النوع والموديل والسنة</div>
          </div>
        )}

        {error && (
          <div style={{ background: C.redLight, borderRadius: 12, padding: "14px", color: C.red, fontSize: 13, textAlign: "center", marginBottom: 20, border: `1px solid ${C.red}44` }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => { setStep(s => s - 1); setError(""); }}
              style={{ 
                flex: 1, 
                background: C.border, 
                border: "none", 
                borderRadius: 14, 
                padding: "14px", 
                color: C.text, 
                fontFamily: "inherit", 
                fontWeight: 700, 
                cursor: "pointer",
                fontSize: 14
              }}
            >
              ← السابق
            </button>
          )}
          
          {step < VERIFICATION_STEPS.length - 1 ? (
            <button
              onClick={() => { setStep(s => s + 1); setError(""); }}
              style={{ 
                flex: 2, 
                background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, 
                border: "none", 
                borderRadius: 14, 
                padding: "14px", 
                color: "#fff", 
                fontFamily: "inherit", 
                fontWeight: 800, 
                cursor: "pointer",
                fontSize: 15
              }}
            >
              التالي →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={uploading}
              style={{ 
                flex: 2, 
                background: uploading ? C.border : `linear-gradient(135deg,${C.green},${C.greenDark})`, 
                border: "none", 
                borderRadius: 14, 
                padding: "14px", 
                color: "#fff", 
                fontFamily: "inherit", 
                fontWeight: 800, 
                cursor: uploading ? "default" : "pointer", 
                opacity: uploading ? 0.6 : 1,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {uploading ? (
                <>
                  <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  جارٍ الرفع...
                </>
              ) : (
                <>✅ إرسال للمراجعة</>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ===== COMPONENT: RejectedView =====
function RejectedView({ data, onRetry }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 24, padding: 32, textAlign: "center", maxWidth: 360, width: "100%", border: `1px solid ${C.red}44` }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: C.red, marginBottom: 12 }}>تم رفض التوثيق</div>
        
        {data?.rejectionReason && (
          <div style={{ background: C.redLight, borderRadius: 12, padding: "14px", marginBottom: 20, textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.red, marginBottom: 4, fontWeight: 700 }}>سبب الرفض:</div>
            <div style={{ fontSize: 14, color: C.text }}>{data.rejectionReason}</div>
          </div>
        )}

        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.7 }}>
          يمكنك تصحيح البيانات وإعادة الإرسال.<br/>
          تأكد من وضوح الصور وصحة المعلومات.
        </div>

        <button
          onClick={onRetry}
          style={{ 
            width: "100%",
            background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, 
            border: "none", 
            borderRadius: 14, 
            padding: "14px", 
            color: "#fff", 
            fontFamily: "inherit", 
            fontWeight: 800, 
            cursor: "pointer",
            fontSize: 15
          }}
        >
          🔄 إعادة التوثيق
        </button>
      </div>
    </div>
  );
}

// ===== COMPONENT: DriverDashboard =====
export default function DriverDashboard({ user, onLogout }) {
  const { status, data, loading } = useDriverStatus(user?.uid);
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState("home");
  const [reqs, setReqs] = useState(MOCK_REQUESTS);

  const handleRetry = async () => {
    try {
      await updateDoc(doc(db, "drivers", user.uid), {
        verificationStatus: "none",
        submittedAt: null,
        rejectionReason: null,
      });
    } catch (err) {
      console.error("Retry error:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <div style={{ color: C.textMuted, fontSize: 14 }}>جارٍ التحقق من الحساب...</div>
        </div>
      </div>
    );
  }

  if (status === "none" || status === "rejected") {
    return <DriverVerification uid={user?.uid} onVerified={() => {}} />;
  }

  if (status === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: C.card, borderRadius: 24, padding: 40, textAlign: "center", maxWidth: 360, width: "100%", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>⏳</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 12 }}>طلبك قيد المراجعة</div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.8, marginBottom: 20 }}>
            تم إرسال بياناتك للأدمن.<br/>
            سيتم إشعارك فور الموافقة.
          </div>
          <div style={{ background: C.blueLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.blue}44`, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.blue }}>📧 سيتم إرسال إشعار عند اكتمال المراجعة</div>
          </div>
          <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 20px", color: C.textMuted, fontFamily: "inherit", cursor: "pointer", fontSize: 13 }}>
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "أرباح اليوم", value: "4,550 دج", icon: "💰", color: C.green },
    { label: "رحلات اليوم", value: "3", icon: "🚕", color: C.blue },
    { label: "التقييم", value: "4.9 ⭐", icon: "🏆", color: C.yellow },
    { label: "معدل القبول", value: "94%", icon: "📊", color: C.orange },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: C.card, padding: "48px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ 
              width: 52, 
              height: 52, 
              borderRadius: "50%", 
              background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              fontSize: 24,
              border: "3px solid #2a2d3e"
            }}>
              👨‍✈️
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{data?.name || user?.displayName || "سائق"}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                ⭐ {data?.rating || "4.9"} · {data?.carModel || "غير محدد"}
              </div>
              {data?.plateNumber && (
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 2, direction: "ltr", display: "inline-block" }}>
                  🚗 {data.plateNumber}
                </div>
              )}
            </div>
          </div>
          
          <div 
            onClick={() => setOnline(!online)} 
            style={{ 
              width: 56, 
              height: 32, 
              borderRadius: 16, 
              background: online ? C.green : C.border, 
              position: "relative", 
              cursor: "pointer", 
              transition: "all 0.3s ease",
              border: `2px solid ${online ? C.green : "transparent"}`
            }}
          >
            <div style={{ 
              position: "absolute", 
              top: 3, 
              right: online ? 3 : "auto", 
              left: online ? "auto" : 3, 
              width: 22, 
              height: 22, 
              borderRadius: "50%", 
              background: "#fff", 
              transition: "all 0.3s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }} />
          </div>
        </div>

        {online && (
          <div style={{ 
            background: C.greenLight, 
            border: `1px solid ${C.green}44`, 
            borderRadius: 12, 
            padding: "10px 14px", 
            fontSize: 13, 
            color: C.green,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700
          }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
            🟢 متصل — تلقّي الطلبات
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 100 }}>
        {tab === "home" && (
          <>
            <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ 
                  background: C.card, 
                  borderRadius: 16, 
                  padding: 16, 
                  border: `1px solid ${C.border}`,
                  transition: "transform 0.2s"
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {online && reqs.length > 0 && (
              <div style={{ padding: "16px 20px 0" }}>
                <div style={{ 
                  fontWeight: 800, 
                  fontSize: 15, 
                  color: C.text, 
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
                  🔔 طلبات جديدة ({reqs.length})
                </div>
                
                {reqs.map(r => (
                  <div key={r.id} style={{ 
                    background: C.card, 
                    borderRadius: 18, 
                    padding: 16, 
                    marginBottom: 10, 
                    border: `1px solid ${C.orange}44`,
                    animation: "slideIn 0.3s ease"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ 
                          width: 44, 
                          height: 44, 
                          borderRadius: "50%", 
                          background: C.border, 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          fontSize: 20 
                        }}>
                          {r.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{r.from} ← {r.to} · {r.km} كم</div>
                          <div style={{ fontSize: 11, color: r.offer >= calcPrice(r.km) ? C.green : C.red, marginTop: 2 }}>
                            معيار: {calcPrice(r.km)} دج {r.offer >= calcPrice(r.km) ? "✅ جيد" : "⚠️ منخفض"}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.orange }}>{r.offer} دج</div>
                        <div style={{ fontSize: 11, color: C.textLight }}>عرض الراكب</div>
                      </div>
                    </div>

                    <a 
                      href={`tel:${r.phone}`} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 10, 
                        background: C.greenLight, 
                        border: `1px solid ${C.green}44`, 
                        borderRadius: 12, 
                        padding: "12px 14px", 
                        marginBottom: 12, 
                        textDecoration: "none",
                        transition: "all 0.2s"
                      }}
                    >
                      <span style={{ fontSize: 22 }}>📞</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.textMuted }}>رقم هاتف الراكب</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: C.green, direction: "ltr" }}>{r.phone}</div>
                      </div>
                      <div style={{ 
                        background: C.green, 
                        borderRadius: 8, 
                        padding: "6px 12px", 
                        fontSize: 12, 
                        color: "#fff", 
                        fontWeight: 700,
                        whiteSpace: "nowrap"
                      }}>
                        ☎️ اتصل الآن
                      </div>
                    </a>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        onClick={() => setReqs(p => p.filter(x => x.id !== r.id))} 
                        style={{ 
                          flex: 1, 
                          background: C.redLight, 
                          border: `1px solid ${C.red}44`, 
                          borderRadius: 10, 
                          padding: "12px", 
                          color: C.red, 
                          fontFamily: "inherit", 
                          fontWeight: 700, 
                          cursor: "pointer",
                          fontSize: 14
                        }}
                      >
                        ❌ رفض
                      </button>
                      <button 
                        onClick={() => setReqs(p => p.filter(x => x.id !== r.id))} 
                        style={{ 
                          flex: 2, 
                          background: `linear-gradient(135deg,${C.green},${C.greenDark})`, 
                          border: "none", 
                          borderRadius: 10, 
                          padding: "12px", 
                          color: "#fff", 
                          fontFamily: "inherit", 
                          fontWeight: 800, 
                          cursor: "pointer",
                          fontSize: 14
                        }}
                      >
                        ✅ قبول {r.offer} دج
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {online && reqs.length === 0 && (
              <div style={{ margin: "20px", background: C.card, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🕐</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>لا توجد طلبات حالياً</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>انتظر قليلاً... ستصلك طلبات قريباً</div>
              </div>
            )}

            {!online && (
              <div style={{ margin: "16px 20px", background: C.card, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>😴</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 8 }}>أنت غير متصل</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>فعّل الاتصال لاستقبال طلبات الركاب</div>
                <button 
                  onClick={() => setOnline(true)} 
                  style={{ 
                    background: `linear-gradient(135deg,${C.green},${C.greenDark})`, 
                    border: "none", 
                    borderRadius: 14, 
                    padding: "14px 40px", 
                    color: "#fff", 
                    fontFamily: "inherit", 
                    fontWeight: 800, 
                    fontSize: 15, 
                    cursor: "pointer"
                  }}
                >
                  🟢 تفعيل الاتصال
                </button>
              </div>
            )}
          </>
        )}

        {tab === "profile" && (
          <div style={{ padding: "20px 20px 100px" }}>
            <div style={{ 
              background: C.card, 
              borderRadius: 20, 
              padding: 28, 
              border: `1px solid ${C.border}`, 
              textAlign: "center", 
              marginBottom: 16 
            }}>
              <div style={{ 
                width: 80, 
                height: 80, 
                borderRadius: "50%", 
                background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                fontSize: 36,
                margin: "0 auto 16px",
                border: "4px solid #2a2d3e"
              }}>
                👨‍✈️
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.text, marginBottom: 4 }}>{data?.name || user?.displayName || "سائق"}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{data?.email || user?.email}</div>
              
              {data?.carModel && (
                <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 4 }}>
                  🚗 {data.carModel}
                </div>
              )}
              {data?.plateNumber && (
                <div style={{ fontSize: 14, color: C.textLight, direction: "ltr", marginBottom: 12 }}>
                  🔢 {data.plateNumber}
                </div>
              )}

              <div style={{ 
                display: "inline-block", 
                background: C.greenLight, 
                color: C.green, 
                padding: "6px 18px", 
                borderRadius: 20, 
                fontSize: 13, 
                fontWeight: 800,
                border: `1px solid ${C.green}44`
              }}>
                ✅ سائق معتمد
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 12 }}>📋 بيانات التوثيق</div>
              
              {data?.selfieUrl && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>الصورة الشخصية</div>
                  <img src={data.selfieUrl} alt="سيلفي" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, border: `1px solid ${C.border}` }} />
                </div>
              )}
              
              {data?.carFrontUrl && (
                <div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>صورة السيارة</div>
                  <img src={data.carFrontUrl} alt="سيارة" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, border: `1px solid ${C.border}` }} />
                </div>
              )}
            </div>

            <button 
              onClick={onLogout} 
              style={{ 
                width: "100%", 
                background: C.redLight, 
                border: `1px solid ${C.red}44`, 
                borderRadius: 16, 
                padding: 16, 
                color: C.red, 
                fontFamily: "inherit", 
                fontWeight: 800, 
                fontSize: 15, 
                cursor: "pointer"
              }}
            >
              🚪 تسجيل الخروج
            </button>
          </div>
        )}
      </div>

      <div style={{ 
        position: "fixed", 
        bottom: 0, 
        left: "50%", 
        transform: "translateX(-50%)", 
        width: "100%", 
        maxWidth: 430, 
        background: C.card, 
        borderTop: `1px solid ${C.border}`, 
        display: "flex", 
        padding: "8px 0 20px",
        zIndex: 100
      }}>
        {[
          { id: "home", label: "الرئيسية", icon: "🏠" }, 
          { id: "profile", label: "حسابي", icon: "👤" }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)} 
            style={{ 
              flex: 1, 
              background: "none", 
              border: "none", 
              cursor: "pointer", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              gap: 4, 
              padding: "8px 0",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontSize: 22, opacity: tab === t.id ? 1 : 0.4, transition: "all 0.2s" }}>{t.icon}</div>
            <div style={{ 
              fontSize: 10, 
              color: tab === t.id ? C.green : C.textLight, 
              fontWeight: tab === t.id ? 700 : 400,
              transition: "all 0.2s"
            }}>
              {t.label}
            </div>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
