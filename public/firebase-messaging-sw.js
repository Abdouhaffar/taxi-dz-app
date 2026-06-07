// Firebase Messaging Service Worker
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

// استقبال الإشعارات في الخلفية
messaging.onBackgroundMessage((payload) => {
  console.log('📬 إشعار في الخلفية:', payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'TaxiDZ 🚕', {
    body: body || 'لديك إشعار جديد',
    icon: icon || '/logo192.png',
    badge: '/logo192.png',
    tag: 'taxidz-notification',
    data: payload.data,
    actions: [
      { action: 'open', title: '📱 فتح التطبيق' },
      { action: 'dismiss', title: '❌ إغلاق' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
});

// عند الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow('/'));
  }
});
