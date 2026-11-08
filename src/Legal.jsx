/* eslint-disable */
// الصفحات القانونية (/privacy و /terms) + زر الدعم + شريط انقطاع الإنترنت
import { useState, useEffect } from "react";

// ضع بيانات الدعم الحقيقية في Vercel → Environment Variables (لا تُكتب في الكود)
const SUPPORT_PHONE = process.env.REACT_APP_SUPPORT_PHONE || "";   // مثال: 213555123456 (بدون + أو أصفار)
const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "";
const FONT = "'IBM Plex Sans Arabic',Cairo,system-ui,sans-serif";
const UPDATED = "2026-11-09";

const DOCS = {
  privacy: {
    ar: { title: "سياسة الخصوصية", sections: [
      ["من نحن", "AL-BURAQ (البراق) تطبيق لطلب سيارات الأجرة في الجزائر، يربط الركاب بالسائقين. هذه السياسة توضح ما نجمعه من بيانات وكيف نستعملها."],
      ["البيانات التي نجمعها", "• رقم الهاتف والاسم لإنشاء الحساب والتحقق عبر رسالة نصية.\n• الموقع الجغرافي: موقع الراكب لتحديد نقطة الانطلاق، وموقع السائق أثناء اتصاله بالتطبيق وأثناء الرحلة لعرضه للراكب.\n• بيانات الرحلات: نقاط الانطلاق والوجهة، السعر، الوقت، التقييمات والمحادثات.\n• صورة الملف الشخصي (اختيارية للراكب).\n• للسائق: صور الوثائق (البطاقة الرمادية، رخصة السياقة) وصور السيارة لأغراض التحقق والسلامة.\n• رمز الإشعارات الخاص بجهازك، ومعرّف الجهاز لضمان استعمال الحساب على هاتف واحد."],
      ["كيف نستعمل بياناتك", "لتشغيل الخدمة ومطابقتك مع سائق قريب، وعرض تتبع الرحلة، وإرسال الإشعارات، وحساب الأسعار والأرباح، ومنع الاحتيال وحماية سلامة المستخدمين، ومعالجة الشكاوى والبلاغات."],
      ["مشاركة الرحلة", "عند اختيارك مشاركة رحلتك مع جهة اتصال موثوقة، يُنشأ رابط تتبع مؤقت يعرض موقع الرحلة لمن يملك الرابط فقط. يمكنك إيقافه في أي وقت."],
      ["مع من نشاركها", "يرى السائق اسم الراكب وصورته ونقطة الانطلاق والوجهة، ويرى الراكب اسم السائق وصورته وسيارته ولوحة ترقيمها. نستعمل مزودي خدمات موثوقين: Google (الخرائط)، Firebase/Google Cloud (الاستضافة وقاعدة البيانات والإشعارات)، ومزود الرسائل النصية. لا نبيع بياناتك لأي طرف."],
      ["مدة الاحتفاظ", "نحتفظ ببيانات الحساب ما دام الحساب نشطاً، وبسجل الرحلات للمدة اللازمة للفواتير والشكاوى والسلامة. يمكنك طلب حذف حسابك وبياناتك، وسنحذفها ما لم يلزم القانون أو التحقيق في بلاغ بإبقائها."],
      ["حقوقك", "يحق لك الاطلاع على بياناتك وتصحيحها وطلب حذفها، وإيقاف إذن الموقع أو الإشعارات من إعدادات جهازك في أي وقت (مع تأثر بعض الخدمات)."],
      ["الأمان", "نستعمل اتصالاً مشفراً وقواعد وصول صارمة على قاعدة البيانات. لا يوجد نظام آمن بنسبة 100%، لكننا نعمل على حماية بياناتك باستمرار."],
      ["الأطفال", "التطبيق غير موجه لمن هم دون 18 سنة."],
      ["التواصل", "لأي طلب يخص بياناتك، تواصل معنا عبر زر الدعم داخل التطبيق."],
    ]},
    fr: { title: "Politique de confidentialité", sections: [
      ["Qui sommes-nous", "AL-BURAQ est une application de taxi en Algérie qui met en relation passagers et chauffeurs."],
      ["Données collectées", "Numéro de téléphone et nom ; localisation (passager pour le point de départ, chauffeur pendant la connexion et la course) ; données de course, évaluations et messages ; photo de profil (facultative) ; pour les chauffeurs : photos des documents et du véhicule ; jeton de notification et identifiant d'appareil (un seul appareil par compte)."],
      ["Utilisation", "Fournir le service, vous associer à un chauffeur proche, suivre la course, envoyer des notifications, calculer prix et gains, prévenir la fraude, assurer la sécurité et traiter les réclamations."],
      ["Partage", "Le chauffeur voit le nom, la photo et les adresses du passager ; le passager voit le nom, la photo, le véhicule et la plaque du chauffeur. Prestataires : Google (cartes), Firebase/Google Cloud, fournisseur SMS. Nous ne vendons pas vos données."],
      ["Conservation et droits", "Données conservées tant que le compte est actif et le temps nécessaire aux factures, réclamations et à la sécurité. Vous pouvez demander l'accès, la correction ou la suppression via le bouton Support."],
      ["Mineurs", "L'application n'est pas destinée aux moins de 18 ans."],
    ]},
    en: { title: "Privacy Policy", sections: [
      ["Who we are", "AL-BURAQ is a taxi app in Algeria connecting riders and drivers."],
      ["Data we collect", "Phone number and name; location (rider for pickup, driver while online and during trips); trip data, ratings and chat messages; optional profile photo; for drivers, photos of documents and vehicle; notification token and a device ID (one device per account)."],
      ["How we use it", "To run the service, match you with a nearby driver, show trip tracking, send notifications, calculate prices and earnings, prevent fraud, keep users safe and handle complaints."],
      ["Sharing", "Drivers see the rider's name, photo and addresses; riders see the driver's name, photo, car and plate. Providers: Google (maps), Firebase/Google Cloud, an SMS provider. We do not sell your data."],
      ["Retention & rights", "We keep data while your account is active and as long as needed for invoices, complaints and safety. You can request access, correction or deletion through the Support button."],
      ["Minors", "The app is not intended for people under 18."],
    ]},
  },
  terms: {
    ar: { title: "شروط الاستخدام", sections: [
      ["القبول", "باستعمالك AL-BURAQ فإنك توافق على هذه الشروط. إن لم توافق فلا تستعمل التطبيق."],
      ["دور التطبيق", "AL-BURAQ منصة تربط الركاب بسائقين مستقلين. السائقون مسؤولون عن سياراتهم ورخصهم وتأمينهم وسلوكهم أثناء الرحلة."],
      ["الحساب", "تُسجَّل بمعلومات صحيحة، وتحافظ على سرية دخولك. الحساب شخصي ويعمل على جهاز واحد في الوقت نفسه. لا يجوز استعمال حساب غيرك."],
      ["الأسعار والدفع", "يقترح التطبيق سعراً ويمكن للراكب عرض سعر آخر، ويقبل السائق أو يرفض. الدفع نقداً للسائق عند نهاية الرحلة ما لم يُذكر خلاف ذلك. تُطبَّق أكواد الخصم وفق شروطها."],
      ["رمز الركوب", "يعطي الراكب رمز التأكيد للسائق عند الصعود فقط، ولا يشاركه مع أحد قبل ذلك."],
      ["سلوك المستخدمين", "يُمنع: الإساءة والتحرش والعنف، نقل المواد الممنوعة، الإضرار بالسيارة، الاحتيال أو التلاعب بالأسعار والتقييمات، استعمال التطبيق لغرض غير قانوني."],
      ["الإلغاء", "يمكن إلغاء الطلب قبل بدء الرحلة. الإلغاء المتكرر أو عدم الحضور قد يؤدي إلى تنبيه أو إيقاف الحساب."],
      ["الإيقاف والحظر", "يحق للإدارة إيقاف الحساب مؤقتاً أو نهائياً عند مخالفة الشروط أو ورود شكاوى موثقة، ويُبلَّغ المستخدم بالسبب."],
      ["السلامة", "في الخطر استعمل زر الطوارئ SOS وتواصل مع الجهات المختصة. التطبيق لا يغني عن أرقام الطوارئ الرسمية."],
      ["حدود المسؤولية", "نبذل جهدنا لتوفير خدمة مستقرة، لكن لا نضمن توفر سائق في كل وقت أو خلوّ الخدمة من الأعطال. لا نتحمل مسؤولية أفعال السائقين أو الركاب خارج حدود القانون."],
      ["التعديل والقانون", "قد نحدّث هذه الشروط، واستمرارك في الاستعمال يعني قبولك. تخضع الشروط للقانون الجزائري."],
    ]},
    fr: { title: "Conditions d'utilisation", sections: [
      ["Acceptation", "En utilisant AL-BURAQ, vous acceptez ces conditions."],
      ["Rôle de l'application", "Plateforme de mise en relation avec des chauffeurs indépendants, responsables de leur véhicule, permis, assurance et comportement."],
      ["Compte", "Informations exactes, compte personnel, un seul appareil à la fois."],
      ["Prix et paiement", "Prix proposé, offre possible du passager, acceptation ou refus du chauffeur. Paiement en espèces en fin de course sauf indication contraire. Codes promo selon leurs conditions."],
      ["Code de course", "Le passager ne donne le code au chauffeur qu'à la montée."],
      ["Comportement", "Interdits : insultes, harcèlement, violence, objets illicites, dégradation, fraude, usage illégal."],
      ["Suspension", "L'administration peut suspendre ou bannir un compte en cas de violation ou de plaintes documentées."],
      ["Sécurité et responsabilité", "En cas de danger, utilisez le bouton SOS et les numéros d'urgence officiels. Service fourni sans garantie de disponibilité permanente. Droit algérien applicable."],
    ]},
    en: { title: "Terms of Use", sections: [
      ["Acceptance", "By using AL-BURAQ you agree to these terms."],
      ["Role of the app", "A platform connecting riders with independent drivers, who are responsible for their vehicle, license, insurance and conduct."],
      ["Account", "Provide accurate information; accounts are personal and work on one device at a time."],
      ["Pricing & payment", "A price is suggested; riders may offer another and drivers accept or decline. Payment is cash at the end of the ride unless stated otherwise. Promo codes follow their terms."],
      ["Ride code", "Riders give the confirmation code to the driver only when boarding."],
      ["Conduct", "Prohibited: abuse, harassment, violence, illegal items, damaging the car, fraud, unlawful use."],
      ["Suspension", "Administration may suspend or ban accounts for violations or documented complaints."],
      ["Safety & liability", "In danger use the SOS button and official emergency numbers. Service is provided without a guarantee of constant availability. Algerian law applies."],
    ]},
  },
};

export function LegalPage({ kind = "privacy" }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("taxidz_lang") || "ar"; } catch (e) { return "ar"; } });
  const d = (DOCS[kind] || DOCS.privacy)[lang] || DOCS[kind].ar;
  const rtl = lang === "ar";
  return (
    <div style={{ minHeight: "100vh", background: "#f6f6f7", fontFamily: FONT, direction: rtl ? "rtl" : "ltr" }}>
      <div style={{ background: "#1c1a1d", color: "#fff", padding: "calc(env(safe-area-inset-top,0px) + 18px) 20px 22px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#ff5a70", fontWeight: 800, letterSpacing: 2 }}>AL-BURAQ</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{d.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["ar", "fr", "en"].map((l) => <button key={l} onClick={() => { setLang(l); try { localStorage.setItem("taxidz_lang", l); } catch (e) {} }} style={{ background: lang === l ? "#c4001d" : "#ffffff22", color: "#fff", border: "none", borderRadius: 10, padding: "6px 10px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 60px" }}>
        <div style={{ fontSize: 12, color: "#8a7b80", marginBottom: 12 }}>{rtl ? "آخر تحديث" : "Updated"}: {UPDATED}</div>
        {d.sections.map(([h, b], i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 18, padding: "16px 18px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#1c1a1d", marginBottom: 6 }}>{i + 1}. {h}</div>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: "#3d3438", whiteSpace: "pre-line" }}>{b}</div>
          </div>
        ))}
        {(SUPPORT_EMAIL || SUPPORT_PHONE) && <div style={{ fontSize: 13, color: "#6b5a5f", textAlign: "center", marginTop: 10 }}>{SUPPORT_EMAIL}{SUPPORT_EMAIL && SUPPORT_PHONE ? " · " : ""}{SUPPORT_PHONE ? "+" + SUPPORT_PHONE : ""}</div>}
        <div style={{ textAlign: "center", marginTop: 18 }}><a href="/" style={{ color: "#c4001d", fontWeight: 800, textDecoration: "none" }}>← AL-BURAQ</a></div>
      </div>
    </div>
  );
}

export function LegalLinks({ lang = "ar", dark = true }) {
  const L = { ar: ["سياسة الخصوصية", "شروط الاستخدام"], fr: ["Confidentialité", "Conditions"], en: ["Privacy", "Terms"] }[lang] || [];
  const st = { color: dark ? "#ffffff99" : "#7a6268", fontSize: 11, textDecoration: "underline" };
  return <div style={{ display: "flex", gap: 14, justifyContent: "center", padding: "10px 0" }}><a href="/privacy" target="_blank" rel="noreferrer" style={st}>{L[0]}</a><a href="/terms" target="_blank" rel="noreferrer" style={st}>{L[1]}</a></div>;
}

// زر دعم عائم: واتساب إن ضُبط الرقم، وإلا بريد
export function SupportButton({ lang = "ar", context = "" }) {
  if (!SUPPORT_PHONE && !SUPPORT_EMAIL) return null;
  const msg = encodeURIComponent((lang === "ar" ? "مرحباً، أحتاج مساعدة في AL-BURAQ" : "Hello, I need help with AL-BURAQ") + (context ? ` (${context})` : ""));
  const href = SUPPORT_PHONE ? `https://wa.me/${SUPPORT_PHONE}?text=${msg}` : `mailto:${SUPPORT_EMAIL}?subject=${msg}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label="support" style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom,0px) + 14px)", left: 14, zIndex: 40, width: 44, height: 44, borderRadius: "50%", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,.28)", textDecoration: "none", fontSize: 22 }}>💬</a>
  );
}

export function OfflineBanner({ lang = "ar" }) {
  const [off, setOff] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const a = () => setOff(true), b = () => setOff(false);
    window.addEventListener("offline", a); window.addEventListener("online", b);
    return () => { window.removeEventListener("offline", a); window.removeEventListener("online", b); };
  }, []);
  if (!off) return null;
  const t = { ar: "لا يوجد اتصال بالإنترنت — سيعود التطبيق للعمل تلقائياً", fr: "Pas de connexion Internet — reprise automatique", en: "No internet connection — will resume automatically" }[lang] || "";
  return <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99995, background: "#1c1a1d", color: "#fff", textAlign: "center", fontSize: 12.5, fontWeight: 700, padding: "calc(env(safe-area-inset-top,0px) + 8px) 12px 8px", fontFamily: FONT }}>📡 {t}</div>;
}
