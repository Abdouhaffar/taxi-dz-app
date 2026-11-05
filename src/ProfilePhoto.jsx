/* eslint-disable */
// صورة البروفايل (اختيارية): تُصغَّر داخل المتصفح إلى 256px وتُحفظ في Firestore، دون الحاجة إلى Storage
import { useRef, useState } from "react";

export function resizeToDataUrl(file, size = 256, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("not-image"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad-image")); };
    img.src = url;
  });
}

export function Avatar({ src, name = "", size = 44, ring }) {
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, boxShadow: ring ? `0 0 0 2px ${ring}` : "none" };
  if (src) return <img src={src} alt="" style={{ ...base, objectFit: "cover", background: "#eee" }} />;
  return (
    <div style={{ ...base, background: "linear-gradient(135deg,#c4001d,#ff8fa0)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.42 }}>
      {(name.trim()[0] || "👤")}
    </div>
  );
}

// نافذة سفلية: إضافة / تغيير / حذف الصورة
export function PhotoSheet({ photo, name, onSave, onClose, lang = "ar" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const L = {
    ar: { title: "صورة الملف الشخصي", sub: "اختيارية — يراها السائق عند طلب التوصيل", add: photo ? "تغيير الصورة" : "إضافة صورة", del: "حذف الصورة", skip: "إغلاق", bad: "تعذر قراءة الصورة" },
    fr: { title: "Photo de profil", sub: "Facultative — visible par le chauffeur", add: photo ? "Changer la photo" : "Ajouter une photo", del: "Supprimer la photo", skip: "Fermer", bad: "Image illisible" },
    en: { title: "Profile photo", sub: "Optional — shown to the driver on your request", add: photo ? "Change photo" : "Add photo", del: "Remove photo", skip: "Close", bad: "Couldn't read image" },
  }[lang] || {};
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy(true); setErr("");
    try { await onSave(await resizeToDataUrl(f)); onClose(); } catch { setErr(L.bad); }
    setBusy(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 28px", textAlign: "center", direction: lang === "ar" ? "rtl" : "ltr" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Avatar src={photo} name={name} size={96} /></div>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#111" }}>{L.title}</div>
        <div style={{ fontSize: 12, color: "#777", margin: "4px 0 16px" }}>{L.sub}</div>
        <input ref={ref} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
        <button disabled={busy} onClick={() => ref.current.click()} style={{ width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 14, padding: 14, fontFamily: "inherit", fontWeight: 700, fontSize: 15, marginBottom: 8, cursor: "pointer" }}>{busy ? "…" : "📷 " + L.add}</button>
        {photo && <button disabled={busy} onClick={async () => { await onSave(null); onClose(); }} style={{ width: "100%", background: "#f3f3f3", color: "#c4001d", border: "none", borderRadius: 14, padding: 14, fontFamily: "inherit", fontWeight: 700, fontSize: 15, marginBottom: 8, cursor: "pointer" }}>{L.del}</button>}
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", color: "#777", padding: 10, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>{L.skip}</button>
        {err && <div style={{ color: "#c4001d", fontSize: 12, marginTop: 4 }}>{err}</div>}
      </div>
    </div>
  );
}
