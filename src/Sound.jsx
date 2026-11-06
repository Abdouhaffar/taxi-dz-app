/* eslint-disable */
// نظام الصوت: ملفات WAV تُولَّد داخل التطبيق (لا حاجة لرفع ملفات) وتُشغَّل عبر عنصر Audio
// الذي يُفتح بأول لمسة من المستخدم، ثم يعمل من أي مكان (مستمع Firestore، إشعار...).
function makeWav(notes, rate = 22050) {
  const total = notes.reduce((s, n) => s + n[1], 0);
  const len = Math.floor(total * rate);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, len * 2, true);
  let pos = 0;
  for (const [freq, dur, vol = 0.9] of notes) {
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n && pos < len; i++, pos++) {
      const t = i / rate;
      const env = Math.min(1, i / 200, (n - i) / 400);
      let s = freq ? Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.55 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 : 0;
      v.setInt16(44 + pos * 2, Math.max(-1, Math.min(1, s * env * vol)) * 32767, true);
    }
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
let els = null;
const build = () => {
  if (els) return els;
  const alert = new Audio(makeWav([[988, .25], [740, .25], [988, .25], [740, .25], [988, .25], [0, .15]]));
  const ping = new Audio(makeWav([[1319, .12, .8], [1760, .2, .8]]));
  alert.preload = ping.preload = "auto";
  els = { alert, ping };
  return els;
};
let unlocked = false;
export function unlockSound() {
  try {
    const { alert, ping } = build();
    if (unlocked) return;
    [alert, ping].forEach((a) => { a.muted = true; const p = a.play(); (p && p.then ? p : Promise.resolve()).then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); });
    unlocked = true;
  } catch (e) {}
}
export const playAlert = () => { try { const a = build().alert; a.currentTime = 0; a.volume = 1; a.play().catch(() => {}); } catch (e) {} };
export const playPing = () => { try { const a = build().ping; a.currentTime = 0; a.volume = 1; a.play().catch(() => {}); } catch (e) {} };
// يفتح الصوت بأول لمسة في أي مكان
if (typeof window !== "undefined") {
  const h = () => { unlockSound(); };
  ["touchstart", "pointerdown", "click", "keydown"].forEach((ev) => window.addEventListener(ev, h, { once: false, passive: true, capture: true }));
}
