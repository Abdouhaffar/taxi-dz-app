// الولايات: مراكز تقريبية لاستنتاج ولاية أي نقطة (أقرب مركز) + إعدادات المناطق + حساب سعر التشاركية
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import WILAYA_LIST from "./wilayas.json";

export { WILAYA_LIST };
export const wilayaByCode = (c) => WILAYA_LIST.find((w) => w.c === String(c).padStart(2, "0"));
export const wilayaLabel = (c) => { const w = wilayaByCode(c); return w ? `${w.c} - ${w.n}` : c || ""; };
export const codeOfLabel = (s) => (String(s || "").match(/^\s*(\d{1,2})/) || [])[1]?.padStart(2, "0") || "";

const rad = (x) => (x * Math.PI) / 180;
export const kmBetweenPts = (a, b, c, d) => {
  const R = 6371, dLat = rad(c - a), dLng = rad(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
// أقرب ولاية لنقطة (تقريبي: بحسب مراكز الولايات)
export function wilayaOf(lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null, bd = 1e9;
  for (const w of WILAYA_LIST) { const d = kmBetweenPts(lat, lng, w.lat, w.lng); if (d < bd) { bd = d; best = w; } }
  return best;
}

export const DEFAULT_REGIONS = { restrict: false, enabled: [], intercityKm: 40, uplift: 20, maxSeatsLimit: 6 };

// يقرأ settings/regions لحظياً. إن لم يوجد المستند فلا تقييد.
export function useRegions() {
  const [r, setR] = useState({ ...DEFAULT_REGIONS, loaded: false });
  useEffect(() => onSnapshot(doc(db, "settings", "regions"), (s) => setR({ ...DEFAULT_REGIONS, ...(s.exists() ? s.data() : {}), loaded: true }), () => setR((x) => ({ ...x, loaded: true }))), []);
  return r;
}
export const isEnabled = (regions, code) => !regions.restrict || (regions.enabled || []).includes(String(code));

// سعر الفرد في التشاركية: راكب واحد = السعر كاملاً. اثنان فأكثر = (السعر ÷ العدد) + نسبة إضافية. يُقرَّب لأقرب 10 دج.
export function sharedPrice(total, n, uplift = 20) {
  total = Number(total) || 0; n = Math.max(1, Number(n) || 1);
  if (n === 1) return Math.round(total);
  return Math.round((total / n) * (1 + uplift / 100) / 10) * 10;
}
// تقدير الطريق بين مركزي ولايتين (خط مستقيم × 1.25)
export const roadKm = (c1, c2) => { const a = wilayaByCode(c1), b = wilayaByCode(c2); return a && b ? Math.round(kmBetweenPts(a.lat, a.lng, b.lat, b.lng) * 1.25) : 0; };
