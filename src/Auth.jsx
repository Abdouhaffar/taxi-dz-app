import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

const C = {
  bg: "#f7f3ee",
  card: "#ffffff",
  dark: "#1a1a2e",
  green: "#00b37e",
  greenLight: "#e6f9f3",
  greenDark: "#007a55",
  orange: "#f97316",
  orangeLight: "#fff4ed",
  red: "#ef4444",
  redLight: "#fef2f2",
  text: "#1a1a2e",
  textMuted: "#64748b",
  border: "#e8e3db",
  shadow: "0 4px 24px rgba(0,0,0,0.08)",
};

// ===== WELCOME SCREEN =====
function WelcomeScreen({ onSelectRole }) {
  return (
    <div style={{ minHeight: "100vh", background: C.dark, fontFamily: "'Cairo', sans-serif", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');`}</style>

      <div style={{ fontSize: 72, marginBottom: 16 }}>🚕</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>TaxiDZ</div>
      <div style={{ fontSize: 15, color: "#ffffff88", marginBottom: 48 }}>تاكسي الجزائر — فاوض على سعرك</div>

      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", color: "#ffffff66", fontSize: 13, marginBottom: 4 }}>أنا...</div>

        <button onClick={() => onSelectRole("passenger")} style={{ background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, boxShadow: `0 8px 24px ${C.green}44` }}>
          <div style={{ fontSize: 40 }}>🧑</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>راكب</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>أبحث عن سيارة أجرة</div>
          </div>
        </button>

        <button onClick={() => onSelectRole("driver")} style={{ background: `linear-gradient(135deg, ${C.orange}, #ea580c)`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, boxShadow: `0 8px 24px ${C.orange}44` }}>
          <div style={{ fontSize: 40 }}>👨‍✈️</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>سائق</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>أقدم خدمة النقل</div>
          </div>
        </button>
      </div>

      <div style={{ marginTop: 32, fontSize: 12, color: "#ffffff44" }}>🇩🇿 صُنع في الجزائر</div>
    </div>
  );
}

// ===== AUTH FORM =====
function AuthForm({ role, onSuccess, onBack }) {
  const [mode, setMode] = useState("login"); // login | register | phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("input"); // input | otp
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);

  const isDriver = role === "driver";
  const accentColor = isDriver ? C.orange : C.green;
  const accentDark = isDriver ? "#ea580c" : C.greenDark;

  const handleEmailAuth = async () => {
    if (!email || !password) { setError("الرجاء إدخال البريد وكلمة المرور"); return; }
    setLoading(true); setError("");
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess({ email, name, role });
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "البريد مستخدم مسبقاً",
        "auth/wrong-password": "كلمة المرور خاطئة",
        "auth/user-not-found": "المستخدم غير موجود",
        "auth/weak-password": "كلمة المرور قصيرة جداً (6 أحرف على الأقل)",
        "auth/invalid-email": "البريد الإلكتروني غير صحيح",
      };
      setError(msgs[e.code] || "حدث خطأ، حاول مرة أخرى");
    }
    setLoading(false);
  };

  const handleSendOTP = async () => {
    if (!phone) { setError("الرجاء إدخال رقم الهاتف"); return; }
    setLoading(true); setError("");
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      const fullPhone = phone.startsWith("+") ? phone : `+213${phone.replace(/^0/, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      setStep("otp");
    } catch (e) {
      setError("خطأ في إرسال الرمز — تأكد من رقم الهاتف");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp) { setError("الرجاء إدخال رمز التحقق"); return; }
    setLoading(true); setError("");
    try {
      await confirmResult.confirm(otp);
      onSuccess({ phone, name, role });
    } catch (e) {
      setError("رمز التحقق خاطئ");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo', sans-serif", direction: "rtl", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: C.dark, padding: "48px 24px 32px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 48, right: 20, width: 36, height: 36, borderRadius: 10, background: "#ffffff22", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>←</button>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{isDriver ? "👨‍✈️" : "🧑"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{isDriver ? "بوابة السائق" : "بوابة الراكب"}</div>
        <div style={{ fontSize: 13, color: "#ffffff77", marginTop: 4 }}>{mode === "register" ? "إنشاء حساب جديد" : "تسجيل الدخول"}</div>
      </div>

      <div style={{ flex: 1, padding: "24px 20px" }}>
        {/* Mode Tabs */}
        <div style={{ background: "#e2ddd8", borderRadius: 14, padding: 4, display: "flex", marginBottom: 20 }}>
          {[{ id: "login", label: "دخول" }, { id: "register", label: "حساب جديد" }, { id: "phone", label: "📱 هاتف" }].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setError(""); setStep("input"); }} style={{ flex: 1, padding: "10px 4px", borderRadius: 11, border: "none", background: mode === m.id ? C.card : "transparent", color: mode === m.id ? C.text : C.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, transition: "all 0.2s", boxShadow: mode === m.id ? C.shadow : "none" }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow }}>
          {/* Email/Password Mode */}
          {(mode === "login" || mode === "register") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mode === "register" && (
                <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "rtl", textAlign: "right" }} />
              )}
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />

              {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}

              <button onClick={handleEmailAuth} disabled={loading} style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                {loading ? "جارٍ التحميل..." : mode === "register" ? "✅ إنشاء الحساب" : "🔑 تسجيل الدخول"}
              </button>
            </div>
          )}

          {/* Phone Mode */}
          {mode === "phone" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {step === "input" ? (
                <>
                  {mode === "phone" && (
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "rtl", textAlign: "right" }} />
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 12px", fontSize: 14, color: C.textMuted, whiteSpace: "nowrap" }}>🇩🇿 +213</div>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xxxxxxxxx" type="tel" style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr", textAlign: "left" }} />
                  </div>
                  <div id="recaptcha-container" />
                  {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
                  <button onClick={handleSendOTP} disabled={loading} style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "جارٍ الإرسال..." : "📱 إرسال رمز التحقق"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 40 }}>📲</div>
                    <div style={{ fontWeight: 700, color: C.text, marginTop: 8 }}>أدخل رمز التحقق</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>تم إرسال رمز SMS إلى {phone}</div>
                  </div>
                  <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="- - - - - -" maxLength={6} style={{ background: C.bg, border: `2px solid ${accentColor}`, borderRadius: 14, padding: "16px", fontFamily: "inherit", fontSize: 24, color: C.text, outline: "none", textAlign: "center", letterSpacing: 12, fontWeight: 800 }} />
                  {error && <div style={{ background: C.redLight, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>}
                  <button onClick={handleVerifyOTP} disabled={loading} style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                    {loading ? "جارٍ التحقق..." : "✅ تأكيد الرمز"}
                  </button>
                  <button onClick={() => setStep("input")} style={{ background: "none", border: "none", color: C.textMuted, fontFamily: "inherit", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
                    إعادة إرسال الرمز
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Driver extra info */}
        {isDriver && (
          <div style={{ marginTop: 16, background: C.orangeLight, borderRadius: 16, padding: "14px 18px", border: `1px solid ${C.orange}33` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.orange, marginBottom: 6 }}>⚠️ للسائقين فقط</div>
            <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
              بعد التسجيل ستحتاج إلى تقديم: رخصة السياقة، بطاقة التعريف، وثيقة السيارة. سيتم مراجعة طلبك خلال 24 ساعة.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { WelcomeScreen, AuthForm
