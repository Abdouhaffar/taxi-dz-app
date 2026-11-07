/* eslint-disable */
// إشعارات المحادثة داخل التطبيق: عدّاد غير مقروء + صوت + اهتزاز + شريط علوي، حتى لو كانت المحادثة مغلقة
import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { playPing } from "./Sound";

const key = (id) => "taxidz_chat_read_" + id;
const readTs = (id) => { try { return Number(localStorage.getItem(key(id))) || 0; } catch (e) { return 0; } };
const markRead = (id) => { try { localStorage.setItem(key(id), String(Date.now())); } catch (e) {} };

export function useChatAlert({ bookingId, userId, open }) {
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (open && bookingId) { markRead(bookingId); setUnread(0); setToast(null); }
  }, [open, bookingId]);
  useEffect(() => {
    if (!bookingId || !userId) { setUnread(0); return; }
    let first = true;
    const q = query(collection(db, "chats", bookingId, "messages"), orderBy("createdAt", "asc"));
    const u = onSnapshot(q, (snap) => {
      const ms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const last = readTs(bookingId);
      const t = (m) => (m.createdAt?.toMillis?.() || Date.now());
      const others = ms.filter((m) => m.senderId !== userId);
      if (openRef.current) { markRead(bookingId); setUnread(0); if (!first && snap.docChanges().some((c) => c.type === "added" && c.doc.data().senderId !== userId)) playPing(); first = false; return; }
      setUnread(others.filter((m) => t(m) > last).length);
      if (!first) {
        const fresh = snap.docChanges().filter((c) => c.type === "added" && c.doc.data().senderId !== userId && !c.doc.metadata.hasPendingWrites);
        if (fresh.length) {
          const m = fresh[fresh.length - 1].doc.data();
          playPing();
          try { navigator.vibrate?.([200, 100, 200]); } catch (e) {}
          setToast({ name: m.senderName || "", text: m.text || "" });
        }
      }
      first = false;
    }, () => {});
    return () => u();
  }, [bookingId, userId]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  return { unread, toast, clearToast: () => setToast(null) };
}

export function ChatBadge({ n }) {
  if (!n) return null;
  return <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "#e0102f", color: "#fff", fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", marginInlineStart: 8, animation: "pulseDot 1.4s infinite" }}>{n > 9 ? "9+" : n}</span>;
}

export function ChatToast({ toast, onOpen, onClose, lang = "ar" }) {
  if (!toast) return null;
  return (
    <div onClick={() => { onOpen(); onClose(); }} style={{ position: "fixed", top: "calc(env(safe-area-inset-top,0px) + 12px)", left: 12, right: 12, zIndex: 99980, background: "#1c1a1d", color: "#fff", borderRadius: 18, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 12px 34px rgba(0,0,0,.4)", cursor: "pointer", animation: "sheetUp .35s cubic-bezier(.2,.8,.2,1) both", fontFamily: "'IBM Plex Sans Arabic',Cairo,sans-serif", direction: lang === "ar" ? "rtl" : "ltr" }}>
      <div style={{ fontSize: 26 }}>💬</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{toast.name || (lang === "ar" ? "رسالة جديدة" : "New message")}</div>
        <div style={{ fontSize: 13, opacity: .8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toast.text}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: "none", border: "none", color: "#fff9", fontSize: 18, cursor: "pointer" }}>✕</button>
    </div>
  );
}

// اتصال هاتفي عادي برقم الطرف الآخر
export function PhoneButton({ phone, label }) {
  if (!phone) return <div style={{ textAlign: "center", fontSize: 12, color: "#9a8a8e", padding: 8 }}>—</div>;
  return (
    <a href={`tel:${phone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#16a34a", color: "#fff", borderRadius: 14, padding: "12px 14px", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>
      <span style={{ fontSize: 18 }}>📞</span>
      <span>{label}</span>
      <span dir="ltr" style={{ fontWeight: 900, letterSpacing: .5 }}>{phone}</span>
    </a>
  );
}
