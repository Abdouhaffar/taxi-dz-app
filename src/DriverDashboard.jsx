import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const C = {
  bg: "#0f1117", card: "#1a1d27", border: "#2a2d3e",
  green: "#00b37e", greenLight: "#00b37e22", greenDark: "#007a55",
  orange: "#f97316", orangeDark: "#ea580c",
  red: "#ef4444", redLight: "#ef444422",
  blue: "#3b82f6", blueLight: "#3b82f615",
  yellow: "#f59e0b",
  text: "#ffffff", textMuted: "#94a3b8", textLight: "#64748b",
};

const PRICE_PER_KM = 30;
const MIN_PRICE = 100;
const calcPrice = (km) => Math.max(Math.round((km || 0) * PRICE_PER_KM), MIN_PRICE);

const MOCK_REQUESTS = [
  { id: 1, name: "أحمد سليم", phone: "+213550123456", from: "باب الزوار", to: "حيدرة", offer: 280, km: 9.3, avatar: "👨" },
  { id: 2, name: "نور الهدى", phone: "+213661234567", from: "القبة", to: "المطار", offer: 630, km: 21, avatar: "👩" },
];

const STEPS = [
  { id: "info", label: "معلوماتك", icon: "👤" },
  { id: "vehicle", label: "السيارة", icon: "🚗" },
  { id: "docs", label: "الوثائق", icon: "📄" },
];

// ===== 69 ولاية جزائرية كاملة =====
const WILAYAS = [
  "01 - أدرار", "02 - الشلف", "03 - الأغواط", "04 - أم البواقي",
  "05 - باتنة", "06 - بجاية", "07 - بسكرة", "08 - بشار",
  "09 - البليدة", "10 - البويرة", "11 - تمنراست", "12 - تبسة",
  "13 - تلمسان", "14 - تيارت", "15 - تيزي وزو", "16 - الجزائر",
  "17 - الجلفة", "18 - جيجل", "19 - سطيف", "20 - سعيدة",
  "21 - سكيكدة", "22 - سيدي بلعباس", "23 - عنابة", "24 - قالمة",
  "25 - قسنطينة", "26 - المدية", "27 - مستغانم", "28 - المسيلة",
  "29 - معسكر", "30 - ورقلة", "31 - وهران", "32 - البيض",
  "33 - إليزي", "34 - برج بوعريريج", "35 - بومرداس", "36 - الطارف",
  "37 - تندوف", "38 - تيسمسيلت", "39 - الوادي", "40 - خنشلة",
  "41 - سوق أهراس", "42 - تيبازة", "43 - ميلة", "44 - عين الدفلى",
  "45 - النعامة", "46 - عين تموشنت", "47 - غرداية", "48 - غليزان",
  "49 - تيميمون", "50 - برج باجي مختار", "51 - أولاد جلال",
  "52 - بني عباس", "53 - عين صالح", "54 - عين قزام",
  "55 - توقرت", "56 - جانت", "57 - المغير", "58 - المنيعة",
  "59 - بلعباس الجديدة", "60 - الونشريس", "61 - تاسيلي",
  "62 - السوقر", "63 - قصر الشلالة", "64 - الزيبان",
  "65 - تلغوت", "66 - الهقار", "67 - تيديكلت",
  "68 - عين بن خليل", "69 - الرشيد",
];

const CAR_BRANDS = [
  "RENAULT", "PEUGEOT", "TOYOTA", "HYUNDAI", "KIA", "VOLKSWAGEN",
  "DACIA", "FORD", "NISSAN", "MERCEDES", "BMW", "SUZUKI", "MITSUBISHI",
  "SEAT", "OPEL", "CITROEN", "FIAT", "HONDA", "MAZDA", "CHEVROLET",
  "SKODA", "AUDI", "JEEP", "LAND ROVER", "أخرى (أدخل يدوياً)",
];

const CAR_MODELS = {
  RENAULT: ["Clio", "Symbol", "Logan", "Megane", "Kangoo", "Fluence", "Captur"],
  PEUGEOT: ["206", "207", "208", "301", "308", "405", "406", "Partner", "Expert"],
  TOYOTA: ["Corolla", "Yaris", "Camry", "RAV4", "Land Cruiser", "Hilux"],
  HYUNDAI: ["i10", "i20", "i30", "Accent", "Elantra", "Tucson", "Santa Fe"],
  KIA: ["Picanto", "Rio", "Cerato", "Sportage", "Sorento", "Carnival"],
  VOLKSWAGEN: ["Golf", "Polo", "Passat", "Tiguan", "Jetta", "Caddy"],
  DACIA: ["Logan", "Sandero", "Duster", "Dokker", "Lodgy"],
  FORD: ["Fiesta", "Focus", "Fusion", "Mondeo", "Transit"],
  NISSAN: ["Micra", "Sunny", "Almera", "Tiida", "Qashqai", "Navara"],
  MERCEDES: ["C200", "E200", "A180", "Sprinter", "Vito"],
  BMW: ["316i", "318i", "320i", "520i", "X1", "X3"],
  SUZUKI: ["Alto", "Swift", "Vitara", "Jimny", "Baleno"],
  MITSUBISHI: ["Lancer", "Colt", "Galant", "Outlander", "L200"],
  SEAT: ["Ibiza", "Leon", "Altea", "Toledo"],
  OPEL: ["Corsa", "Astra", "Vectra", "Zafira"],
  CITROEN: ["C3", "C4", "C5", "Berlingo", "Jumper"],
  FIAT: ["Punto", "Bravo", "Tipo", "Doblo", "Ducato"],
  HONDA: ["Jazz", "Civic", "Accord", "CR-V"],
  MAZDA: ["Mazda2", "Mazda3", "Mazda6", "CX-5"],
  CHEVROLET: ["Aveo", "Cruze", "Captiva", "Spark"],
  SKODA: ["Fabia", "Octavia", "Superb", "Rapid"],
  AUDI: ["A3", "A4", "A6", "Q5"],
  JEEP: ["Wrangler", "Cherokee", "Compass", "Renegade"],
  "LAND ROVER": ["Discovery", "Defender", "Range Rover"],
  "أخرى (أدخل يدوياً)": [],
};

const YEARS = Array.from({ length: 30 }, (_, i) => String(2024 - i));
const COLORS = ["أبيض", "أسود", "رمادي", "فضي", "أحمر", "أزرق", "أخضر", "بيج", "بني", "برتقالي", "بنفسجي", "ذهبي", "أصفر"];

// ===== HOOK =====
function useDriverStatus(uid) {
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, "drivers", uid),
      snap => {
        if (snap.exists()) { const d = snap.data(); setStatus(d.verificationStatus || "none"); setData(d); }
        else { setStatus("none"); setData(null); }
        setLoading(false);
      },
      () => { setStatus("none"); setLoading(false); }
    );
    return () => unsub();
  }, [uid]);
  return { status, data, loading };
}

// ===== HELPERS =====
function SelectField({ label, value, onChange, options, placeholder, required = true }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>{label} {required && "*"}</div>
      <div style={{ position: "relative" }}>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontFamily: "inherit", fontSize: 14, color: value ? C.text : C.textLight, outline: "none", cursor: "pointer", appearance: "none", direction: "rtl" }}>
          <option value="" disabled>{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }}>▼</div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", dir = "rtl", required = true }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>{label} {required && "*"}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: dir, textAlign: dir === "ltr" ? "left" : "right" }} />
    </div>
  );
}

// ضغط الصورة إلى Base64
const compressToBase64 = (file, maxWidth = 800) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function PhotoUpload({ label, preview, onSelect, required = true }) {
  const inputRef = useRef(null);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: required ? C.orange : C.textLight, fontWeight: 600 }}>{required ? "إلزامي" : "اختياري"}</div>
      </div>
      <input type="file" accept="image/*" ref={inputRef} onChange={onSelect} style={{ display: "none" }} />
      {preview ? (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `2px solid ${C.green}` }}>
          <img src={preview} alt={label} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
          <button onClick={() => inputRef.current?.click()}
            style={{ position: "absolute", bottom: 8, left: 8, background: C.card, border: "none", borderRadius: 8, padding: "6px 12px", color: C.text, fontFamily: "inherit", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            🔄 تغيير
          </button>
          <div style={{ position: "absolute", top: 8, right: 8, background: C.green, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#fff", fontWeight: 700 }}>✅ محملة</div>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          style={{ height: 130, borderRadius: 12, border: `2px dashed ${C.border}`, background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 32 }}>📷</span>
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>اضغط لرفع الصورة</span>
          <span style={{ fontSize: 11, color: C.textLight }}>JPG, PNG — أقصى 5MB</span>
        </div>
      )}
    </div>
  );
}

// ===== DRIVER VERIFICATION =====
function DriverVerification({ uid, userEmail }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [gender, setGender] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [driverType, setDriverType] = useState("تاكسي");
  const [wilaya, setWilaya] = useState("");
  const [daira, setDaira] = useState("");
  const [hasLicense, setHasLicense] = useState(false);
  const [hasCar, setHasCar] = useState(false);

  // Step 2
  const [carYear, setCarYear] = useState("");
  const [carBrand, setCarBrand] = useState("");
  const [carBrandManual, setCarBrandManual] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carModelManual, setCarModelManual] = useState("");
  const [carColor, setCarColor] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [ownerConfirm, setOwnerConfirm] = useState("");

  const isManualBrand = carBrand === "أخرى (أدخل يدوياً)";
  const finalBrand = isManualBrand ? carBrandManual : carBrand;
  const isManualModel = isManualBrand || carModel === "أخرى";
  const finalModel = isManualModel ? carModelManual : carModel;

  // Step 3
  const [selfieB64, setSelfieB64] = useState(null);
  const [carFrontB64, setCarFrontB64] = useState(null);
  const [carSideB64, setCarSideB64] = useState(null);
  const [grayCardB64, setGrayCardB64] = useState(null);
  const [licenseB64, setLicenseB64] = useState(null);

  const handlePhoto = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("الصورة أكبر من 5MB"); return; }
    setError("");
    try { setter(await compressToBase64(file)); }
    catch { setError("خطأ في معالجة الصورة"); }
  };

  const validateStep = () => {
    if (step === 0) {
      if (!gender || !firstName || !lastName || !birthDate || !wilaya) {
        setError("يرجى إكمال جميع الحقول المطلوبة ⚠️"); return false;
      }
    }
    if (step === 1) {
      if (!carYear || !finalBrand || !finalModel || !carColor || !plateNumber || !ownerConfirm) {
        setError("يرجى إكمال جميع بيانات السيارة ⚠️"); return false;
      }
    }
    if (step === 2) {
      if (!selfieB64 || !carFrontB64 || !carSideB64 || !grayCardB64) {
        setError("يرجى رفع جميع الصور الإلزامية ⚠️"); return false;
      }
    }
    return true;
  };

  const nextStep = () => { if (validateStep()) { setError(""); setStep(s => s + 1); } };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true); setError("");
    try {
      // استخدام setDoc بدلاً من updateDoc لإنشاء الوثيقة إذا لم تكن موجودة
      await setDoc(doc(db, "drivers", uid), {
        uid,
        email: userEmail || "",
        verificationStatus: "pending",
        name: `${firstName} ${lastName}`,
        firstName, lastName, gender, birthDate,
        driverType, wilaya, daira,
        carYear, carBrand: finalBrand, carModel: finalModel, carColor,
        plateNumber: plateNumber.trim().toUpperCase(),
        ownerConfirm, hasLicense, hasCar,
        selfieUrl: selfieB64,
        carFrontUrl: carFrontB64,
        carSideUrl: carSideB64,
        grayCardUrl: grayCardB64,
        licenseUrl: licenseB64 || null,
        submittedAt: serverTimestamp(),
        rejectionReason: null,
        rating: null,
        role: "driver",
      }, { merge: true }); // merge: true يحفظ أو يحدث
    } catch (err) {
      console.log("Firestore error:", err);
      setError("خطأ أثناء الحفظ: " + (err.message || "حاول مرة أخرى"));
    }
    setSaving(false);
  };

  const modelOptions = carBrand && !isManualBrand
    ? [...(CAR_MODELS[carBrand] || []), "أخرى"]
    : [];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      {/* Header */}
      <div style={{ background: C.card, padding: "48px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>توثيق حساب السائق</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 16 }}>{STEPS[step].icon} {STEPS[step].label}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? C.orange : C.border, transition: "all 0.3s" }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>الخطوة {step + 1} من {STEPS.length}</div>
      </div>

      <div style={{ padding: "20px 20px 120px" }}>

        {/* STEP 1 */}
        {step === 0 && (
          <>
            <SelectField label="الجنس" value={gender} onChange={setGender} placeholder="اختر الجنس" options={["ذكر", "أنثى"]} />
            <InputField label="الاسم" value={firstName} onChange={setFirstName} placeholder="أدخل اسمك" />
            <InputField label="اللقب" value={lastName} onChange={setLastName} placeholder="أدخل لقبك" />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>تاريخ الميلاد *</div>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontFamily: "inherit", fontSize: 14, color: C.text, outline: "none", direction: "ltr" }} />
            </div>
            <SelectField label="نوع السائق" value={driverType} onChange={setDriverType} placeholder="اختر النوع" options={["تاكسي", "سيارة خاصة", "حافلة صغيرة"]} />
            <SelectField label="الولاية (69 ولاية)" value={wilaya} onChange={setWilaya} placeholder="اختر ولايتك" options={WILAYAS} />
            <InputField label="الدائرة / البلدية" value={daira} onChange={setDaira} placeholder="أدخل الدائرة أو البلدية" required={false} />
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              {[
                { label: "لديّ سيارة خاصة", value: hasCar, set: setHasCar },
                { label: "لديّ رخصة سياقة سارية (أكثر من سنتين)", value: hasLicense, set: setHasLicense },
              ].map((item, i) => (
                <div key={i} onClick={() => item.set(!item.value)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer", borderBottom: i === 0 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${item.value ? C.orange : C.border}`, background: item.value ? C.orange : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.value && <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <>
            <SelectField label="سنة الصنع" value={carYear} onChange={setCarYear} placeholder="اختر السنة" options={YEARS} />

            {/* الماركة */}
            <SelectField label="الماركة" value={carBrand} onChange={v => { setCarBrand(v); setCarModel(""); setCarModelManual(""); setCarBrandManual(""); }} placeholder="اختر الماركة" options={CAR_BRANDS} />
            {isManualBrand && (
              <InputField label="أدخل الماركة يدوياً" value={carBrandManual} onChange={setCarBrandManual} placeholder="مثال: LADA, SKODA..." dir="ltr" />
            )}

            {/* الموديل */}
            {!isManualBrand && carBrand && (
              <SelectField label="الموديل" value={carModel} onChange={setCarModel} placeholder="اختر الموديل" options={modelOptions} />
            )}
            {(isManualBrand || carModel === "أخرى") && (
              <InputField label="أدخل الموديل يدوياً" value={carModelManual} onChange={setCarModelManual} placeholder="مثال: 206 Plus, Logan MCV..." dir="ltr" />
            )}

            <SelectField label="اللون" value={carColor} onChange={setCarColor} placeholder="اختر اللون" options={COLORS} />

            {/* رقم اللوحة */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>رقم اللوحة *</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ background: C.greenLight, border: `1px solid ${C.green}44`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>🇩🇿 DZ</div>
                <input value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="213-01-DZ" maxLength={15}
                  style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 16px", fontFamily: "inherit", fontSize: 15, color: C.text, outline: "none", direction: "ltr", textAlign: "left", fontWeight: 700, letterSpacing: 1 }} />
              </div>
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>مثال: 213-01-DZ · 107-16-DZ · 00224-31-DZ</div>
            </div>

            <SelectField label="هل تملك إذن باستخدام السيارة؟" value={ownerConfirm} onChange={setOwnerConfirm} placeholder="اختر" options={["نعم، أنا المالك", "نعم، لديّ إذن المالك"]} />

            {/* ملخص السيارة */}
            {finalBrand && finalModel && carYear && carColor && (
              <div style={{ background: C.greenLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.green}44`, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 4 }}>✅ السيارة المختارة:</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{finalBrand} {finalModel} {carYear} · {carColor}</div>
                {plateNumber && <div style={{ fontSize: 12, color: C.textMuted, direction: "ltr", marginTop: 2 }}>🔢 {plateNumber}</div>}
              </div>
            )}
          </>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <>
            <div style={{ background: "#3b82f615", borderRadius: 12, padding: "10px 14px", marginBottom: 16, border: `1px solid ${C.blue}44` }}>
              <div style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>📌 تأكد من وضوح الصور وإضاءة جيدة قبل الرفع</div>
            </div>
            <PhotoUpload label="🤳 صورة شخصية (سيلفي)" preview={selfieB64} onSelect={e => handlePhoto(e, setSelfieB64)} required />
            <PhotoUpload label="🚗 صورة السيارة من الأمام" preview={carFrontB64} onSelect={e => handlePhoto(e, setCarFrontB64)} required />
            <PhotoUpload label="🚗 صورة السيارة من الجانب" preview={carSideB64} onSelect={e => handlePhoto(e, setCarSideB64)} required />
            <PhotoUpload label="📄 البطاقة الرمادية" preview={grayCardB64} onSelect={e => handlePhoto(e, setGrayCardB64)} required />
            <PhotoUpload label="🪪 رخصة السياقة" preview={licenseB64} onSelect={e => handlePhoto(e, setLicenseB64)} required={false} />
          </>
        )}

        {error && (
          <div style={{ background: C.redLight, borderRadius: 12, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 16, border: `1px solid ${C.red}44`, textAlign: "center" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {step > 0 && (
            <button onClick={() => { setStep(s => s - 1); setError(""); }}
              style={{ flex: 1, background: C.border, border: "none", borderRadius: 14, padding: "14px", color: C.text, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              ← السابق
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={nextStep}
              style={{ flex: 2, background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, border: "none", borderRadius: 14, padding: "14px", color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
              التالي →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              style={{ flex: 2, background: saving ? C.border : `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: "14px", color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: saving ? "default" : "pointer", fontSize: 15, opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving
                ? <><span style={{ width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 1s linear infinite" }} /> جارٍ الحفظ...</>
                : "✅ إرسال للمراجعة"}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ===== PENDING =====
function PendingView({ onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 24, padding: 40, textAlign: "center", maxWidth: 360, width: "100%", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>⏳</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 12 }}>طلبك قيد المراجعة</div>
        <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.8, marginBottom: 20 }}>
          تم إرسال بياناتك للأدمن.<br />سيتم إشعارك فور الموافقة.<br />
          <span style={{ color: C.orange, fontWeight: 700 }}>عادةً تستغرق المراجعة 24-48 ساعة</span>
        </div>
        <div style={{ background: C.greenLight, borderRadius: 12, padding: "12px 16px", border: `1px solid ${C.green}44`, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: C.green }}>✅ ستتمكن من استقبال الطلبات فور التوثيق</div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 20px", color: C.textMuted, fontFamily: "inherit", cursor: "pointer", fontSize: 13 }}>
          🚪 تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

// ===== REJECTED =====
function RejectedView({ data, onRetry }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 24, padding: 32, textAlign: "center", maxWidth: 360, width: "100%", border: `1px solid ${C.red}44` }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: C.red, marginBottom: 12 }}>تم رفض التوثيق</div>
        {data?.rejectionReason && (
          <div style={{ background: C.redLight, borderRadius: 12, padding: "14px", marginBottom: 20, textAlign: "right", border: `1px solid ${C.red}44` }}>
            <div style={{ fontSize: 12, color: C.red, marginBottom: 4, fontWeight: 700 }}>سبب الرفض:</div>
            <div style={{ fontSize: 14, color: C.text }}>{data.rejectionReason}</div>
          </div>
        )}
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.7 }}>
          يمكنك تصحيح البيانات وإعادة الإرسال.
        </div>
        <button onClick={onRetry}
          style={{ width: "100%", background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, border: "none", borderRadius: 14, padding: "14px", color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
          🔄 إعادة التوثيق
        </button>
      </div>
    </div>
  );
}

// ===== MAIN DASHBOARD =====
export default function DriverDashboard({ user, onLogout }) {
  const { status, data, loading } = useDriverStatus(user?.uid);
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState("home");
  const [reqs, setReqs] = useState(MOCK_REQUESTS);

  const handleRetry = async () => {
    try {
      await setDoc(doc(db, "drivers", user.uid), {
        verificationStatus: "none", submittedAt: null, rejectionReason: null,
      }, { merge: true });
    } catch (e) { console.log(e); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
        <div style={{ color: C.textMuted, fontSize: 14 }}>جارٍ التحقق من الحساب...</div>
      </div>
    </div>
  );

  if (status === "none") return <DriverVerification uid={user?.uid} userEmail={user?.email} />;
  if (status === "rejected") return <RejectedView data={data} onRetry={handleRetry} />;
  if (status === "pending") return <PendingView onLogout={onLogout} />;

  // APPROVED
  const stats = [
    { label: "أرباح اليوم", value: "4,550 دج", icon: "💰", color: C.green },
    { label: "رحلات اليوم", value: "3", icon: "🚕", color: C.blue },
    { label: "التقييم", value: "4.9 ⭐", icon: "🏆", color: C.yellow },
    { label: "معدل القبول", value: "94%", icon: "📊", color: C.orange },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: C.card, padding: "48px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `3px solid ${C.border}`, overflow: "hidden" }}>
              {data?.selfieUrl ? <img src={data.selfieUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👨‍✈️"}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{data?.name || user?.displayName || "سائق"}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>⭐ {data?.rating || "جديد"} · {data?.carBrand || ""} {data?.carModel || ""} {data?.carYear || ""}</div>
              {data?.plateNumber && <div style={{ fontSize: 11, color: C.textLight, direction: "ltr", display: "inline-block" }}>🔢 {data.plateNumber}</div>}
            </div>
          </div>
          <div onClick={() => setOnline(!online)} style={{ width: 56, height: 30, borderRadius: 15, background: online ? C.green : C.border, position: "relative", cursor: "pointer", transition: "all 0.3s" }}>
            <div style={{ position: "absolute", top: 3, right: online ? 3 : "auto", left: online ? "auto" : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "all 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
        {online && (
          <div style={{ background: C.greenLight, border: `1px solid ${C.green}44`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 2s infinite" }} />
            🟢 متصل — تلقّي الطلبات
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 100 }}>
        {tab === "home" && (
          <>
            <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {online && reqs.length > 0 && (
              <div style={{ padding: "16px 20px 0" }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 12 }}>🔔 طلبات جديدة ({reqs.length})</div>
                {reqs.map(r => (
                  <div key={r.id} style={{ background: C.card, borderRadius: 18, padding: 16, marginBottom: 10, border: `1px solid ${C.orange}44` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{r.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{r.from} ← {r.to} · {r.km} كم</div>
                          <div style={{ fontSize: 11, color: r.offer >= calcPrice(r.km) ? C.green : C.red, marginTop: 2 }}>
                            معيار: {calcPrice(r.km)} دج {r.offer >= calcPrice(r.km) ? "✅" : "⚠️"}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.orange }}>{r.offer} دج</div>
                      </div>
                    </div>
                    <a href={`tel:${r.phone}`} style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenLight, border: `1px solid ${C.green}44`, borderRadius: 12, padding: "12px 14px", marginBottom: 12, textDecoration: "none" }}>
                      <span style={{ fontSize: 22 }}>📞</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.textMuted }}>رقم هاتف الراكب</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: C.green, direction: "ltr" }}>{r.phone}</div>
                      </div>
                      <div style={{ background: C.green, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", fontWeight: 700 }}>☎️ اتصل الآن</div>
                    </a>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setReqs(p => p.filter(x => x.id !== r.id))} style={{ flex: 1, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px", color: C.red, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>❌ رفض</button>
                      <button onClick={() => setReqs(p => p.filter(x => x.id !== r.id))} style={{ flex: 2, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 10, padding: "12px", color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>✅ قبول {r.offer} دج</button>
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
                <button onClick={() => setOnline(true)} style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, border: "none", borderRadius: 14, padding: "14px 40px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>🟢 تفعيل الاتصال</button>
              </div>
            )}
          </>
        )}

        {tab === "profile" && (
          <div style={{ padding: "20px 20px 100px" }}>
            <div style={{ background: C.card, borderRadius: 20, padding: 28, border: `1px solid ${C.border}`, textAlign: "center", marginBottom: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${C.orange},${C.orangeDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px", border: `4px solid ${C.border}`, overflow: "hidden" }}>
                {data?.selfieUrl ? <img src={data.selfieUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👨‍✈️"}
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.text, marginBottom: 4 }}>{data?.name || "سائق"}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>{data?.email || user?.email}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>🚗 {data?.carBrand} {data?.carModel} {data?.carYear} · {data?.carColor}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>📍 {data?.wilaya}</div>
              {data?.plateNumber && <div style={{ fontSize: 13, color: C.textLight, direction: "ltr", marginBottom: 12 }}>🔢 {data.plateNumber}</div>}
              <div style={{ display: "inline-block", background: C.greenLight, color: C.green, padding: "6px 18px", borderRadius: 20, fontSize: 13, fontWeight: 800, border: `1px solid ${C.green}44` }}>✅ سائق معتمد</div>
            </div>
            <button onClick={onLogout} style={{ width: "100%", background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 16, padding: 16, color: C.red, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>🚪 تسجيل الخروج</button>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 20px", zIndex: 100 }}>
        {[{ id: "home", label: "الرئيسية", icon: "🏠" }, { id: "profile", label: "حسابي", icon: "👤" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0" }}>
            <div style={{ fontSize: 22, opacity: tab === t.id ? 1 : 0.4 }}>{t.icon}</div>
            <div style={{ fontSize: 10, color: tab === t.id ? C.green : C.textLight, fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</div>
          </button>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
