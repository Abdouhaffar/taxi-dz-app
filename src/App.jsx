const handleLogin = async () => {
  if (!email || !password) { setError("أدخل البريد وكلمة المرور"); return; }
  setLoading(true); setError("");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    
    const rightCol = isPassenger ? "passengers" : "drivers";
    const wrongCol = isPassenger ? "drivers" : "passengers";
    const snap = await getDoc(doc(db, rightCol, cred.user.uid));
    
    if (!snap.exists()) {
      const wrongSnap = await getDoc(doc(db, wrongCol, cred.user.uid));
      await signOut(auth);
      setError(wrongSnap.exists()
        ? `هذا الحساب مسجل كـ ${isPassenger ? "سائق" : "راكب"} — ادخل من البوابة الصحيحة`
        : "الحساب غير موجود — أنشئ حساباً جديداً"
      );
      setLoading(false);
      return;
    }
    
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
