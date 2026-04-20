import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 minuty domyślnie
});

// Pomocnicza funkcja do tworzenia FormData
const createFormData = (data: Record<string, any>) => {
  const form = new FormData();
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null) {
      form.append(key, data[key]);
    }
  });
  return form;
};

// === AUTH ===
export async function apiLogin(email: string, password: string) {
  const form = createFormData({ email, password });
  const res = await api.post("/api/login", form);
  return res.data;
}

export async function apiRegister(
  email: string,
  password: string,
  full_name: string,
  avatar: string = "👤",
) {
  const form = createFormData({ email, password, full_name, avatar });
  const res = await api.post("/api/register", form);
  return res.data;
}

export async function apiChangePassword(
  user_id: string,
  old_password: string,
  new_password: string,
) {
  const form = createFormData({ user_id, old_password, new_password });
  const res = await api.post("/api/change-password", form);
  return res.data;
}

export async function apiUpdateAvatar(user_id: string, avatar: string) {
  const form = createFormData({ user_id, avatar });
  const res = await api.post("/api/update-avatar", form);
  return res.data;
}

// === ANALIZA ===
export async function apiAnalyze(
  imageFile: File | Blob,
  userId: string,
  norm: string = "PN-ISO 45001:2018",
  onProgress?: (msg: string) => void,
) {
  onProgress?.("Przygotowywanie zdjęcia...");

  const form = new FormData();
  form.append("file", imageFile, "photo.jpg");
  form.append("user_id", userId);
  form.append("norm", norm);

  onProgress?.("Analizowanie przez AI (może potrwać do 2 min)...");

  try {
    const res = await api.post("/api/analyze", form, {
      timeout: 180000, // 3 min dla analizy
    });
    return res.data;
  } catch (error: any) {
    console.error("API Analyze Error:", error?.response?.data || error.message);
    throw error;
  }
}

// === HISTORIA ===
export async function apiGetHistory(userId: string) {
  const res = await api.get(`/api/history/${userId}`);
  return res.data;
}

export async function apiHealthCheck() {
  const res = await api.get("/health");
  return res.data;
}

export default api;
