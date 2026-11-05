/* eslint-disable */
// مكالمة صوتية داخل التطبيق (WebRTC + إشارات عبر Firestore) مع بديل الاتصال الهاتفي المباشر
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { doc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
const RING_TIMEOUT = 40000;   // لا رد خلال 40 ثانية
const CONNECT_TIMEOUT = 15000; // لم يتصل الصوت خلال 15 ثانية بعد القبول → اقتراح الهاتف
const rid = () => Math.random().toString(36).slice(2, 10);

export function useVoiceCall({ bookingId, meUid, meName, otherUid }) {
  const [state, setState] = useState("idle"); // idle | calling | ringing | connecting | active
  const [incoming, setIncoming] = useState(null);
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const [weak, setWeak] = useState(false);
  const [msg, setMsg] = useState("");
  const pcRef = useRef(null), streamRef = useRef(null), audioRef = useRef(null), callIdRef = useRef(null);
  const unsubs = useRef([]), timers = useRef({}), pending = useRef([]), ringCtx = useRef(null);
  const stateRef = useRef("idle"); stateRef.current = state;

  const callRef = bookingId ? doc(db, "calls", bookingId) : null;

  const stopRing = () => { clearInterval(timers.current.ring); timers.current.ring = null; try { navigator.vibrate?.(0); } catch {} };
  const startRing = () => {
    stopRing();
    const beep = () => {
      try { navigator.vibrate?.([600, 300, 600]); } catch {}
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ringCtx.current = ringCtx.current || new AC();
        const ctx = ringCtx.current; if (ctx.state === "suspended") ctx.resume();
        [0, 0.5].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = d ? 480 : 440; g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.45); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.5); });
      } catch {}
    };
    beep(); timers.current.ring = setInterval(beep, 2200);
  };

  const cleanup = useCallback((keepMsg) => {
    stopRing();
    Object.values(timers.current).forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.current = {};
    unsubs.current.forEach((u) => { try { u(); } catch {} }); unsubs.current = [];
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    if (audioRef.current) { try { audioRef.current.srcObject = null; } catch {} }
    pcRef.current = null; streamRef.current = null; pending.current = []; callIdRef.current = null;
    setIncoming(null); setMuted(false); setSecs(0); setWeak(false); setState("idle");
    if (!keepMsg) setMsg("");
  }, []);

  const getMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  };

  const makePC = (callId, stream) => {
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (e) => {
      if (!audioRef.current) { audioRef.current = new Audio(); audioRef.current.autoplay = true; }
      audioRef.current.srcObject = e.streams[0];
      audioRef.current.play?.().catch(() => {});
    };
    pc.onicecandidate = (e) => { if (e.candidate && bookingId) addDoc(collection(db, "calls", bookingId, "candidates"), { callId, from: meUid, c: e.candidate.toJSON() }).catch(() => {}); };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        clearTimeout(timers.current.connect); setWeak(false); setState("active"); stopRing();
        if (!timers.current.tick) timers.current.tick = setInterval(() => setSecs((x) => x + 1), 1000);
      } else if (s === "disconnected") {
        clearTimeout(timers.current.drop); timers.current.drop = setTimeout(() => { if (pcRef.current?.connectionState !== "connected") setWeak(true); }, 5000);
      } else if (s === "failed") { setWeak(true); setMsg("انقطع الاتصال — الإنترنت ضعيف"); }
    };
    // مرشّحات ICE القادمة من الطرف الآخر
    unsubs.current.push(onSnapshot(query(collection(db, "calls", bookingId, "candidates"), where("callId", "==", callId)), (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data(); if (d.from === meUid) return;
        if (pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(d.c)).catch(() => {});
        else pending.current.push(d.c);
      });
    }, () => {}));
    return pc;
  };
  const flushPending = (pc) => { pending.current.splice(0).forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})); };

  // ===== الاتصال بالطرف الآخر =====
  const start = async () => {
    if (!callRef || !otherUid || stateRef.current !== "idle") return;
    setMsg("");
    let stream;
    try { stream = await getMic(); } catch { setMsg("تعذر الوصول إلى الميكروفون — اسمح به أو اتصل هاتفياً"); return; }
    streamRef.current = stream;
    const callId = rid(); callIdRef.current = callId;
    const pc = makePC(callId, stream);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await setDoc(callRef, { callId, callerId: meUid, callerName: meName || "", calleeId: otherUid, state: "ringing", offer: { type: offer.type, sdp: offer.sdp }, answer: null, createdAt: serverTimestamp() });
      setState("calling");
      timers.current.noAnswer = setTimeout(() => { if (stateRef.current === "calling") { updateDoc(callRef, { state: "ended" }).catch(() => {}); setMsg("لم يرد الطرف الآخر — جرّب الاتصال الهاتفي"); cleanup(true); } }, RING_TIMEOUT);
    } catch { setMsg("تعذر بدء المكالمة — الإنترنت ضعيف، اتصل هاتفياً"); cleanup(true); }
  };

  const accept = async () => {
    if (!incoming || !callRef) return;
    stopRing();
    let stream;
    try { stream = await getMic(); } catch { setMsg("تعذر الوصول إلى الميكروفون"); decline(); return; }
    streamRef.current = stream;
    const pc = makePC(incoming.callId, stream);
    try {
      await pc.setRemoteDescription(incoming.offer);
      flushPending(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, state: "active" });
      setIncoming(null); setState("connecting");
      timers.current.connect = setTimeout(() => { if (pcRef.current?.connectionState !== "connected") { setWeak(true); setMsg("تعذر توصيل الصوت — اتصل هاتفياً"); } }, CONNECT_TIMEOUT);
    } catch { setMsg("تعذر قبول المكالمة"); cleanup(true); }
  };
  const decline = () => { if (callRef) updateDoc(callRef, { state: "declined" }).catch(() => {}); cleanup(); };
  const hangup = () => { if (callRef && stateRef.current !== "idle") updateDoc(callRef, { state: "ended" }).catch(() => {}); cleanup(); };
  const toggleMute = () => { const t = streamRef.current?.getAudioTracks?.()[0]; if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); } };

  // ===== مراقبة وثيقة المكالمة (المتصل والمستقبل) =====
  useEffect(() => {
    if (!callRef || !meUid) return;
    const unsub = onSnapshot(callRef, async (snap) => {
      const d = snap.data(); if (!d) return;
      const mine = d.callerId === meUid;
      if (!mine && d.calleeId === meUid) {
        if (d.state === "ringing" && stateRef.current === "idle" && d.callId !== callIdRef.current && (d.createdAt?.toMillis?.() || Date.now()) > Date.now() - 60000) {
          callIdRef.current = d.callId; setIncoming({ callId: d.callId, offer: d.offer, callerName: d.callerName }); setState("ringing"); startRing();
          timers.current.missed = setTimeout(() => { if (stateRef.current === "ringing") cleanup(); }, RING_TIMEOUT + 3000);
        } else if ((d.state === "ended" || d.state === "declined") && ["ringing", "connecting", "active"].includes(stateRef.current)) cleanup();
      }
      if (mine && d.callId === callIdRef.current) {
        if (d.answer && pcRef.current && !pcRef.current.remoteDescription) {
          clearTimeout(timers.current.noAnswer);
          try { await pcRef.current.setRemoteDescription(d.answer); flushPending(pcRef.current); setState("connecting");
            timers.current.connect = setTimeout(() => { if (pcRef.current?.connectionState !== "connected") { setWeak(true); setMsg("تعذر توصيل الصوت — اتصل هاتفياً"); } }, CONNECT_TIMEOUT);
          } catch {}
        }
        if (d.state === "declined") { setMsg("رفض الطرف الآخر المكالمة"); cleanup(true); }
        if (d.state === "ended" && stateRef.current !== "idle") cleanup();
      }
    }, () => {});
    return () => { unsub(); };
  }, [bookingId, meUid]);

  useEffect(() => () => { if (stateRef.current !== "idle") hangup(); }, []);

  return { state, incoming, muted, secs, weak, msg, setMsg, start, accept, decline, hangup, toggleMute, busy: state !== "idle" };
}

// ===== أزرار الاتصال (داخل التطبيق / هاتفي) =====
export function CallButtons({ call, phone, otherName, C, compact }) {
  const canWeb = !!(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);
  const base = { flex: 1, borderRadius: 12, padding: compact ? "10px 6px" : "11px 8px", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: 13, textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={!canWeb || call.busy} onClick={call.start} style={{ ...base, background: canWeb && !call.busy ? "#111" : "#999", color: "#fff", border: "none" }}>📞 عبر التطبيق</button>
        {phone ? <a href={`tel:${phone}`} style={{ ...base, background: "#fff", color: "#111", border: "1.5px solid #111" }}>☎️ اتصال هاتفي</a> : null}
      </div>
      {call.msg && <div style={{ fontSize: 12, color: "#c4001d", marginTop: 6, textAlign: "center" }}>{call.msg}{phone && <> · <a href={`tel:${phone}`} style={{ color: "#c4001d", fontWeight: 800 }}>اتصل الآن</a></>}</div>}
    </div>
  );
}

// ===== واجهة المكالمة (واردة / جارية) =====
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export function CallOverlay({ call, otherName, phone }) {
  const { state } = call;
  if (state === "idle") return null;
  const font = "'IBM Plex Sans Arabic',Cairo,sans-serif";
  const weakBar = call.weak && (
    <div style={{ background: "#7a1f1f", color: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginTop: 12, textAlign: "center" }}>
      📶 {call.msg || "الإنترنت ضعيف"}
      {phone && <div style={{ marginTop: 8 }}><a href={`tel:${phone}`} style={{ background: "#fff", color: "#111", borderRadius: 10, padding: "8px 18px", fontWeight: 800, textDecoration: "none", display: "inline-block" }}>☎️ اتصل هاتفياً</a></div>}
    </div>
  );
  // مكالمة جارية: شريط علوي صغير يبقي الخريطة ظاهرة
  if (state === "active" || state === "connecting") {
    return createPortal(
      <div style={{ position: "fixed", top: 10, left: 10, right: 10, zIndex: 9000, background: "#111", color: "#fff", borderRadius: 18, padding: 14, boxShadow: "0 10px 40px rgba(0,0,0,.5)", fontFamily: font, direction: "rtl" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#c4001d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📞</div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{otherName || "المكالمة"}</div><div style={{ fontSize: 12, color: "#9fe3b4" }}>{state === "connecting" ? "جارٍ التوصيل…" : fmt(call.secs)}</div></div>
          <button onClick={call.toggleMute} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: call.muted ? "#fff" : "#333", color: call.muted ? "#111" : "#fff", fontSize: 18, cursor: "pointer" }}>{call.muted ? "🔇" : "🎤"}</button>
          <button onClick={call.hangup} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "#e11d48", color: "#fff", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        {weakBar}
      </div>, document.body);
  }
  // واردة أو جارٍ الاتصال: شاشة كاملة
  const ringing = state === "ringing";
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9500, background: "linear-gradient(180deg,#1b0d11,#000)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "80px 24px 60px", fontFamily: font, direction: "rtl" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 110, height: 110, borderRadius: "50%", background: "#c4001d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, margin: "0 auto 18px", boxShadow: "0 0 0 14px #c4001d22, 0 0 0 30px #c4001d11" }}>👤</div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>{ringing ? call.incoming?.callerName || otherName : otherName}</div>
        <div style={{ fontSize: 14, color: "#c7a9ae", marginTop: 6 }}>{ringing ? "مكالمة صوتية واردة عبر AL-BURAQ" : "جارٍ الاتصال…"}</div>
        {weakBar}
      </div>
      <div style={{ display: "flex", gap: 50 }}>
        <button onClick={ringing ? call.decline : call.hangup} style={{ width: 72, height: 72, borderRadius: "50%", border: "none", background: "#e11d48", color: "#fff", fontSize: 28, cursor: "pointer" }}>✕</button>
        {ringing && <button onClick={call.accept} style={{ width: 72, height: 72, borderRadius: "50%", border: "none", background: "#16a34a", color: "#fff", fontSize: 28, cursor: "pointer", animation: "callPulse 1.2s infinite" }}>📞</button>}
      </div>
      <style>{`@keyframes callPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
    </div>, document.body);
}
