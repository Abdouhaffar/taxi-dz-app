// AL-BURAQ - Firebase Messaging Service Worker
// ضعه في مجلد public/

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBIVg4BuL38sGZrcY4vrHLEbmwgVu1knlA",
  authDomain: "taxi-dz-ee993.firebaseapp.com",
  projectId: "taxi-dz-ee993",
  storageBucket: "taxi-dz-ee993.firebasestorage.app",
  messagingSenderId: "547448954066",
  appId: "1:547448954066:web:75185d79056a27b5eb610b",
});

const messaging = firebase.messaging();

// ===== إشعارات الخلفية =====
messaging.onBackgroundMessage((payload) => {
  console.log('📬 AL-BURAQ - إشعار في الخلفية:', payload);

  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};

  // أيقونات حسب نوع الإشعار
  const icons = {
    new_booking: "🚕",
    booking_accepted: "✅",
    booking_cancelled: "❌",
    new_message: "💬",
    new_rating: "⭐",
    trip_completed: "🏁",
    subscription_activated: "💳",
    verification_approved: "✅",
    verification_rejected: "❌",
    sos_alert: "🆘",
    new_report: "🚨",
  };

  const emoji = icons[data.type] || "🔔";

  self.registration.showNotification(`${emoji} ${title || 'AL-BURAQ'}`, {
    body: body || 'لديك إشعار جديد',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: `alburaq-${data.type || 'notification'}-${Date.now()}`,
    data: { ...data, url: getTargetUrl(data) },
    actions: getActions(data.type),
    vibrate: getVibrationPattern(data.type),
    requireInteraction: shouldRequireInteraction(data.type),
    silent: false,
    timestamp: Date.now(),
  });
});

// تحديد الرابط عند الضغط على الإشعار
function getTargetUrl(data) {
  const base = 'https://alburaq-dz.vercel.app';
  switch(data.type) {
    case 'new_booking': return `${base}/#driver-home`;
    case 'booking_accepted': return `${base}/#passenger-ride`;
    case 'new_message': return `${base}/#chat-${data.bookingId}`;
    case 'new_rating': return `${base}/#driver-profile`;
    case 'sos_alert': return `${base}/admin#sos`;
    case 'new_report': return `${base}/admin#complaints`;
    default: return base;
  }
}

// أزرار حسب نوع الإشعار
function getActions(type) {
  switch(type) {
    case 'new_booking':
      return [
        { action: 'open', title: '🚕 عرض الطلب' },
        { action: 'dismiss', title: '✕ تجاهل' },
      ];
    case 'booking_accepted':
      return [
        { action: 'open', title: '📍 تتبع السائق' },
        { action: 'dismiss', title: '✕ لاحقاً' },
      ];
    case 'new_message':
      return [
        { action: 'open', title: '💬 رد' },
        { action: 'dismiss', title: '✕ تجاهل' },
      ];
    default:
      return [
        { action: 'open', title: '📱 فتح التطبيق' },
        { action: 'dismiss', title: '✕ إغلاق' },
      ];
  }
}

// نمط الاهتزاز حسب نوع الإشعار
function getVibrationPattern(type) {
  switch(type) {
    case 'new_booking': return [300, 100, 300, 100, 300]; // 3 اهتزازات قوية
    case 'sos_alert': return [500, 100, 500, 100, 500, 100, 500]; // SOS
    case 'new_message': return [200, 100, 200]; // اهتزازان خفيفان
    case 'booking_accepted': return [400, 100, 400]; // اهتزازان متوسطان
    default: return [200, 100, 200];
  }
}

// هل يبقى الإشعار حتى يُغلق يدوياً؟
function shouldRequireInteraction(type) {
  return ['new_booking', 'sos_alert', 'booking_accepted'].includes(type);
}

// ===== عند الضغط على الإشعار =====
self.addEventListener('notificationclick', (event) => {
  console.log('👆 ضغط على الإشعار:', event.notification.tag);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || 'https://alburaq-dz.vercel.app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // إذا التطبيق مفتوح — انتقل إليه
      for (const client of clientList) {
        if (client.url.includes('alburaq') && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      // إذا مغلق — افتحه
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ===== عند إغلاق الإشعار =====
self.addEventListener('notificationclose', (event) => {
  console.log('✕ أُغلق الإشعار:', event.notification.tag);
});

// ===== تفعيل Service Worker فوراً =====
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
