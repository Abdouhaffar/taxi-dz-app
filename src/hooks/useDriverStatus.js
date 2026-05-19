import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; // أو من App.jsx

export function useDriverStatus(uid) {
  const [status, setStatus] = useState(null); // "pending" | "verified" | "rejected" | null
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, "drivers", uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setStatus(data.verificationStatus || "pending");
          setVerificationData({
            selfieUrl: data.selfieUrl,
            carFrontUrl: data.carFrontUrl,
            plateNumber: data.plateNumber,
            carModel: data.carModel,
            submittedAt: data.submittedAt,
            reviewedAt: data.reviewedAt,
            rejectionReason: data.rejectionReason,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching driver status:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { status, verificationData, loading };
}

