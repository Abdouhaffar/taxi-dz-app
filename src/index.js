const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const twilio = require("twilio");

admin.initializeApp();

// ===== Secrets (تُضبط عبر: firebase functions:secrets:set NAME) =====
const TWILIO_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SID = defineSecret("TWILIO_VERIFY_SERVICE_SID");

const REGION = "europe-west1"; // نفس المنطقة المستعملة في App.jsx (cloudFunctions)

// ===== إرسال رمز التحقق =====
exports.sendOtpTwilio = onCall(
  { region: REGION, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    const phone = request.data?.phone;
    if (!phone || !/^\+213\d{9}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "رقم هاتف غير صحيح");
    }

    const client = twilio(TWILIO_SID.value(), TWILIO_TOKEN.value());
    try {
      await client.verify.v2
        .services(TWILIO_VERIFY_SID.value())
        .verifications.create({ to: phone, channel: "sms" });
      return { success: true };
    } catch (e) {
      console.error("Twilio send error:", e);
      throw new HttpsError("internal", "فشل إرسال رمز التحقق");
    }
  }
);

// ===== التحقق من الرمز + إنشاء/تسجيل الدخول في Firebase =====
exports.verifyOtpTwilio = onCall(
  { region: REGION, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    const { phone, code } = request.data || {};
    if (!phone || !code) {
      throw new HttpsError("invalid-argument", "بيانات ناقصة");
    }

    const client = twilio(TWILIO_SID.value(), TWILIO_TOKEN.value());
    let check;
    try {
      check = await client.verify.v2
        .services(TWILIO_VERIFY_SID.value())
        .verificationChecks.create({ to: phone, code });
    } catch (e) {
      console.error("Twilio verify error:", e);
      throw new HttpsError("internal", "فشل التحقق من الرمز");
    }

    if (check.status !== "approved") {
      throw new HttpsError("invalid-argument", "رمز التحقق خاطئ أو منتهي الصلاحية");
    }

    // نبحث عن مستخدم Firebase بهذا الرقم، أو ننشئ واحداً جديداً
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByPhoneNumber(phone);
    } catch (e) {
      userRecord = await admin.auth().createUser({ phoneNumber: phone });
    }

    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    return { customToken, uid: userRecord.uid };
  }
);
