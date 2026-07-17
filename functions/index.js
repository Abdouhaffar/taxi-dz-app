/**
 * AL-BURAQ - Firebase Cloud Functions
 * الإشعارات التلقائية لكل أحداث التطبيق
 * 
 * تثبيت:
 * npm install -g firebase-tools
 * firebase login
 * firebase init functions (اختر JavaScript)
 * ضع هذا الملف في مجلد functions/
 * firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ===== دالة مساعدة لإرسال الإشعار =====
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

// دالة لإرسال لعدة tokens
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
    const { originLat, originLng, passengerName, price, distanceKm, passengers, luggageWeight } = booking;

    try {
      // جلب السائقين المتصلين والمعتمدين
      const driversSnap = await db.collection("drivers")
        .where("isOnline", "==", true)
        .where("verificationStatus", "==", "approved")
        .get();

      const nearbyTokens = [];
      driversSnap.forEach(doc => {
        const driver = doc.data();
        if (!driver.fcmToken || !driver.location) return;

        // حساب المسافة بين السائق والراكب
        const R = 6371;
        const dLat = (driver.location.lat - originLat) * Math.PI / 180;
        const dLng = (driver.location.lng - originLng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(originLat*Math.PI/180) * Math.cos(driver.location.lat*Math.PI/180) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        // إرسال للسائقين في نطاق 5 كم
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

    // قبول الرحلة
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

    // إلغاء الرحلة من السائق
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

    // اكتمال الرحلة
    if (before.status !== "completed" && after.status === "completed") {
      try {
        // إشعار للسائق
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
      // جلب بيانات الحجز
      const bookingSnap = await db.collection("bookings").doc(bookingId).get();
      if (!bookingSnap.exists) return null;
      const booking = bookingSnap.data();

      // تحديد المستقبل (الطرف الآخر)
      const senderId = message.senderId;
      let recipientToken = null;
      let recipientName = "";

      if (senderId === booking.passengerId) {
        // الراكب أرسل → أخبر السائق
        const driverSnap = await db.collection("drivers").doc(booking.driverId).get();
        recipientToken = driverSnap.data()?.fcmToken;
        recipientName = booking.passengerName || "الراكب";
      } else {
        // السائق أرسل → أخبر الراكب
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

    // تم قبول الاشتراك
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

    // رفض التوثيق
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

    // قبول التوثيق
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
      // جلب token الأدمن الرئيسي
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
