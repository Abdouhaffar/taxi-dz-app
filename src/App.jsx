// ===== AUTH FORM (محدث لدعم التسجيل والولوج والموافقة الثنائية) =====
function AuthForm({ role, onSuccess, onBack, lang }) {
  const t = T[lang];
  const isRTL = lang === "ar";
  const isPassenger = role === "passenger";
  const accent = isPassenger ? C.green : C.orange;
  const accentDark = isPassenger ? C.greenDark : "#ea580c";

  // إدارات الحالة (States)
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [step, setStep] = useState("input"); // 'input' | 'otp' | 'name' | 'reset_pass'
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState("");
  const [referral, setReferral] = useState("");
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef()];

  const generateReferralCode = (uid) => `BRQ${uid.substring(0, 6).toUpperCase()}`;

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // إرسال كود التحقق الثنائي (OTP) عبر Firebase
  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
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

      const fullPhone = `+213${digits.replace(/^0/, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      setStep("otp");
      setResendTimer(60);
      setTimeout(() => otpRefs[0].current?.focus(), 300);
    } catch (e) {
      console.error("OTP Error:", e);
      setError(lang === "ar" ? "فشل إرسال رمز التحقق، يرجى المحاولة لاحقاً" : "Erreur d'envoi du code");
    }
    setLoading(false);
  };

  // معالجة تسجيل الدخول لمستخدم مسجل من قبل (هاتف + كلمة مرور)
  const handlePasswordLogin = async () => {
    if (!phone || !password) {
      setError(lang === "ar" ? "يرجى إدخال رقم الهاتف وكلمة المرور" : "Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // يمكنك استخدام Firebase Auth بالبريد المشتق من الهاتف أو الموثق المستقل
      const dummyEmail = `${phone.replace(/\D/g, "")}@alburaq.app`;
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const res = await signInWithEmailAndPassword(auth, dummyEmail, password);
      
      const targetCol = isPassenger ? "passengers" : "drivers";
      const userSnap = await getDoc(doc(db, targetCol, res.user.uid));

      if (userSnap.exists()) {
        localStorage.setItem("taxidz_phone", phone);
        localStorage.setItem("taxidz_role", role);
        onSuccess(role);
      } else {
        setError(lang === "ar" ? "الحساب غير موجود في هذا القسم" : "Compte introuvable dans ce rôle");
      }
    } catch (e) {
      setError(lang === "ar" ? "رقم الهاتف أو كلمة المرور غير صحيحة" : "Numéro ou mot de passe incorrect");
    }
    setLoading(false);
  };

  // تأكيد كود OTP للموافقة الثنائية
  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError(lang === "ar" ? "أدخل الرمز كاملاً" : "Code incomplet");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await confirmResult.confirm(code);
      const u = result.user;
      const phoneF = `+213${phone.replace(/\D/g, "").replace(/^0/, "")}`;

      // إذا كانت العملية لاستعادة كلمة المرور
      if (step === "reset_pass") {
        setStep("new_password_input");
        setLoading(false);
        return;
      }

      // إذا كان تسجيل جديد
      const pSnap = await getDoc(doc(db, "passengers", u.uid));
      const dSnap = await getDoc(doc(db, "drivers", u.uid));

      if (isPassenger ? pSnap.exists() : dSnap.exists()) {
        localStorage.setItem("taxidz_phone", phoneF);
        localStorage.setItem("taxidz_role", role);
        onSuccess(role);
      } else {
        setStep("name"); // الانقال لإدخال الاسم وتعيين كلمة المرور للحساب الجديد
      }
    } catch (e) {
      setError(lang === "ar" ? "رمز التحقق خاطئ أو منتهي الصلاحية" : "Code incorrect ou expiré");
    }
    setLoading(false);
  };

  // حفظ بيانات التسجيل الجديد
  const handleCompleteRegistration = async () => {
    if (!name.trim() || !password) {
      setError(lang === "ar" ? "يرجى إكمال جميع البيانات المطلوبة" : "Veuillez remplir les champs");
      return;
    }
    setLoading(true);
    try {
      const u = auth.currentUser;
      const phoneF = `+213${phone.replace(/\D/g, "").replace(/^0/, "")}`;
      
      // ربط كلمة المرور بالحساب
      const dummyEmail = `${phone.replace(/\D/g, "")}@alburaq.app`;
      const { EmailAuthProvider, linkWithCredential } = await import("firebase/auth");
      const credential = EmailAuthProvider.credential(dummyEmail, password);
      await linkWithCredential(u, credential);

      await updateProfile(u, { displayName: name });
      const collectionName = isPassenger ? "passengers" : "drivers";
      
      await setDoc(doc(db, collectionName, u.uid), {
        uid: u.uid,
        name,
        phone: phoneF,
        role: role,
        status: "active",
        createdAt: serverTimestamp(),
        referralCode: generateReferralCode(u.uid),
      });

      localStorage.setItem("taxidz_name", name);
      localStorage.setItem("taxidz_phone", phoneF);
      localStorage.setItem("taxidz_role", role);
      onSuccess(role);
    } catch (e) {
      setError(lang === "ar" ? "حدث خطأ أثناء إتمام الحساب" : "Erreur d'enregistrement");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Cairo,sans-serif", direction: isRTL ? "rtl" : "ltr" }}>
      <div id="recaptcha-container" style={{ position: "absolute", opacity: 0 }} />

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.dark}, #16213e)`, padding: "40px 24px 20px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 40, [isRTL ? "right" : "left"]: 20, width: 36, height: 36, borderRadius: 10, background: "#ffffff22", border: "none", color: "#fff", cursor: "pointer" }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{isPassenger ? t.passengerGate : t.driverGate}</div>
      </div>

      <div style={{ padding: "20px" }}>
        
        {/* التبديل بين تسجيل الدخول وتسجيل جديد */}
        {step === "input" && (
          <div style={{ display: "flex", background: C.border, borderRadius: 16, padding: 4, marginBottom: 20 }}>
            <button
              onClick={() => { setAuthMode("login"); setError(""); }}
              style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: authMode === "login" ? "#fff" : "transparent", fontWeight: 800, color: authMode === "login" ? C.text : C.textMuted, cursor: "pointer" }}>
              🔑 {lang === "ar" ? "مسجل من قبل" : "Se connecter"}
            </button>
            <button
              onClick={() => { setAuthMode("register"); setError(""); }}
              style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: authMode === "register" ? accent : "transparent", fontWeight: 800, color: authMode === "register" ? "#fff" : C.textMuted, cursor: "pointer" }}>
              ✅ {lang === "ar" ? "تسجيل جديد" : "Créer un compte"}
            </button>
          </div>
        )}

        {/* نموذج الإدخال الأساسي */}
        {step === "input" && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{lang === "ar" ? "رقم الهاتف" : "Numéro de téléphone"}</div>
            
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ background: C.greenLight, border: `1px solid ${C.green}44`, borderRadius: 14, padding: "14px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🇩🇿</span><span style={{ fontSize: 14, color: C.greenDark, fontWeight: 700 }}>+213</span>
              </div>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="0XXXXXXXXX" type="tel" maxLength={10} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 18, fontWeight: 700, outline: "none" }} />
            </div>

            {/* إذا كان المستخدم مسجل من قبل، نطلب الكود / كلمة المرور مباشرة */}
            {authMode === "login" && (
              <>
                <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{lang === "ar" ? "كلمة المرور / الكود" : "Mot de passe"}</div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", fontSize: 16, outline: "none" }} />
                
                {/* زر نسيت كلمة المرور بطلب الموافقة الثنائية */}
                <button
                  onClick={() => { setStep("reset_pass"); sendOTP(); }}
                  style={{ background: "none", border: "none", color: C.blue, fontSize: 13, cursor: "pointer", fontWeight: 700, textAlign: isRTL ? "right" : "left" }}>
                  🔐 {lang === "ar" ? "نسيت كلمة المرور؟ (استعادة عبر OTP)" : "Mot de passe oublié?"}
                </button>
              </>
            )}

            {error && <div style={{ background: C.redLight, color: C.red, padding: "10px", borderRadius: 12, fontSize: 13, textAlign: "center" }}>{error}</div>}

            <button
              onClick={authMode === "login" ? handlePasswordLogin : sendOTP}
              disabled={loading}
              style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              {loading ? "جارٍ..." : authMode === "login" ? `🔑 ${lang === "ar" ? "تسجيل الدخول" : "Connexion"}` : `📨 ${lang === "ar" ? "إرسال كود التحقق الثنائي" : "Envoyer le code"}`}
            </button>
          </div>
        )}

        {/* خطوة التحقق الثنائي (OTP) */}
        {(step === "otp" || step === "reset_pass") && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>
              {lang === "ar" ? "أدخل رمز التحقق المرسل لـ" : "Code envoyé au"} <b>+213{phone}</b>
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
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
                  style={{ width: 44, height: 54, textAlign: "center", fontSize: 22, fontWeight: 900, background: C.bg, border: `2px solid ${digit ? accent : C.border}`, borderRadius: 12, outline: "none" }}
                />
              ))}
            </div>

            {error && <div style={{ background: C.redLight, color: C.red, padding: "10px", borderRadius: 12, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button
              onClick={verifyOTP}
              disabled={loading || otp.join("").length < 6}
              style={{ width: "100%", background: `linear-gradient(135deg, ${accent}, ${accentDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              ✅ {lang === "ar" ? "تأكيد الموافقة الثنائية" : "Vérifier le code"}
            </button>
          </div>
        )}

        {/* خطوة إدخال بيانات التسجيل الجديد */}
        {step === "name" && (
          <div style={{ background: C.card, borderRadius: 24, padding: 24, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 40 }}>👤</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{lang === "ar" ? "إكمال الحساب الجديد" : "Finaliser l'inscription"}</div>
            </div>
            
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "ar" ? "الاسم الكامل" : "Nom complet"} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, outline: "none" }} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={lang === "ar" ? "أنشئ كلمة مرور" : "Créer un mot de passe"} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, outline: "none" }} />
            
            {error && <div style={{ background: C.redLight, color: C.red, padding: "10px", borderRadius: 12, fontSize: 13, textAlign: "center" }}>{error}</div>}

            <button
              onClick={handleCompleteRegistration}
              disabled={loading}
              style={{ background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 16, padding: 16, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              🚀 {lang === "ar" ? "إنشاء الحساب الآن" : "Créer mon compte"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
