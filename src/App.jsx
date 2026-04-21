import { useState } from "react";

const C = {
  bg: "#0f1117",
  card: "#1a1d27",
  dark: "#1a1a2e",
  green: "#00b37e",
  greenDark: "#007a55",
  orange: "#f97316",
  text: "#ffffff",
  textMuted: "#94a3b8",
  border: "#2a2d3e",
};

export default function App() {
  const [role, setRole] = useState(null);

  if (!role) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap')`}</style>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🚕</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: C.text, marginBottom: 8 }}>TaxiDZ</div>
        <div style={{ fontSize: 15, color: C.textMuted, marginBottom: 48 }}>تاكسي الجزائر — فاوض على سعرك 🇩🇿</div>
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>
          <button onClick={() => setRole("passenger")} style={{ background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", fontSize: 18, fontWeight: 800 }}>
            🧑 راكب
          </button>
          <button onClick={() => setRole("driver")} style={{ background: `linear-gradient(135deg, ${C.orange}, #ea580c)`, border: "none", borderRadius: 20, padding: "20px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", fontSize: 18, fontWeight: 800 }}>
            👨‍✈️ سائق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo', sans-serif" }}>
      <div style={{ textAlign: "center", color: C.text }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{role === "passenger" ? "🧑" : "👨‍✈️"}</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>مرحباً {role === "passenger" ? "راكب" : "سائق"}!</div>
        <button onClick={() => setRole(null)} style={{ marginTop: 20, background: C.green, border: "none", borderRadius: 12, padding: "12px 24px", color: "#fff", fontFamily: "inherit", cursor: "pointer", fontSize: 15 }}>
          🚪 رجوع
        </button>
      </div>
    </div>
  );
}
