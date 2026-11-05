/**
 * AL-BURAQ - Firebase Cloud Functions
 * (1) الإشعارات التلقائية لكل أحداث التطبيق (FCM)
 * (2) نظام OTP عبر smssak
 *
 * تثبيت:
 * npm install -g firebase-tools
 * firebase login
 * firebase init functions (اختر JavaScript)
 * ضع هذا الملف في مجلد functions/
 * firebase functions:secrets:set SMSSAK_API_KEY
 * firebase functions:secrets:set SMSSAK_PROJECT_ID
 * firebase deploy --only functions
 */

const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

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

    // قفل يمنع الإرسال المزدوج — onCreate قد يُستدعى أكثر من مرة لنفس الحدث
    // (موثّق رسميًا في Firebase)، وهذا كان يسبب وصول نفس الإشعار مرتين للسائق.
    const bookingRef = db.collection("bookings").doc(bookingId);
    try {
      const alreadyNotified = await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(bookingRef);
        if (freshSnap.data()?.notifiedAt) return true; // أُرسل من قبل بالفعل
        tx.update(bookingRef, { notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
        return false;
      });
      if (alreadyNotified) {
        console.log(`⏭️ تم تجاهل استدعاء مكرر لنفس الطلب ${bookingId}`);
        return null;
      }
    } catch (e) {
      console.error("خطأ في قفل منع التكرار:", e);
    }

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
// ==================  3) نظام الإحالة بالنقاط  =================
// ============================================================
// كلما زاد عدد المدعوين زادت نقاط كل دعوة (يجب أن تطابق ReferralShare.jsx في الواجهة)
const REFERRAL_BONUSES = { 5: 50, 15: 150, 30: 400 };
const REFERRAL_WELCOME = 20;
function referralPerInvite(n) { return n >= 30 ? 60 : n >= 15 ? 50 : n >= 5 ? 40 : 30; }

async function processReferral(snap, collectionName) {
  const data = snap.data() || {};
  const code = String(data.referredBy || "").trim().toUpperCase();
  if (!code || data.referralRewarded) return null;

  // ابحث عن صاحب الكود في الركاب ثم السائقين
  let refDoc = null;
  for (const col of ["passengers", "drivers"]) {
    const q = await db.collection(col).where("referralCode", "==", code).limit(1).get();
    if (!q.empty) { refDoc = q.docs[0]; break; }
  }
  const invalid = !refDoc || refDoc.id === snap.id ||
    (refDoc.data().phone && data.phone && refDoc.data().phone === data.phone);
  if (invalid) {
    await snap.ref.set({ referralRewarded: true, referralInvalid: true }, { merge: true });
    return null;
  }

  let reward = null;
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(snap.ref);
    if (fresh.data()?.referralRewarded) return;             // منع التكرار
    const refSnap = await tx.get(refDoc.ref);
    const count = (refSnap.data().referralCount || 0) + 1;
    const per = referralPerInvite(count);
    const bonus = REFERRAL_BONUSES[count] || 0;
    reward = { count, per, bonus, total: per + bonus, token: refSnap.data().fcmToken || null };
    const FV = admin.firestore.FieldValue;
    tx.update(refDoc.ref, { referralCount: count, points: FV.increment(per + bonus) });
    tx.update(snap.ref, { referralRewarded: true, points: FV.increment(REFERRAL_WELCOME) });
    const log = db.collection("point_transactions");
    tx.set(log.doc(), { uid: refDoc.id, type: "referral", points: per, from: snap.id, createdAt: FV.serverTimestamp() });
    if (bonus) tx.set(log.doc(), { uid: refDoc.id, type: "bonus", points: bonus, milestone: count, createdAt: FV.serverTimestamp() });
    tx.set(log.doc(), { uid: snap.id, type: "welcome", points: REFERRAL_WELCOME, createdAt: FV.serverTimestamp() });
  });

  if (reward?.token) {
    await sendNotification(
      reward.token,
      "🎉 صديقك انضم بكودك!",
      `+${reward.total} نقطة${reward.bonus ? ` (منها مكافأة ${reward.bonus})` : ""} · عدد دعواتك: ${reward.count}`,
      { type: "referral_reward", screen: "wallet" }
    );
  }
  return null;
}

exports.onPassengerReferral = functions.firestore
  .document("passengers/{id}")
  .onCreate((snap) => processReferral(snap, "passengers").catch((e) => { console.error("referral error:", e); return null; }));

exports.onDriverReferral = functions.firestore
  .document("drivers/{id}")
  .onCreate((snap) => processReferral(snap, "drivers").catch((e) => { console.error("referral error:", e); return null; }));

// ============================================================
// ==================  2) نظام OTP (smssak)  ====================
// ============================================================

const SMSSAK_KEY = defineSecret("SMSSAK_API_KEY");
const SMSSAK_PROJECT_ID = defineSecret("SMSSAK_PROJECT_ID");

// عناوين smssak (Cloud Run). الاسم الثاني احتياطي إن كان أحد الحرفين (l / 1) مقروءاً خطأً.
const SMSSAK_SEND_URLS = [
  "https://sendotp-47lvvvrp4a-uc.a.run.app",
  "https://sendotp-471vvvrp4a-uc.a.run.app",
];
const SMSSAK_VERIFY_URLS = [
  "https://verifyotp-47lvvvrp4a-uc.a.run.app",
  "https://verifyotp-471vvvrp4a-uc.a.run.app",
];
// صيغة الرقم المرسل إلى smssak: "local" = 0XXXXXXXXX ، "nozero" = XXXXXXXXX ، "intl" = +213XXXXXXXXX
const SMSSAK_PHONE_FORMAT = "local";
function toSmssakPhone(e164) {
  const nine = e164.replace("+213", "");
  if (SMSSAK_PHONE_FORMAT === "intl") return e164;
  if (SMSSAK_PHONE_FORMAT === "nozero") return nine;
  return "0" + nine;
}

// POST إلى smssak مع تجربة العنوان الاحتياطي عند فشل الاتصال (DNS/شبكة) فقط
async function smssakPost(urls, body) {
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", key: SMSSAK_KEY.value() },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      return { ok: res.status === 200, status: res.status, text, json };
    } catch (e) {
      lastErr = e; // فشل اتصال → جرّب العنوان التالي
    }
  }
  throw lastErr;
}

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

// ===== إرسال رمز التحقق (SMS عبر smssak) =====
exports.sendOtpTwilio = onCall(
  { region: OTP_REGION, secrets: [SMSSAK_KEY, SMSSAK_PROJECT_ID] },
  async (request) => {
    const phone = normalizePhone(request.data?.phone);
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

    try {
      const r = await smssakPost(SMSSAK_SEND_URLS, {
        country: "dz",
        projectId: SMSSAK_PROJECT_ID.value(),
        phone: toSmssakPhone(phone),
      });
      if (!r.ok) {
        console.error("smssak send failed:", r.status, r.text);
        throw new Error("smssak " + r.status);
      }
      return { success: true };
    } catch (e) {
      console.error("smssak send error:", e);
      throw new HttpsError("internal", "فشل إرسال رمز التحقق");
    }
  }
);

// ===== التحقق من الرمز + إنشاء/تسجيل الدخول في Firebase =====
exports.verifyOtpTwilio = onCall(
  { region: OTP_REGION, secrets: [SMSSAK_KEY, SMSSAK_PROJECT_ID] },
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

    let approved = false;
    try {
      const r = await smssakPost(SMSSAK_VERIFY_URLS, {
        country: "dz",
        phone: toSmssakPhone(phone),
        projectId: SMSSAK_PROJECT_ID.value(),
        otp: String(code),
      });
      console.log("smssak verify:", r.status, r.text);
      if (r.status >= 500) throw new Error("smssak " + r.status);
      const j = r.json || {};
      approved = r.ok && j.success !== false && j.verified !== false &&
                 j.valid !== false && !j.error;
    } catch (e) {
      console.error("smssak verify error:", e);
      throw new HttpsError("internal", "فشل التحقق من الرمز");
    }
    const check = { status: approved ? "approved" : "denied" };

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

// ============ دخول الأدمن الثانوي (آمن، من جهة الخادم) ============
// يستبدل مقارنة الرمز داخل المتصفح. الرمز لا يغادر الخادم، وبعد النجاح يُصدر توكن مخصص يحمل admin:true
const crypto = require("crypto");
exports.adminSignIn = onCall({ region: "europe-west1" }, async (req) => {
  const email = String(req.data?.email || "").trim().toLowerCase();
  const code = String(req.data?.code || "");
  if (!email || !code) throw new HttpsError("invalid-argument", "أدخل البريد والرمز");
  const snap = await db.collection("admins").where("email", "==", email).limit(1).get();
  const generic = new HttpsError("permission-denied", "البريد أو الرمز غير صحيح، أو لم يتم قبولك بعد");
  if (snap.empty) throw generic;
  const ref = snap.docs[0].ref, a = snap.docs[0].data();
  const lockedUntil = a.lockedUntil?.toMillis?.() || 0;
  if (lockedUntil > Date.now()) throw new HttpsError("resource-exhausted", "الحساب مقفل مؤقتاً بعد محاولات خاطئة، حاول لاحقاً");
  const A = Buffer.from(String(a.code || "")), B = Buffer.from(code);
  const ok = a.approved === true && A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B);
  if (!ok) {
    const fails = (a.failedAttempts || 0) + 1;
    await ref.update({ failedAttempts: fails, ...(fails >= 5 ? { failedAttempts: 0, lockedUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60000) } : {}) });
    throw generic;
  }
  await ref.update({ failedAttempts: 0, lastLoginAt: admin.firestore.FieldValue.serverTimestamp() });
  const token = await admin.auth().createCustomToken("admin_" + snap.docs[0].id, { admin: true, subAdmin: true });
  return { token, name: a.name || email, id: snap.docs[0].id };
});
