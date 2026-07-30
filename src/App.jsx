function AuthForm({ role, onSuccess, onBack, lang }) {
  const t = T[lang];
  const isRTL = lang === "ar";
  const isPassenger = role === "passenger";
  const accent = isPassenger ? C.green : C.orange;
  const accentDark = isPassenger ? C.greenDark : "#ea580c";

  // ===== الحالات =====
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("form"); // "form" | "otp" | "name"

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const generateReferralCode = (uid) => `BRQ${uid.substring(0, 6).toUpperCase()}`;

  // ===== عداد إعادة الإرسال =====
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  // ===== إرسال OTP =====
  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError(lang === "ar" ? "أدخل رقم هاتفك" : "Entrez votre numéro");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // تنظيف reCAPTCHA السابق
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (x) { }
        window.recaptchaVerifier = null;
      }
      const container = document.getElementById("recaptcha-container");
      if (container) container.innerHTML = "";

      await new Promise((r) => setTimeout(r, 200));

      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => { },
        "expired-callback": () => { window.recaptchaVerifier = null; },
      });

      const fullPhone = `+213${digits.replace(/^0/, "")}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmResult(result);
      setStep("otp");
      setResendTimer(60);
      setTimeout(() => otpRefs[0].current?.focus(), 300);
    } catch (e) {
      console.log("OTP Error:", e.code, e.message);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (x) { }
        window.recaptchaVerifier = null;
      }

      const msgs = {
        "auth/invalid-phone-number": lang === "ar" ? "رقم الهاتف غير صحيح" : "Numéro invalide",
        "auth/too-many-requests": lang === "ar" ? "محاولات كثيرة — انتظر قليلاً" : "Trop de tentatives",
        "auth/captcha-check-failed": lang === "ar" ? "أعد تحميل الصفحة وحاول مرة أخرى" : "Rechargez et réessayez",
        "auth/quota-exceeded": lang === "ar" ? "تجاوز الحد اليومي" : "Quota dépassé",
        "auth/network-request-failed": lang === "ar" ? "تحقق من اتصالك" : "Vérifiez votre connexion",
        "auth/internal-error-encountered": lang === "ar" ? "خطأ داخلي — أعد المحاولة" : "Erreur interne",
      };
      setError(msgs[e.code] || (lang === "ar" ? `خطأ: ${e.code || e.message || 'غير معروف'}` : `Erreur: ${e.code || e.message || 'inconnue'}`));
    }
    setLoading(false);
  };

  // ===== تغيير OTP =====
  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val.slice(-1);
    setOtp(newOtp);
    if (val && i < 5) otpRefs[i + 1].current?.focus();
    if (!val && i > 0) otpRefs[i - 1].current?.focus();
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(""));
      otpRefs[5].current?.focus();
    }
  };

  // ===== التحقق من OTP =====
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

      const pSnap = await getDoc(doc(db, "passengers", u.uid));
      const dSnap = await getDoc(doc(db, "drivers", u.uid));
      const hasPassenger = pSnap.exists();
      const hasDriver = dSnap.exists();

      // ===== وضع "نسيت كلمة المرور" =====
      if (mode === "forgot") {
        // في هذا النظام، "نسيت كلمة المرور" = إعادة التحقق بالهاتف
        // المستخدم دخل OTP بنجاح، نرجعه للتسجيل الدخول
        setMode("login");
        setStep("form");
        setOtp(["", "", "", "", "", ""]);
        setError(lang === "ar" ? "✅ تم التحقق! يمكنك الآن تسجيل الدخول" : "✅ Vérifié! Vous pouvez vous connecter");
        setLoading(false);
        return;
      }

      // ===== وضع "تسجيل الدخول" =====
      if (mode === "login") {
        if (isPassenger) {
          if (hasPassenger) {
            const d = pSnap.data();
            if (d.name) localStorage.setItem("taxidz_name", d.name);
            if (d.phone) localStorage.setItem("taxidz_phone", d.phone);
            localStorage.setItem("taxidz_role", "passenger");
            try {
              const fcmToken = await requestNotificationPermission();
              if (fcmToken) await setDoc(doc(db, "passengers", u.uid), { fcmToken }, { merge: true });
            } catch (e) { }
            onSuccess("passenger");
          } else if (hasDriver) {
            // سائق يدخل كراكب
            const d = dSnap.data();
            await setDoc(doc(db, "passengers", u.uid), {
              uid: u.uid, name: d.name || "", phone: phoneF, role: "passenger",
              status: "active", rating: 0, totalRatings: 0, totalRides: 0,
              points: 0, referralCode: generateReferralCode(u.uid), referralCount: 0,
              createdAt: serverTimestamp()
            });
            localStorage.setItem("taxidz_name", d.name || "");
            localStorage.setItem("taxidz_phone", phoneF);
            localStorage.setItem("taxidz_role", "passenger");
            onSuccess("passenger");
          } else {
            // مستخدم جديد حاول تسجيل الدخول بدون حساب
            setError(lang === "ar" ? "❌ ليس لديك حساب. أنشئ حساباً جديداً" : "❌ Pas de compte. Créez-en un");
            setStep("form");
            setOtp(["", "", "", "", "", ""]);
          }
        } else {
          // سائق يدخل
          if (hasDriver) {
            localStorage.setItem("taxidz_role", "driver");
            try {
              const fcmToken = await requestNotificationPermission();
              if (fcmToken) await setDoc(doc(db, "drivers", u.uid), { fcmToken }, { merge: true });
            } catch (e) { }
            onSuccess("driver");
          } else if (hasPassenger) {
            const d = pSnap.data();
            await setDoc(doc(db, "drivers", u.uid), {
              uid: u.uid, phone: phoneF, name: d.name || "", role: "driver",
              status: "pending", verificationStatus: "none",
              rating: 0, totalRatings: 0, totalRides: 0, points: 0,
              referralCode: generateReferralCode(u.uid), referralCount: 0,
              createdAt: serverTimestamp()
            });
            localStorage.setItem("taxidz_role", "driver");
            onSuccess("driver");
          } else {
            setError(lang === "ar" ? "❌ ليس لديك حساب سائق. أنشئ حساباً جديداً" : "❌ Pas de compte chauffeur");
            setStep("form");
            setOtp(["", "", "", "", "", ""]);
          }
        }
        setLoading(false);
        return;
      }

      // ===== وضع "حساب جديد" =====
      if (mode === "register") {
        if (isPassenger) {
          if (hasPassenger) {
            // حساب موجود بالفعل
            setError(lang === "ar" ? "❌ لديك حساب بالفعل! سجّل الدخول" : "❌ Compte existe déjà! Connectez-vous");
            setMode("login");
            setStep("form");
            setOtp(["", "", "", "", "", ""]);
            setLoading(false);
            return;
          }
          // راكب جديد — اطلب الاسم
          localStorage.setItem("taxidz_phone", phoneF);
          setStep("name");
        } else {
          // سائق جديد
          if (hasDriver) {
            setError(lang === "ar" ? "❌ لديك حساب سائق بالفعل!" : "❌ Compte chauffeur existe!");
            setMode("login");
            setStep("form");
            setOtp(["", "", "", "", "", ""]);
            setLoading(false);
            return;
          }
          await setDoc(doc(db, "drivers", u.uid), {
            uid: u.uid, phone: phoneF, role: "driver", status: "pending",
            verificationStatus: "none", rating: 0, totalRatings: 0, totalRides: 0,
            points: 0, referralCode: generateReferralCode(u.uid), referralCount: 0,
            createdAt: serverTimestamp()
          });
          localStorage.setItem("taxidz_role", "driver");
          onSuccess("driver");
        }
      }
    } catch (e) {
      console.log("Verify:", e.code);
      setError(lang === "ar" ? "رمز التحقق خاطئ أو منتهي الصلاحية" : "Code incorrect ou expiré");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
    setLoading(false);
  };

  // ===== حفظ الاسم (للتسجيل الجديد) =====
  const saveName = async () => {
    if (!name.trim()) {
      setError(lang === "ar" ? "أدخل اسمك" : "Entrez votre nom");
      return;
    }
    setLoading(true);
    try {
      const u = auth.currentUser;
      const phoneF = `+213${phone.replace(/\D/g, "").replace(/^0/, "")}`;
      await updateProfile(u, { displayName: name });
      const myCode = generateReferralCode(u.uid);
      await setDoc(doc(db, "passengers", u.uid), {
        uid: u.uid, name, phone: phoneF, role: "passenger", status: "active",
        rating: 0, totalRatings: 0, totalRides: 0, points: 0,
        referralCode: myCode, referralCount: 0, createdAt: serverTimestamp()
      });
      localStorage.setItem("taxidz_name", name);
      localStorage.setItem("taxidz_role", "passenger");
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) await setDoc(doc(db, "passengers", u.uid), { fcmToken }, { merge: true });
      } catch (e) { }
      onSuccess("passenger");
    } catch (e) {
      setError(lang === "ar" ? "خطأ في الحفظ" : "Erreur de sauvegarde");
    }
    setLoading(false);
  };

  // ===== إعادة الإرسال =====
  const resendOTP = () => {
    if (resendTimer > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setStep("form");
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (x) { }
      window.recaptchaVerifier = null;
    }
  };

  // ===== العودة للخلف =====
  const handleBack = () => {
    if (step === "otp") {
      setStep("form");
      setOtp(["", "", "", "", "", ""]);
      setError("");
    } else if (step === "name") {
      setStep("otp");
    } else {
      onBack();
    }
  };

  // ===== عناوين الوضع =====
  const getModeTitle = () => {
    if (mode === "login") return isPassenger ? t.login : t.login;
    if (mode === "register") return isPassenger ? t.register : t.register;
    return lang === "ar" ? "🔐 استعادة الحساب" : lang === "fr" ? "🔐 Récupération" : "🔐 Account Recovery";
  };

  const getModeSubtitle = () => {
    if (mode === "login") return lang === "ar" ? "أدخل رقم هاتفك لتسجيل الدخول" : "Entrez votre numéro pour vous connecter";
    if (mode === "register") return lang === "ar" ? "أنشئ حسابك الجديد برقم هاتفك" : "Créez votre compte avec votre numéro";
    return lang === "ar" ? "أدخل رقم هاتفك لاستعادة حسابك" : "Entrez votre numéro pour récupérer";
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Cairo,sans-serif", direction: isRTL ? "rtl" : "ltr" }}>
      <div id="recaptcha-container" style={{ position: "absolute", opacity: 0 }} />

      {/* ===== HEADER ===== */}
      <div style={{
        background: `linear-gradient(135deg,${C.dark},#16213e)`,
        padding: "48px 24px 28px",
        textAlign: "center",
        position: "relative",
        borderRadius: "0 0 28px 28px"
      }}>
        <button onClick={handleBack}
          style={{
            position: "absolute", top: 48,
            [isRTL ? "right" : "left"]: 20,
            width: 40, height: 40, borderRadius: 12,
            background: "#ffffff22", border: "none",
            color: "#fff", cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>←</button>

        {/* صورة المستخدم */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: `linear-gradient(135deg,${accent},${accentDark})`,
          margin: "0 auto 12px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, boxShadow: `0 8px 24px ${accent}44`
        }}>
          {isPassenger ? "🧑" : "👨‍✈️"}
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>
          {isPassenger ? t.passengerGate : t.driverGate}
        </div>
        <div style={{ fontSize: 12, color: "#ffffff66", marginTop: 4 }}>
          {getModeSubtitle()}
        </div>
      </div>

      <div style={{ padding: "24px 20px 40px" }}>

        {/* ===== أزرار التبديل ===== */}
        {step === "form" && (
          <div style={{
            display: "flex",
            gap: 10,
            marginBottom: 24,
            background: C.bg,
            borderRadius: 16,
            padding: 4,
            border: `1px solid ${C.border}`
          }}>
            <button
              onClick={() => { setMode("login"); setError(""); setPhone(""); }}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: "none",
                background: mode === "login" ? C.card : "transparent",
                color: mode === "login" ? C.text : C.textMuted,
                fontFamily: "inherit",
                fontWeight: mode === "login" ? 800 : 500,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: mode === "login" ? C.shadow : "none",
                transition: "all 0.2s"
              }}
            >
              🔑 {t.login}
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setPhone(""); }}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: "none",
                background: mode === "register" ? C.card : "transparent",
                color: mode === "register" ? C.text : C.textMuted,
                fontFamily: "inherit",
                fontWeight: mode === "register" ? 800 : 500,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: mode === "register" ? C.shadow : "none",
                transition: "all 0.2s"
              }}
            >
              ✅ {t.register}
            </button>
          </div>
        )}

        {/* ===== STEP: FORM (رقم الهاتف) ===== */}
        {step === "form" && (
          <div style={{
            background: C.card,
            borderRadius: 24,
            padding: 24,
            boxShadow: C.shadow,
            display: "flex",
            flexDirection: "column",
            gap: 14
          }}>

            {/* اسم المستخدم (فقط للتسجيل الجديد) */}
            {mode === "register" && (
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                  {lang === "ar" ? "الاسم الكامل" : "Nom complet"}
                </div>
                <div style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10
                }}>
                  <span style={{ fontSize: 18 }}>👤</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === "ar" ? "أدخل اسمك الكامل" : "Votre nom complet"}
                    style={{
                      flex: 1,
                      background: "none",
                      border: "none",
                      outline: "none",
                      fontFamily: "inherit",
                      fontSize: 16,
                      color: C.text
                    }}
                  />
                </div>
              </div>
            )}

            {/* رقم الهاتف */}
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                {lang === "ar" ? "رقم الهاتف الجزائري" : "Numéro algérien"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  background: accent + "15",
                  border: `1px solid ${accent}44`,
                  borderRadius: 14,
                  padding: "14px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap"
                }}>
                  <span style={{ fontSize: 18 }}>🇩🇿</span>
                  <span style={{ fontSize: 14, color: accent, fontWeight: 700 }}>+213</span>
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="0XXXXXXXXX"
                  type="tel"
                  maxLength={10}
                  autoFocus
                  style={{
                    flex: 1,
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    fontFamily: "inherit",
                    fontSize: 18,
                    color: C.text,
                    outline: "none",
                    direction: "ltr",
                    textAlign: "center",
                    fontWeight: 700,
                    letterSpacing: 2
                  }}
                />
              </div>
            </div>

            {/* خطأ */}
            {error && (
              <div style={{
                background: C.redLight,
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                color: C.red,
                textAlign: "center"
              }}>
                {error}
              </div>
            )}

            {/* زر الإرسال */}
            <button
              onClick={sendOTP}
              disabled={loading || phone.replace(/\D/g, "").length < 9}
              style={{
                background: phone.replace(/\D/g, "").length >= 9
                  ? `linear-gradient(135deg,${accent},${accentDark})`
                  : C.border,
                border: "none",
                borderRadius: 16,
                padding: 16,
                color: "#fff",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: 16,
                cursor: phone.replace(/\D/g, "").length >= 9 ? "pointer" : "default",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 18, height: 18,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 1s linear infinite"
                  }} />
                  {lang === "ar" ? "جارٍ الإرسال..." : "Envoi..."}
                </>
              ) : (
                <>📨 {lang === "ar" ? "إرسال رمز التحقق" : "Envoyer le code"}</>
              )}
            </button>

            {/* نسيت كلمة المرور */}
            <button
              onClick={() => { setMode("forgot"); setError(""); setPhone(""); }}
              style={{
                background: "none",
                border: "none",
                color: C.blue,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
                textAlign: "center",
                marginTop: 4
              }}
            >
              🔐 {lang === "ar" ? "نسيت كلمة المرور؟" : "Mot de passe oublié?"}
            </button>
          </div>
        )}

        {/* ===== STEP: OTP ===== */}
        {step === "otp" && (
          <div style={{
            background: C.card,
            borderRadius: 24,
            padding: 24,
            boxShadow: C.shadow
          }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {lang === "ar" ? "أُرسل رمز إلى" : "Code envoyé au"}{" "}
                <span style={{ color: C.text, fontWeight: 700, direction: "ltr", display: "inline-block" }}>
                  +213{phone.replace(/\D/g, "").replace(/^0/, "")}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }} onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digit && i > 0) otpRefs[i - 1].current?.focus();
                  }}
                  maxLength={1}
                  type="tel"
                  inputMode="numeric"
                  style={{
                    width: 46, height: 58,
                    textAlign: "center",
                    fontSize: 24,
                    fontWeight: 900,
                    fontFamily: "monospace",
                    background: digit ? `${accent}15` : C.bg,
                    border: `2px solid ${digit ? accent : C.border}`,
                    borderRadius: 14,
                    color: C.text,
                    outline: "none"
                  }}
                />
              ))}
            </div>

            {error && (
              <div style={{
                background: C.redLight,
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                color: C.red,
                textAlign: "center",
                marginBottom: 12
              }}>
                {error}
              </div>
            )}

            <button
              onClick={verifyOTP}
              disabled={loading || otp.join("").length < 6}
              style={{
                width: "100%",
                background: otp.join("").length === 6
                  ? `linear-gradient(135deg,${accent},${accentDark})`
                  : C.border,
                border: "none",
                borderRadius: 16,
                padding: 16,
                color: "#fff",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: 16,
                cursor: otp.join("").length === 6 ? "pointer" : "default",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 12
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 18, height: 18,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 1s linear infinite"
                  }} />
                  {lang === "ar" ? "جارٍ..." : "Vérification..."}
                </>
              ) : (
                <>✅ {lang === "ar" ? "تأكيد" : "Confirmer"}</>
              )}
            </button>

            <div style={{ textAlign: "center" }}>
              {resendTimer > 0 ? (
                <span style={{ fontSize: 13, color: C.textMuted }}>
                  {lang === "ar" ? "إعادة الإرسال بعد" : "Renvoi dans"}{" "}
                  <span style={{ color: accent, fontWeight: 700 }}>{resendTimer}ث</span>
                </span>
              ) : (
                <button
                  onClick={resendOTP}
                  style={{
                    background: "none",
                    border: "none",
                    color: accent,
                    fontFamily: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 700,
                    textDecoration: "underline"
                  }}
                >
                  🔄 {lang === "ar" ? "إعادة إرسال" : "Renvoyer"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== STEP: NAME (للتسجيل الجديد فقط) ===== */}
        {step === "name" && (
          <div style={{
            background: C.card,
            borderRadius: 24,
            padding: 24,
            boxShadow: C.shadow,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>
                {lang === "ar" ? "مرحباً بك! 🎉" : "Bienvenue! 🎉"}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                {lang === "ar" ? "أدخل اسمك لإكمال التسجيل" : "Entrez votre nom pour finaliser"}
              </div>
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === "ar" ? "اسمك الكامل" : "Votre nom complet"}
              autoFocus
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: "16px",
                fontFamily: "inherit",
                fontSize: 16,
                color: C.text,
                outline: "none",
                textAlign: isRTL ? "right" : "left"
              }}
            />

            {error && (
              <div style={{
                background: C.redLight,
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                color: C.red,
                textAlign: "center"
              }}>
                {error}
              </div>
            )}

            <button
              onClick={saveName}
              disabled={loading || !name.trim()}
              style={{
                background: name.trim()
                  ? `linear-gradient(135deg,${C.green},${C.greenDark})`
                  : C.border,
                border: "none",
                borderRadius: 16,
                padding: 16,
                color: "#fff",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: 16,
                cursor: name.trim() ? "pointer" : "default",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 18, height: 18,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 1s linear infinite"
                  }} />
                  {lang === "ar" ? "جارٍ..." : "..."}
                </>
              ) : (
                <>🚀 {lang === "ar" ? "ابدأ!" : "C'est parti!"}</>
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
