import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
});

const createFormData = (data: Record<string, any>) => {
  const form = new FormData();
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null) {
      form.append(key, data[key]);
    }
  });
  return form;
};

export async function apiLogin(email: string, password: string) {
  const res = await api.post("/api/login", createFormData({ email, password }));
  return res.data;
}

export async function apiRegister(
  email: string,
  password: string,
  full_name: string,
  avatar = "👤",
) {
  const res = await api.post(
    "/api/register",
    createFormData({ email, password, full_name, avatar }),
  );
  return res.data;
}

export async function apiChangePassword(
  user_id: string,
  old_password: string,
  new_password: string,
) {
  const res = await api.post(
    "/api/change-password",
    createFormData({ user_id, old_password, new_password }),
  );
  return res.data;
}

export async function apiUpdateAvatar(user_id: string, avatar: string) {
  const res = await api.post(
    "/api/update-avatar",
    createFormData({ user_id, avatar }),
  );
  return res.data;
}

// ─── facilities ──────────────────────────────────────────────

export async function apiGetFacilities(user_id: string) {
  const res = await api.get(`/api/facilities/${user_id}`);
  return res.data;
}

export async function apiCreateFacility(
  user_id: string,
  name: string,
  address: string,
  logo_base64 = "",
) {
  const res = await api.post(
    "/api/facilities",
    createFormData({ user_id, name, address, logo_base64 }),
  );
  return res.data;
}

export async function apiUpdateFacility(
  facility_id: number,
  name: string,
  address: string,
  logo_base64 = "",
) {
  const form = createFormData({ name, address, logo_base64 });
  const res = await api.put(`/api/facilities/${facility_id}`, form);
  return res.data;
}

export async function apiDeleteFacility(facility_id: number) {
  const res = await api.delete(`/api/facilities/${facility_id}`);
  return res.data;
}

// ─── norms ───────────────────────────────────────────────────

export async function apiGetNorms(facility_id: number) {
  const res = await api.get(`/api/facilities/${facility_id}/norms`);
  return res.data;
}

export async function apiAddNorm(facility_id: number, norm_name: string) {
  const res = await api.post(
    `/api/facilities/${facility_id}/norms`,
    createFormData({ norm_name }),
  );
  return res.data;
}

export async function apiDeleteNorm(norm_id: number) {
  const res = await api.delete(`/api/norms/${norm_id}`);
  return res.data;
}

// ─── analyze ─────────────────────────────────────────────────

export async function apiAnalyze(
  imageFile: File | Blob,
  userId: string,
  norm = "PN-ISO 45001:2018",
  facilityId = "",
  onProgress?: (msg: string) => void,
) {
  onProgress?.("Przygotowywanie zdjęcia...");
  const form = new FormData();
  form.append("file", imageFile, "photo.jpg");
  form.append("user_id", userId);
  form.append("norm", norm);
  form.append("facility_id", facilityId);

  onProgress?.("Analizowanie przez AI (może potrwać do 2 min)...");
  try {
    const res = await api.post("/api/analyze", form, {
      timeout: 9600000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (error: any) {
    console.error("API Analyze Error:", error?.response?.data || error.message);
    throw error;
  }
}

export async function apiAnalyzeVideo(
  videoFile: File,
  userId: string,
  norm = "PN-ISO 45001:2018",
  facilityId = "",
  onProgress?: (msg: string) => void,
) {
  onProgress?.("Wysyłanie wideo...");
  const form = new FormData();
  form.append("file", videoFile, videoFile.name);
  form.append("user_id", userId);
  form.append("norm", norm);
  form.append("facility_id", facilityId);

  onProgress?.("Analizowanie klatek wideo (może potrwać kilka minut)...");
  try {
    const res = await api.post("/api/analyze-video", form, {
      timeout: 600000, // 10 min
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total) {
          const percent = Math.round((e.loaded * 100) / e.total);
          onProgress?.(`Wysyłanie: ${percent}%`);
        }
      },
    });
    return res.data;
  } catch (error: any) {
    console.error(
      "API Analyze Video Error:",
      error?.response?.data || error.message,
    );
    throw error;
  }
}

// ─── notes ───────────────────────────────────────────────────

export async function apiUpdateNotes(audit_id: number, notes: string) {
  const res = await api.patch(
    `/api/audit/${audit_id}/notes`,
    createFormData({ notes }),
  );
  return res.data;
}

// ─── history ─────────────────────────────────────────────────

export async function apiGetHistory(
  userId: string,
  filters?: {
    facility_id?: number | null;
    risk_level?: string;
    date_from?: string;
    date_to?: string;
  },
) {
  const params: Record<string, any> = {};
  if (filters?.facility_id) params.facility_id = filters.facility_id;
  if (filters?.risk_level) params.risk_level = filters.risk_level;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;

  const res = await api.get(`/api/history/${userId}`, { params });
  return res.data;
}

export async function apiGetAuditDetails(auditId: number) {
  const res = await api.get(`/api/audit/${auditId}`);
  return res.data;
}

export async function apiHealthCheck() {
  const res = await api.get("/health");
  return res.data;
}

export default api;
