import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const storage = getStorage();

/**
 * رفع صورة مع ضغط تلقائي
 * @param {File} file - الملف الأصلي
 * @param {string} path - مسار الحفظ (مثال: drivers/{uid}/selfie.jpg)
 * @returns {Promise<string>} - رابط الصورة
 */
export async function uploadImage(file, path) {
  // التحقق من نوع الملف
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('يُسمح فقط بصور JPG, PNG, WEBP');
  }

  // التحقق من الحجم (5MB كحد أقصى)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
  }

  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}
