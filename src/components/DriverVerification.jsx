import { useState, useRef } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase"; // استيراد db من App.jsx
import { uploadImage } from "../utils/storage";

const VERIFICATION_STEPS = [
  { id: "selfie", label: "صورة شخصية", icon: "🤳", desc: "صورة واضحة لوجهك" },
  { id: "carFront", label: "صورة السيارة", icon: "🚗", desc: "الواجهة الأمامية مع اللوحة" },
  { id: "plate", label: "رقم اللوحة", icon: "🔢", desc: "أدخل رقم اللوحة" },
  { id: "carModel", label: "موديل السيارة", icon: "📋", desc: "مثال: رونو سيمبول 2021" },
];

export default function DriverVerification({ uid, onComplete }) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState({ selfie: null, carFront: null });
  const [previews, setPreviews] = useState({ selfie: null, carFront: null });
  const [plateNumber, setPlateNumber] = useState("");
  const [carModel, setCarModel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const currentStep = VERIFICATION_STEPS[step];

  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // معاينة الصورة
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviews(prev => ({ ...prev, [type]: ev.target.result }));
      setFiles(prev => ({ ...prev, [type]: file }));
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    // التحقق من اكتمال البيانات
    if (!files.selfie || !files.carFront || !plateNumber.trim() || !carModel.trim()) {
      setError("يرجى إكمال جميع البيانات");
      return;
    }

    setUploading(true); setError("");

    try {
      // 1. رفع الصور للـ Storage
      const selfieUrl = await uploadImage(files.selfie, `drivers/${uid}/selfie.jpg`);
      const carFrontUrl = await uploadImage(files.carFront, `drivers/${uid}/car_front.jpg`);

      // 2. تحديث Firestore
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

      onComplete();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء الرفع، حاول مرة أخرى");
    } finally {
      setUploading(false);
    }
  };

  // عرض حالة الانتظار إذا كان قد أرسل مسبقاً
  if (step === VERIFICATION_STEPS.length) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#1a1d27", borderRadius: 24, padding: 32, textAlign: "center", maxWidth: 340, width: "100%", border: "1px solid #2a2d3e" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#fff", marginBottom: 8 }}>طلبك قيد المراجعة</div>
          <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            تم إرسال بياناتك للأدمن للمراجعة.<br/>
            سيتم إشعارك فور الموافقة.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'Cairo',sans-serif", direction: "rtl", padding: "48px 20px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛡️</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: "#fff" }}>توثيق الحساب</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>خطوة {step + 1} من {VERIFICATION_STEPS.length}</div>
      </div>

      {/* شريط التقدم */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {VERIFICATION_STEPS.map((s, i) => (
          <div key={s.id} style={{ 
            flex: 1, 
            height: 4, 
            borderRadius: 2, 
            background: i <= step ? "#f97316" : "#2a2d3e",
            transition: "all 0.3s"
          }} />
        ))}
      </div>

      <div style={{ background: "#1a1d27", borderRadius: 24, padding: 24, border: "1px solid #2a2d3e" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{currentStep.icon}</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>{currentStep.label}</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>{currentStep.desc}</div>
        </div>

        {/* حقل رفع الصورة */}
        {(currentStep.id === "selfie" || currentStep.id === "carFront") && (
          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e, currentStep.id === "selfie" ? "selfie" : "carFront")}
              style={{ display: "none" }}
            />
            
            {previews[currentStep.id === "selfie" ? "selfie" : "carFront"] ? (
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
                <img 
                  src={previews[currentStep.id === "selfie" ? "selfie" : "carFront"]} 
                  alt="معاينة" 
                  style={{ width: "100%", height: 200, objectFit: "cover" }}
                />
                <button
                  onClick={() => {
                    setPreviews(prev => ({ ...prev, [currentStep.id === "selfie" ? "selfie" : "carFront"]: null }));
                    setFiles(prev => ({ ...prev, [currentStep.id === "selfie" ? "selfie" : "carFront"]: null }));
                  }}
                  style={{ position: "absolute", top: 8, left: 8, background: "#ef4444", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontFamily: "inherit", cursor: "pointer", fontSize: 12 }}
                >
                  🗑️ إعادة
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%", height: 160, borderRadius: 16, border: "2px dashed #3a3d4e", background: "#0f1117", color: "#94a3b8", fontFamily: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}
              >
                <span style={{ fontSize: 32 }}>📷</span>
                <span style={{ fontSize: 14 }}>اضغط لاختيار الصورة</span>
              </button>
            )}
          </div>
        )}

        {/* حقل رقم اللوحة */}
        {currentStep.id === "plate" && (
          <input
            value={plateNumber}
            onChange={e => setPlateNumber(e.target.value.toUpperCase())}
            placeholder="مثال: 213-01-DZ"
            style={{ width: "100%", background: "#0f1117", border: "1px solid #2a2d3e", borderRadius: 14, padding: "16px", fontFamily: "inherit", fontSize: 16, color: "#fff", outline: "none", textAlign: "center", marginBottom: 16, direction: "ltr" }}
          />
        )}

        {/* حقل موديل السيارة */}
        {currentStep.id === "carModel" && (
          <input
            value={carModel}
            onChange={e => setCarModel(e.target.value)}
            placeholder="مثال: رونو سيمبول 2021"
            style={{ width: "100%", background: "#0f1117", border: "1px solid #2a2d3e", borderRadius: 14, padding: "16px", fontFamily: "inherit", fontSize: 16, color: "#fff", outline: "none", textAlign: "right", marginBottom: 16 }}
          />
        )}

        {error && (
          <div style={{ background: "#ef444422", borderRadius: 12, padding: "12px", color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, background: "#2a2d3e", border: "none", borderRadius: 14, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}
            >
              السابق
            </button>
          )}
          
          {step < VERIFICATION_STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{ flex: 2, background: "linear-gradient(135deg,#f97316,#ea580c)", border: "none", borderRadius: 14, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}
            >
              التالي
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={uploading}
              style={{ flex: 2, background: uploading ? "#2a2d3e" : "linear-gradient(135deg,#00b37e,#007a55)", border: "none", borderRadius: 14, padding: 14, color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.7 : 1 }}
            >
              {uploading ? "⏳ جارٍ الرفع..." : "✅ إرسال للمراجعة"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
