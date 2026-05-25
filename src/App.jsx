const handleLogin = async () => {
  if (!email || !password) { setError("أدخل البريد وكلمة المرور"); return; }
  setLoading(true); setError("");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    
    // ===== التحقق من الدور =====
    const userCol = role === "driver" ? "drivers" : "passengers";
    const snap = await getDoc(doc(db, userCol, cred.user.uid));
    
    if (!snap.exists()) {
      setError("هذا الحساب مسجل كـ " + (role === "driver" ? "راكب" : "سائق"));
      await signOut(auth);
      setLoading(false);
      return;
    }
    
    // إذا كان الراكب، نحفظ البيانات
    if (isPassenger) {
      const data = snap.data();
      if (data.phone) localStorage.setItem("taxidz_phone", data.phone);
      if (data.name) localStorage.setItem("taxidz_name", data.name);
    }
    
    onSuccess(role);
  } catch (e) { 
    setError(errMsg(e.code)); 
  }
  setLoading(false);
};
