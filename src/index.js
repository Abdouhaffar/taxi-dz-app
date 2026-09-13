import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './Admin';

const isAdmin = window.location.pathname.startsWith('/admin');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </React.StrictMode>
);

// تسجيل Service Worker فور تحميل الصفحة (وليس فقط عند طلب إذن الإشعارات لاحقًا) —
// هذا يُحسّن قابلية تثبيت التطبيق كـ PWA، ويجعل المتصفح جاهزًا لاستقبال Push في
// الخلفية بأسرع وقت ممكن بدل انتظار تفاعل المستخدم أولاً.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {});
  });
}
