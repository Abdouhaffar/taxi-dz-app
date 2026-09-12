/**
 * AL-BURAQ - Firebase Cloud Functions
 * (1) الإشعارات التلقائية لكل أحداث التطبيق (FCM)
 * (2) نظام OTP عبر Twilio Verify
 *
 * تثبيت:
 * npm install -g firebase-tools
 * firebase login
 * firebase init functions (اختر JavaScript)
 * ضع هذا الملف في مجلد functions/
 * firebase functions:secrets:set TWILIO_ACCOUNT_SID
 * firebase functions:secrets:set TWILIO_AUTH_TOKEN
 * firebase functions:secrets:set TWILIO_VERIFY_SERVICE_SID
 * firebase deploy --only functions
 */

const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const twilio = require("twilio");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================
// ============  تطبيع رقم الهاتف — مصدر الحقيقة الوحيد  =========
// ============================================================
// كل نقطة دخول (checkPhoneRegistered / sendOtpTwilio / verifyOtpTwilio) تمر عبر
// هذه الدالة قبل أي بحث/إنشاء في Firebase Auth. الهدف: مهما كتب المستخدم رقمه
// (بمسافات، بصفر بادئ، بـ 213 أو +213 أو 00213 في البداية...) يجب أن ينتج
// دائمًا نفس النص +213XXXXXXXXX — وإلا فسيُنشئ Firebase Auth حسابًا جديدًا
// مختلفًا لكل صياغة مختلفة، وهذا بالضبط ما كان يسبب تعدد الحسابات لنفس الرقم.
function normalizePhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(5);
  else if (digits.startsWith("213")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^\d{9}$/.test(digits)) return null; // رقم جزائري غير صحيح
  return `+213${digits}`;
}

// ============================================================
// ==================  1) نظام الإشعارات (FCM)  =================
// ============================================================

async function sendNotification(token, title, body, data = {}) {
  if (!token) return null;
  try {
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries({ ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" })
          .map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channel_id: "alburaq_channel",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          icon: "ic_notification",
          color: "#00b37e",
        },
      },
      webpush: {
        notification: {
          icon: "/logo192.png",
          badge: "/logo192.png",
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          actions: [
            { action: "open", title: "📱 فتح التطبيق" },
            { action: "dismiss", title: "✕ إغلاق" },
          ],
        },
        fcmOptions: { link: "https://alburaq-dz.vercel.app" },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
    };
    const response = await messaging.send(message);
    console.log(`✅ إشعار أُرسل: ${response}`);
    return response;
  } catch (e) {
    console.error(`❌ خطأ في الإشعار:`, e.message);
    return null;
  }
}

async function sendToMultiple(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;
  const promises = tokens.map(token => sendNotification(token, title, body, data));
  return Promise.allSettled(promises);
}

// ===== 1. إشعار السائق عند وجود طلب جديد =====
exports.onNewBooking = functions.firestore
  .document("bookings/{bookingId}")
  .onCreate(async (snap, context) => {
    const booking = snap.data();
    if (booking.status !== "pending") return null;

    const { bookingId } = context.params;
    const { originLat, originLng, price, distanceKm, passengers, luggageWeight } = booking;

    try {
      const driversSnap = await db.collection("drivers")
        .where("isOnline", "==", true)
        .where("verificationStatus", "==", "approved")
        .get();

      const nearbyTokens = [];
      driversSnap.forEach(doc => {
        const driver = doc.data();
        if (!driver.fcmToken || !driver.location) return;

        const R = 6371;
        const dLat = (driver.location.lat - originLat) * Math.PI / 180;
        const dLng = (driver.location.lng - originLng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(originLat*Math.PI/180) * Math.cos(driver.location.lat*Math.PI/180) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        if (dist <= 5) {
          nearbyTokens.push(driver.fcmToken);
        }
      });

      if (nearbyTokens.length === 0) {
        console.log("لا يوجد سائقون قريبون");
        return null;
      }

      const luggageLabel = luggageWeight === "less25" ? "أقل من 25كغ" :
                           luggageWeight === "25to40" ? "25-40كغ" : "أكثر من 40كغ";

      const title = "🚕 طلب جديد قريب منك!";
      const body = `💰 ${price} دج · 📏 ${distanceKm?.toFixed(1)} كم · 👥 ${passengers||1} راكب · 🧳 ${luggageLabel}`;

      await sendToMultiple(nearbyTokens, title, body, {
        type: "new_booking",
        bookingId,
        price: String(price),
        distanceKm: String(distanceKm),
        screen: "home",
      });

      console.log(`📬 إشعار أُرسل لـ ${nearbyTokens.length} سائق`);
    } catch (e) {
      console.error("خطأ في onNewBooking:", e);
    }
    return null;
  });

// ===== 2. إشعار الراكب عند قبول السائق =====
exports.onBookingAccepted = functions.firestore
  .document("bookings/{bookingId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { bookingId } = context.params;

    if (before.status !== "accepted" && after.status === "accepted") {
      try {
        const passengerSnap = await db.collection("passengers").doc(after.passengerId).get();
        const passenger = passengerSnap.data();
        if (!passenger?.fcmToken) return null;

        const driver = after.driverInfo;
        await sendNotification(
          passenger.fcmToken,
          "✅ تم قبول طلبك!",
          `🚕 ${driver?.name||"السائق"} في طريقه إليك · ${driver?.carBrand} ${driver?.carModel}`,
          { type: "booking_accepted", bookingId, screen: "app", driverName: driver?.name||"" }
        );
      } catch (e) { console.error("خطأ في onBookingAccepted:", e); }
    }

    if (before.status !== "arrived" && after.status === "arrived") {
      try {
        const passengerSnap = await db.collection("passengers").doc(after.passengerId).get();
        const passenger = passengerSnap.data();
        if (!passenger?.fcmToken) return null;

        await sendNotification(
          passenger.fcmToken,
          "🚕 السائق وصل!",
          "السائق بانتظارك عند نقطة الانطلاق",
          { type: "driver_arrived", bookingId, screen: "app" }
        );
      } catch (e) { console.error("خطأ في onDriverArrived:", e); }
    }

    if (before.status === "accepted" && after.status === "cancelled") {
      try {
        const passengerSnap = await db.collection("passengers").doc(after.passengerId).get();
        const passenger = passengerSnap.data();
        if (!passenger?.fcmToken) return null;

        await sendNotification(
          passenger.fcmToken,
          "❌ تم إلغاء الرحلة",
          "ألغى السائق رحلتك — ابحث عن سائق آخر",
          { type: "booking_cancelled", bookingId, screen: "app" }
        );
      } catch (e) { console.error("خطأ في onBookingCancelled:", e); }
    }

    if (before.status !== "completed" && after.status === "completed") {
      try {
        if (after.driverId) {
          const driverSnap = await db.collection("drivers").doc(after.driverId).get();
          const driver = driverSnap.data();
          if (driver?.fcmToken) {
            await sendNotification(
              driver.fcmToken,
              "🏁 انتهت الرحلة!",
              `💰 ربحت ${after.price} دج · ⭐ لا تنسَ تقييم الراكب`,
              { type: "trip_completed", bookingId, screen: "home" }
            );
          }
        }
      } catch (e) { console.error("خطأ في onTripCompleted:", e); }
    }

    return null;
  });

// ===== 3. إشعار الرسائل (Chat) =====
exports.onNewChatMessage = functions.firestore
  .document("chats/{bookingId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { bookingId } = context.params;

    try {
      const bookingSnap = await db.collection("bookings").doc(bookingId).get();
      if (!bookingSnap.exists) return null;
      const booking = bookingSnap.data();

      const senderId = message.senderId;
      let recipientToken = null;
      let recipientName = "";

      if (senderId === booking.passengerId) {
        const driverSnap = await db.collection("drivers").doc(booking.driverId).get();
        recipientToken = driverSnap.data()?.fcmToken;
        recipientName = booking.passengerName || "الراكب";
      } else {
        const passengerSnap = await db.collection("passengers").doc(booking.passengerId).get();
        recipientToken = passengerSnap.data()?.fcmToken;
        recipientName = booking.driverInfo?.name || "السائق";
      }

      if (!recipientToken) return null;

      await sendNotification(
        recipientToken,
        `💬 رسالة من ${message.senderName || recipientName}`,
        message.text?.substring(0, 100) || "رسالة جديدة",
        { type: "new_message", bookingId, screen: "chat" }
      );
    } catch (e) { console.error("خطأ في onNewChatMessage:", e); }

    return null;
  });

// ===== 4. إشعار التقييم =====
exports.onNewRating = functions.firestore
  .document("ratings/{ratingId}")
  .onCreate(async (snap, context) => {
    const rating = snap.data();
    if (rating.type !== "passenger_to_driver") return null;

    try {
      const driverSnap = await db.collection("drivers").doc(rating.driverId).get();
      const driver = driverSnap.data();
      if (!driver?.fcmToken) return null;

      const stars = "⭐".repeat(rating.rating);
      await sendNotification(
        driver.fcmToken,
        `${stars} تقييم جديد`,
        rating.comment ? `"${rating.comment.substring(0, 80)}"` : `حصلت على ${rating.rating}/5 نجوم`,
        { type: "new_rating", screen: "profile" }
      );
    } catch (e) { console.error("خطأ في onNewRating:", e); }

    return null;
  });

// ===== 5. إشعار قبول الاشتراك =====
exports.onSubscriptionApproved = functions.firestore
  .document("drivers/{driverId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.subscription?.status !== "active" && after.subscription?.status === "active") {
      try {
        if (!after.fcmToken) return null;
        await sendNotification(
          after.fcmToken,
          "✅ تم تفعيل اشتراكك!",
          `🎉 اشتراك ${after.subscription.planLabel} نشط الآن · ${after.subscription.duration} يوم`,
          { type: "subscription_activated", screen: "profile" }
        );
      } catch (e) { console.error("خطأ في onSubscriptionApproved:", e); }
    }

    if (before.verificationStatus !== "rejected" && after.verificationStatus === "rejected") {
      try {
        if (!after.fcmToken) return null;
        await sendNotification(
          after.fcmToken,
          "❌ تم رفض طلب التوثيق",
          after.rejectionReason ? `السبب: ${after.rejectionReason}` : "يرجى مراجعة بياناتك وإعادة التقديم",
          { type: "verification_rejected", screen: "profile" }
        );
      } catch (e) { console.error("خطأ في onVerificationRejected:", e); }
    }

    if (before.verificationStatus !== "approved" && after.verificationStatus === "approved") {
      try {
        if (!after.fcmToken) return null;
        await sendNotification(
          after.fcmToken,
          "✅ تم قبول توثيقك!",
          "🎉 مرحباً بك في AL-BURAQ — يمكنك الآن استقبال الطلبات",
          { type: "verification_approved", screen: "home" }
        );
      } catch (e) { console.error("خطأ في onVerificationApproved:", e); }
    }

    return null;
  });

// ===== 6. إشعار SOS للأدمن =====
exports.onSOSAlert = functions.firestore
  .document("sos_alerts/{alertId}")
  .onCreate(async (snap, context) => {
    const alert = snap.data();
    try {
      const adminSnap = await db.collection("admins").where("role", "==", "super").limit(1).get();
      if (adminSnap.empty) return null;

      const adminToken = adminSnap.docs[0].data()?.fcmToken;
      if (!adminToken) return null;

      await sendNotification(
        adminToken,
        "🆘 طلب مساعدة طارئ!",
        `${alert.passengerName || "راكب"} يحتاج مساعدة فورية`,
        { type: "sos_alert", screen: "admin", alertId: context.params.alertId }
      );
    } catch (e) { console.error("خطأ في onSOSAlert:", e); }
    return null;
  });

// ===== 7. إشعار تبليغ جديد للأدمن =====
exports.onNewReport = functions.firestore
  .document("reports/{reportId}")
  .onCreate(async (snap, context) => {
    const report = snap.data();
    try {
      const adminSnap = await db.collection("admins").where("role", "==", "super").limit(1).get();
      if (adminSnap.empty) return null;

      const adminToken = adminSnap.docs[0].data()?.fcmToken;
      if (!adminToken) return null;

      await sendNotification(
        adminToken,
        "🚨 تبليغ جديد",
        `بلاغ عن ${report.targetType === "driver" ? "سائق" : "راكب"}: ${report.targetName} — ${report.reason?.substring(0, 60)}`,
        { type: "new_report", screen: "admin" }
      );
    } catch (e) { console.error("خطأ في onNewReport:", e); }
    return null;
  });

// ============================================================
// ==================  2) نظام OTP (Twilio Verify)  =============
// ============================================================

const TWILIO_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SID = defineSecret("TWILIO_VERIFY_SERVICE_SID");

const OTP_REGION = "europe-west1"; // يطابق المنطقة في App.jsx (cloudFunctions)

// ===== تسجيل الدخول بكود الحساب (بدون OTP) =====
// يُصلح خللاً جوهرياً: تسجيل الدخول القديم كان يستخدم Firebase Anonymous Auth،
// الذي يمنح كل جلسة معرّفاً (uid) عشوائياً مختلفاً عن معرّف الحساب الحقيقي المسجَّل
// وقت التسجيل (المرتبط برقم الهاتف عبر verifyOtpTwilio) — فيبدو الحساب "جديداً"
// في كل تسجيل دخول رغم وجوده فعلاً. هذه الدالة تُسجّل الدخول بنفس المعرّف الحقيقي دائماً.
exports.loginWithPin = onCall(
  { region: OTP_REGION },
  async (request) => {
    const phone = normalizePhone(request.data?.phone);
    const pin = request.data?.pin;
    if (!phone || !pin) {
      throw new HttpsError("invalid-argument", "بيانات ناقصة");
    }
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByPhoneNumber(phone);
    } catch (e) {
      throw new HttpsError("not-found", "الرقم غير مسجل");
    }
    const uid = userRecord.uid;
    const [driverSnap, passengerSnap] = await Promise.all([
      admin.firestore().collection("drivers").doc(uid).get(),
      admin.firestore().collection("passengers").doc(uid).get(),
    ]);
    const driverData = driverSnap.exists ? driverSnap.data() : null;
    const passengerData = passengerSnap.exists ? passengerSnap.data() : null;
    const pinMatches = (driverData && driverData.pinCode === pin) || (passengerData && passengerData.pinCode === pin);
    if (!pinMatches) {
      throw new HttpsError("invalid-argument", "كود الحساب غير صحيح");
    }
    const customToken = await admin.auth().createCustomToken(uid);
    return {
      customToken, uid,
      hasDriver: !!driverData, hasPassenger: !!passengerData,
      driverName: driverData?.name || null, passengerName: passengerData?.name || null,
    };
  }
);

// ===== التحقق من وجود حساب مسبقاً بنفس الرقم (قبل إرسال أي SMS) =====
exports.checkPhoneRegistered = onCall(
  { region: OTP_REGION },
  async (request) => {
    const phone = normalizePhone(request.data?.phone);
    const { role } = request.data || {};
    if (!phone) {
      throw new HttpsError("invalid-argument", "رقم هاتف غير صحيح");
    }
    try {
      const userRecord = await admin.auth().getUserByPhoneNumber(phone);
      // نتحقق من الرقم في مجموعتي السائقين والركاب معًا، وليس فقط في الدور
      // الحالي — هذا هو الثغرة التي كانت تسمح بإنشاء أكثر من حساب لنفس الرقم
      const [driverSnap, passengerSnap] = await Promise.all([
        admin.firestore().collection("drivers").doc(userRecord.uid).get(),
        admin.firestore().collection("passengers").doc(userRecord.uid).get(),
      ]);
      const targetCol = role === "driver" ? "drivers" : "passengers";
      const existsInTarget = targetCol === "drivers" ? driverSnap.exists : passengerSnap.exists;
      const existsInOther = targetCol === "drivers" ? passengerSnap.exists : driverSnap.exists;
      return { exists: existsInTarget, existsAsOtherRole: existsInOther };
    } catch (e) {
      // ما كاينش حساب Firebase بهذا الرقم أصلاً → مؤكد جديد
      return { exists: false, existsAsOtherRole: false };
    }
  }
);

// ===== إرسال رمز التحقق (SMS أو WhatsApp) =====
exports.sendOtpTwilio = onCall(
  { region: OTP_REGION, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    const phone = normalizePhone(request.data?.phone);
    const channel = request.data?.channel === "whatsapp" ? "whatsapp" : "sms";
    if (!phone) {
      throw new HttpsError("invalid-argument", "رقم هاتف غير صحيح");
    }

    // تحقق من القفل المؤقت (5 محاولات خاطئة → قفل 24 ساعة)
    const attemptsRef = admin.firestore().collection("otp_attempts").doc(phone);
    const attemptsSnap = await attemptsRef.get();
    if (attemptsSnap.exists) {
      const d = attemptsSnap.data();
      if (d.lockedUntil && d.lockedUntil.toDate() > new Date()) {
        throw new HttpsError("resource-exhausted", "تم قفل حسابك مؤقتاً بسبب محاولات خاطئة متكررة");
      }
    }

    const client = twilio(TWILIO_SID.value(), TWILIO_TOKEN.value());
    try {
      await client.verify.v2
        .services(TWILIO_VERIFY_SID.value())
        .verifications.create({ to: phone, channel });
      return { success: true };
    } catch (e) {
      console.error("Twilio send error:", e);
      throw new HttpsError("internal", "فشل إرسال رمز التحقق");
    }
  }
);

// ===== التحقق من الرمز + إنشاء/تسجيل الدخول في Firebase =====
exports.verifyOtpTwilio = onCall(
  { region: OTP_REGION, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    const phone = normalizePhone(request.data?.phone);
    const code = request.data?.code;
    if (!phone || !code) {
      throw new HttpsError("invalid-argument", "بيانات ناقصة");
    }

    const attemptsRef = admin.firestore().collection("otp_attempts").doc(phone);
    const attemptsSnap = await attemptsRef.get();
    const attemptsData = attemptsSnap.exists ? attemptsSnap.data() : { failCount: 0, lockedUntil: null };

    if (attemptsData.lockedUntil && attemptsData.lockedUntil.toDate() > new Date()) {
      throw new HttpsError("resource-exhausted", "تم قفل حسابك مؤقتاً بسبب محاولات خاطئة متكررة");
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
      const newFailCount = (attemptsData.failCount || 0) + 1;
      const update = { failCount: newFailCount };
      if (newFailCount >= 5) {
        update.failCount = 0;
        update.lockedUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
        await attemptsRef.set(update, { merge: true });
        throw new HttpsError("resource-exhausted", "تم قفل حسابك مؤقتاً 24 ساعة بسبب محاولات خاطئة متكررة");
      }
      await attemptsRef.set(update, { merge: true });
      throw new HttpsError("invalid-argument", "رمز التحقق خاطئ أو منتهي الصلاحية");
    }

    // نجاح التحقق → تصفير عداد المحاولات
    await attemptsRef.set({ failCount: 0, lockedUntil: null }, { merge: true });

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
