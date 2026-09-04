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

// ===== التحقق من وجود حساب مسبقاً بنفس الرقم (قبل إرسال أي SMS) =====
exports.checkPhoneRegistered = onCall(
  { region: OTP_REGION },
  async (request) => {
    const { phone, role } = request.data || {};
    if (!phone || !/^\+213\d{9}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "رقم هاتف غير صحيح");
    }
    const col = role === "driver" ? "drivers" : "passengers";
    try {
      const userRecord = await admin.auth().getUserByPhoneNumber(phone);
      const docSnap = await admin.firestore().collection(col).doc(userRecord.uid).get();
      return { exists: docSnap.exists };
    } catch (e) {
      // ما كاينش حساب Firebase بهذا الرقم أصلاً → مؤكد جديد
      return { exists: false };
    }
  }
);

// ===== إرسال رمز التحقق =====
exports.sendOtpTwilio = onCall(
  { region: OTP_REGION, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    const phone = request.data?.phone;
    if (!phone || !/^\+213\d{9}$/.test(phone)) {
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
  { region: OTP_REGION, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    const { phone, code } = request.data || {};
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
