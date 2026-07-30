import React, { useState, useEffect, useRef } from "react";
import { 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase"; // تأكد من مسار ملف firebase الخاص بك

// ==========================================
// AUTH FORM COMPONENT (كامل وجاهز للنسخ)
// ==========================================
export default function AuthForm({ role, onSuccess, onBack, lang, T, C }) {
  const t = T ? T[lang] : {};
  const isRTL = lang === "ar";
  const isPassenger = role === "passenger";
  
  // ألوان افتراضية حمايةً في حال عدم التمرير
  const accent = isPassenger ? (C?.green || "#10b981") : (C?.orange || "#f97316");
  const accentDark = isPassenger ? (C?.greenDark || "#047857") : "#ea580c";
  const bgCard = C?.card || "#ffffff";
  const bgMain = C?.bg || "#f8fafc";
  const textColor = C?.text || "#0f172a";
  const textMuted = C?.textMuted || "#64748b";
  const borderColor = C?.border || "#e2e8f0";

  // إدارات الحالة (States)
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [step, setStep] = useState("input"); // 'input' | 'otp' | 'name'
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const generateReferralCode = (uid) => `BRQ${uid.substring(0, 6).toUpperCase()}`;

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // 1. تسجيل الدخول لمستخدم مسجل سابقاً (هاتف + كلمة مرور)
  const handleLogin = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 9 || !password) {
      setError(lang === "ar" ? "يرجى إدخال رقم الهاتف وكلمة المرور" : "Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const dummyEmail = `${cleanPhone}@alburaq.app`;
      const userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
      
      const collectionName = isPassenger ? "passengers" : "drivers";
      const userSnap = await getDoc(doc(db, collectionName, userCred.user.uid));

      if (userSnap.exists()) {
        const fullPhone = `+213${cleanPhone.replace(/^0/, "")}`;
        localStorage.setItem("taxidz_phone", fullPhone);
        localStorage.setItem("taxidz_role", role);
        onSuccess(role);
      } else {
        setError(lang === "ar" ? "هذا الحساب غير مسجل بهذا الخيار" : "Compte introuvable dans ce rôle");
      }
    } catch (e) {
      console.error(e);
      setError(lang === "ar" ? "رقم الهاتف أو كلمة المرور غير صحيحة" : "Numéro ou mot de passe incorrect");
    }
    setLoading(false);
  };

  // 2. إرسال كود التحقق الثنائي (OTP) للحسابات الجديدة
  const sendOTP = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 9) {
      setError(lang === "ar" ? "أدخل رقم هاتف صحيح" : "Entrez un numéro valide");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (x) {}
        window.recaptchaVerifier = null;
      }
      
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => { window.recaptchaVerifier = null; },
      });

      const fullPhone = `+213${cleanPhone.replace(/^0/, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      setStep("otp");
      setResendTimer(60);
      setTimeout(() => otpRefs[0].current?.focus(), 300);
    } catch (e) {
      console.error("OTP Error:", e);
      setError(lang === "ar" ? "فشل إرسال رمز التحقق، حاول مجدداً" : "Erreur d'envoi du code");
    }
    setLoading(false);
  };

  // 3. تأكيد رمز OTP
  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError(lang === "ar" ? "أدخل الرمز كاملاً" : "Code incomplet");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await confirmResult.confirm(code);
      setStep("name"); // الانتقال لكتابة الاسم وتحديد كلمة المرور
    } catch (e) {
      console.error(e);
      setError(lang === "ar" ? "رمز التحقق خاطئ أو منتهي الصلاحية" : "Code incorrect ou expiré");
    }
    setLoading(false);
  };

  // 4. إتمام التسجيل الجديد
  const handleRegister = async () => {
    if (!name.trim() || password.length < 6) {
      setError(lang === "ar" ? "يرجى كتابة الاسم وكلمة مرور من 6 أرقام/أحرف على الأقل" : "Nom et mot de passe (min 6 caractères) requis");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const dummyEmail = `${cleanPhone}@alburaq.app`;
      const fullPhone = `+213${cleanPhone.replace(/^0/, "")}`;

      // إنشاء حساب بالبريد المشتق وكلمة المرور
      const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
      const u = userCred.user;

      await updateProfile(u, { displayName: name });
      const collectionName = isPassenger ? "passengers" : "drivers";
      
      await setDoc(doc(db, collectionName, u.uid), {
        uid: u.uid,
        name,
        phone: fullPhone,
        role: role,
        status: "active",
        createdAt: serverTimestamp(),
        referralCode: generateReferralCode(u.uid),
      });

      localStorage.setItem("taxidz_name", name);
      localStorage.setItem("taxidz_phone", fullPhone);
      localStorage.setItem("taxidz_role", role);
      onSuccess(role);
    } catch (e) {
      console.error(e);
      if (e.code === "auth/email-already-in-use") {
        setError(lang === "ar" ? "هذا الرقم مسجل بالفعل! حاول تسجيل الدخول" : "Ce numéro est déjà inscrit!");
      } else {
        setError(lang === "ar" ? "حدث خطأ أثناء إنشاء الحساب" : "Erreur d'enregistrement");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: bgMain, fontFamily: "Cairo, sans-serif", direction: isRTL ? "rtl" : "ltr" }}>
      <div id="recaptcha-container" style={{ position: "absolute", opacity: 0 }} />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", padding: "40px 24px 20px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 35, [isRTL ? "right" : "left"]: 20, width: 36, height: 36, borderRadius: 10, background: "#ffffff22", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
          {isPassenger ? (t?.passengerGate || "بوابة الركاب") : (t?.driverGate || "بوابة السائقين")}
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "450px", margin: "0 auto" }}>
        
        {/* التبديل بين تسجيل الدخول وتسجيل جديد */}
        {step === "input" && (
          <div style={{ display: "flex", background: borderColor, borderRadius: 16, padding: 4, marginBottom: 20 }}>
            <button
              onClick={() => { setAuthMode("login"); setError(""); }}
              style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: authMode === "login" ? "#fff" : "transparent", fontWeight: 800, color: authMode === "login" ? textColor : textMuted, cursor: "pointer" }}>
              🔑 {lang === "ar" ? "مسجل من قبل" : "Se connecter"}
            </button>
            <button
              onClick={() => { setAuthMode("register"); setError(""); }}
              style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: authMode === "register" ? accent : "transparent", fontWeight: 800, color: authMode === "register" ? "#fff" : textMuted, cursor: "pointer" }}>
              ✅ {lang === "ar" ? "تسجيل جديد" : "Créer un compte"}
            </button>
          </div>
        )}

        {/* 1️⃣ خطوة إدخال رقم الهاتف/كلمة المرور */}
        {step === "input" && (
          <div style={{ background: bgCard, borderRadius: 24, padding: 24, border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: textMuted, fontWeight: 600 }}>{lang === "ar" ? "رقم الهاتف" : "Numéro de téléphone"}</div>
            
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "14px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🇩🇿</span><span style={{ fontSize: 14, color: "#166534", fontWeight: 700 }}>+213</span>
              </div>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="0XXXXXXXXX" type="tel" maxLength={10} style={{ flex: 1, background: bgMain, border: `1px solid ${borderColor}`, borderRadius: 14, padding: "14px 16px", fontSize: 18, fontWeight: 700, outline: "none" }} />
            </div>

            {/* إذا كان الحساب مسجل من قبل */}
            {authMode === "login" && (
              <>
                <div style={{ fontSize: 13, color: textMuted, fontWeight: 600 }}>{lang === "ar" ? "كلمة المرور" : "Mot de passe"}</div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" style={{ background: bgMain, border: `1px solid ${borderColor}`, borderRadius: 14, padding: "14px 16px", fontSize: 16, outline: "none" }} />
              </>
            )}

            {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px", borderRadius: 12, fontSize: 13, textAlign: "center" }}>{error}</div>}

            <button
              onClick={authMode === "login" ? handleLogin : sendOTP}
              disabled={loading}
              style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", marginTop: 8 }}>
              {loading ? "جارٍ..." : authMode === "login" ? `🔑 ${lang === "ar" ? "تسجيل الدخول" : "Connexion"}` : `📨 ${lang === "ar" ? "إرسال كود التحقق الثنائي" : "Envoyer le code"}`}
            </button>
          </div>
        )}

        {/* 2️⃣ خطوة إدخال رمز التحقق (OTP) */}
        {step === "otp" && (
          <div style={{ background: bgCard, borderRadius: 24, padding: 24, border: `1px solid ${borderColor}`, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 14, color: textMuted, marginBottom: 16 }}>
              {lang === "ar" ? "أدخل رمز التحقق المرسل لـ" : "Code envoyé au"} <b>+213{phone}</b>
            </div>
            
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20, direction: "ltr" }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  value={digit}
                  onChange={(e) => {
                    const newOtp = [...otp];
                    newOtp[i] = e.target.value.slice(-1);
                    setOtp(newOtp);
                    if (e.target.value && i < 5) otpRefs[i + 1].current?.focus();
                  }}
                  maxLength={1}
                  style={{ width: 42, height: 50, textAlign: "center", fontSize: 20, fontWeight: 900, background: bgMain, border: `2px solid ${digit ? accent : borderColor}`, borderRadius: 12, outline: "none" }}
                />
              ))}
            </div>

            {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px", borderRadius: 12, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button
              onClick={verifyOTP}
              disabled={loading || otp.join("").length < 6}
              style={{ width: "100%", background: `linear-gradient(135deg, ${accent}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              {loading ? "جارٍ..." : `✅ ${lang === "ar" ? "تأكيد الرمز" : "Vérifier le code"}`}
            </button>
          </div>
        )}

        {/* 3️⃣ خطوة استكمال بيانات الحساب الجديد */}
        {step === "name" && (
          <div style={{ background: bgCard, borderRadius: 24, padding: 24, border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 36 }}>👤</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{lang === "ar" ? "إكمال الحساب الجديد" : "Finaliser l'inscription"}</div>
            </div>
            
            <div style={{ fontSize: 13, color: textMuted, fontWeight: 600 }}>{lang === "ar" ? "الاسم الكامل" : "Nom complet"}</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "ar" ? "أدخل اسمك" : "Nom complet"} style={{ background: bgMain, border: `1px solid ${borderColor}`, borderRadius: 14, padding: 14, outline: "none" }} />
            
            <div style={{ fontSize: 13, color: textMuted, fontWeight 600 }}>{lang === "ar" ? "أنشئ كلمة مرور" : "Créer un mot de passe"}</div>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" style={{ background: bgMain, border: `1px solid ${borderColor}`, borderRadius: 14, padding: 14, outline: "none" }} />
            
            {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px", borderRadius: 12, fontSize: 13, textAlign: "center" }}>{error}</div>}

            <button
              onClick={handleRegister}
              disabled={loading}
              style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", marginTop: 8 }}>
              {loading ? "جارٍ..." : `🚀 ${lang === "ar" ? "إنشاء الحساب الآن" : "Créer mon compte"}`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
