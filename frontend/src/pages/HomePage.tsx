import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  apiAnalyze,
  apiAnalyzeVideo,
  apiGetFacilities,
  apiGetNorms,
} from "../services/api";
import styles from "./HomePage.module.css";

interface Facility {
  id: number;
  name: string;
  logo_base64?: string;
}

interface NormRow {
  id: number;
  norm_name: string;
}

type DragHandle =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "t"
  | "b"
  | "l"
  | "r"
  | "move"
  | null;

// ─── Crop modal ───────────────────────────────────────
function CropModal({
  src,
  onDone,
  onCancel,
  colors,
}: {
  src: string;
  onDone: (blob: Blob, url: string) => void;
  onCancel: () => void;
  colors: any;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState({ x: 40, y: 40, w: 220, h: 160 });
  const [dragging, setDragging] = useState<DragHandle>(null);
  const [start, setStart] = useState({
    mx: 0,
    my: 0,
    rx: 0,
    ry: 0,
    rw: 0,
    rh: 0,
  });
  const CANVAS_W = 320,
    CANVAS_H = 240;
  const HANDLE_SIZE = 12;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CANVAS_W, rect.y);
    ctx.fillRect(0, rect.y + rect.h, CANVAS_W, CANVAS_H - rect.y - rect.h);
    ctx.fillRect(0, rect.y, rect.x, rect.h);
    ctx.fillRect(rect.x + rect.w, rect.y, CANVAS_W - rect.x - rect.w, rect.h);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    ctx.fillStyle = "#38bdf8";
    const handles = [
      [rect.x - HANDLE_SIZE / 2, rect.y - HANDLE_SIZE / 2],
      [rect.x + rect.w - HANDLE_SIZE / 2, rect.y - HANDLE_SIZE / 2],
      [rect.x - HANDLE_SIZE / 2, rect.y + rect.h - HANDLE_SIZE / 2],
      [rect.x + rect.w - HANDLE_SIZE / 2, rect.y + rect.h - HANDLE_SIZE / 2],
      [rect.x + rect.w / 2 - HANDLE_SIZE / 2, rect.y - HANDLE_SIZE / 2],
      [
        rect.x + rect.w / 2 - HANDLE_SIZE / 2,
        rect.y + rect.h - HANDLE_SIZE / 2,
      ],
      [rect.x - HANDLE_SIZE / 2, rect.y + rect.h / 2 - HANDLE_SIZE / 2],
      [
        rect.x + rect.w - HANDLE_SIZE / 2,
        rect.y + rect.h / 2 - HANDLE_SIZE / 2,
      ],
    ];
    handles.forEach(([x, y]) => {
      ctx.fillRect(x, y, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, HANDLE_SIZE, HANDLE_SIZE);
    });
  }, [rect]);

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      img.onload = draw;
      if (img.complete) draw();
    }
  }, [draw]);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  const getHandle = (mx: number, my: number): DragHandle => {
    const tol = 10;
    const { x, y, w, h } = rect;
    if (Math.abs(mx - x) < tol && Math.abs(my - y) < tol) return "tl";
    if (Math.abs(mx - (x + w)) < tol && Math.abs(my - y) < tol) return "tr";
    if (Math.abs(mx - x) < tol && Math.abs(my - (y + h)) < tol) return "bl";
    if (Math.abs(mx - (x + w)) < tol && Math.abs(my - (y + h)) < tol)
      return "br";
    if (Math.abs(mx - (x + w / 2)) < tol && Math.abs(my - y) < tol) return "t";
    if (Math.abs(mx - (x + w / 2)) < tol && Math.abs(my - (y + h)) < tol)
      return "b";
    if (Math.abs(mx - x) < tol && Math.abs(my - (y + h / 2)) < tol) return "l";
    if (Math.abs(mx - (x + w)) < tol && Math.abs(my - (y + h / 2)) < tol)
      return "r";
    if (mx > x && mx < x + w && my > y && my < y + h) return "move";
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const bnd = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - bnd.left;
    const my = e.clientY - bnd.top;
    const handle = getHandle(mx, my);
    setDragging(handle);
    setStart({ mx, my, rx: rect.x, ry: rect.y, rw: rect.w, rh: rect.h });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const bnd = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - bnd.left;
    const my = e.clientY - bnd.top;

    if (!dragging) {
      const h = getHandle(mx, my);
      const cursors: Record<string, string> = {
        tl: "nw-resize",
        tr: "ne-resize",
        bl: "sw-resize",
        br: "se-resize",
        t: "n-resize",
        b: "s-resize",
        l: "w-resize",
        r: "e-resize",
        move: "move",
      };
      canvasRef.current!.style.cursor = h ? cursors[h] : "default";
      return;
    }

    const dx = mx - start.mx;
    const dy = my - start.my;
    let { x, y, w, h } = { x: start.rx, y: start.ry, w: start.rw, h: start.rh };

    if (dragging === "move") {
      x = clamp(start.rx + dx, 0, CANVAS_W - w);
      y = clamp(start.ry + dy, 0, CANVAS_H - h);
    } else {
      if (dragging.includes("l")) {
        const newX = clamp(start.rx + dx, 0, start.rx + start.rw - 40);
        w = start.rw - (newX - start.rx);
        x = newX;
      }
      if (dragging.includes("r"))
        w = clamp(start.rw + dx, 40, CANVAS_W - start.rx);
      if (dragging.includes("t")) {
        const newY = clamp(start.ry + dy, 0, start.ry + start.rh - 40);
        h = start.rh - (newY - start.ry);
        y = newY;
      }
      if (dragging.includes("b"))
        h = clamp(start.rh + dy, 40, CANVAS_H - start.ry);
    }
    setRect({ x, y, w, h });
  };

  const stopDrag = () => setDragging(null);

  const applyCrop = () => {
    const img = imgRef.current!;
    const scaleX = img.naturalWidth / CANVAS_W;
    const scaleY = img.naturalHeight / CANVAS_H;
    const out = document.createElement("canvas");
    out.width = rect.w * scaleX;
    out.height = rect.h * scaleY;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(
      img,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.w * scaleX,
      rect.h * scaleY,
      0,
      0,
      out.width,
      out.height,
    );
    out.toBlob(
      (blob) => {
        if (!blob) return;
        onDone(blob, URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <p style={{ color: "#fff", fontSize: 14 }}>
        Przeciągnij ramkę lub uchwyty aby przyciąć
      </p>
      <img
        ref={imgRef}
        src={src}
        style={{ display: "none" }}
        onLoad={draw}
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          border: "2px solid #38bdf8",
          borderRadius: 8,
          cursor: dragging ? "grabbing" : "default",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            background: "#333",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Anuluj
        </button>
        <button
          onClick={applyCrop}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            background: colors.accent,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Przytnij
        </button>
      </div>
    </div>
  );
}

// ─── Camera modal ────────────────────────────────────────────
function CameraModal({
  onCapture,
  onClose,
  colors,
}: {
  onCapture: (blob: Blob, url: string) => void;
  onClose: () => void;
  colors: any;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => alert("Brak dostępu do kamery"));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current!;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(blob, URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", maxWidth: 480, borderRadius: 8 }}
      />
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            background: "#333",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Anuluj
        </button>
        <button
          onClick={capture}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            background: colors.accent,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          📸 Zdjęcie
        </button>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────
export default function HomePage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null,
  );
  const [facilityNorms, setFacilityNorms] = useState<NormRow[]>([]);
  const [selectedNorm, setSelectedNorm] = useState("PN-ISO 45001:2018");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [imageFile, setImageFile] = useState<File | Blob | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"photo" | "video">("photo");

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [fileError, setFileError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.user_id) return;
    apiGetFacilities(user.user_id)
      .then((data) => {
        setFacilities(data);
        if (data.length > 0) setSelectedFacility(data[0]);
      })
      .catch(() => {});
  }, [user?.user_id]);

  useEffect(() => {
    if (!selectedFacility) {
      setFacilityNorms([]);
      setSelectedNorm("PN-ISO 45001:2018");
      return;
    }
    apiGetNorms(selectedFacility.id)
      .then((data) => {
        setFacilityNorms(data);
        if (data.length > 0) setSelectedNorm(data[0].norm_name);
        else setSelectedNorm("PN-ISO 45001:2018");
      })
      .catch(() => {});
  }, [selectedFacility]);

  const normOptions =
    facilityNorms.length > 0
      ? facilityNorms.map((n) => n.norm_name)
      : ["PN-ISO 45001:2018"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (!file.type.startsWith("image/")) {
      setFileError("❌ Plik musi być obrazem (JPG, PNG, GIF, WebP itd.).");
      return;
    }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setImageFile(null);
    setImageUri(null);
  };

  const handleCropDone = (blob: Blob, url: string) => {
    setImageFile(blob);
    setImageUri(url);
    setCropSrc(null);
  };

  const handleCameraCapture = (blob: Blob, url: string) => {
    setShowCamera(false);
    setCropSrc(url);
    setImageFile(null);
    setImageUri(null);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (!file.type.startsWith("video/")) {
      setFileError("❌ Plik musi być wideo (MP4, MOV, AVI itd.).");
      return;
    }
    setVideoFile(file);
  };

  const clearMedia = () => {
    setImageFile(null);
    setImageUri(null);
    setVideoFile(null);
    setCropSrc(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    const isPhoto = mode === "photo";
    if (isPhoto && !imageFile) {
      alert("Wybierz zdjęcie");
      return;
    }
    if (!isPhoto && !videoFile) {
      alert("Wybierz film");
      return;
    }
    if (!user?.user_id) {
      alert("Zaloguj się ponownie.");
      return;
    }

    setLoading(true);
    setProgressMsg("Wysyłanie...");
    try {
      const facId = selectedFacility ? String(selectedFacility.id) : "";
      let res: any;
      if (isPhoto) {
        if (!imageFile!.type.startsWith("image/")) {
          setFileError("❌ Błąd: Wybrany plik nie jest obrazem.");
          setLoading(false);
          return;
        }
        res = await apiAnalyze(
          imageFile!,
          user.user_id,
          selectedNorm,
          facId,
          (msg) => setProgressMsg(msg),
        );
      } else {
        if (!videoFile!.type.startsWith("video/")) {
          setFileError("❌ Błąd: Wybrany plik nie jest wideo.");
          setLoading(false);
          return;
        }
        res = await apiAnalyzeVideo(
          videoFile!,
          user.user_id,
          selectedNorm,
          facId,
          (msg) => setProgressMsg(msg),
        );
      }

      if (res?.not_workplace) {
        setFileError("⚠️ Zdjęcie/film nie przedstawia stanowiska pracy.");
        setLoading(false);
        return;
      }
      navigate("/analysis-result", {
        state: {
          result: res,
          imageUri,
          facilityLogo: selectedFacility?.logo_base64,
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Błąd analizy.";
      setFileError("❌ " + msg);
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
          colors={colors}
        />
      )}
      {showCamera && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          colors={colors}
        />
      )}

      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.greeting} style={{ color: colors.text }}>
              Witaj, {user?.full_name?.split(" ")[0] || "tu"} 👋
            </h1>
            <p className={styles.sub} style={{ color: colors.textSecondary }}>
              Gotowy na audyt BHP?
            </p>
          </div>
          <div className={styles.badge}>
            <span className={styles.badgeText}>PRO</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2
            className={styles.sectionTitle}
            style={{ color: colors.textSecondary }}
          >
            ZAKŁAD
          </h2>

          {/* DROPDOWN BOOTSTRAP */}
          <div className={styles.dropdown}>
            <button
              type="button"
              className={styles.dropdownToggle}
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text,
              }}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
            >
              <span className={styles.dropdownValue}>
                {selectedFacility
                  ? selectedFacility.name
                  : "Brak wybranego zakładu"}
              </span>
              <svg
                className={`${styles.dropdownChevron} ${dropdownOpen ? styles.open : ""}`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {dropdownOpen && (
              <>
                <div
                  className={styles.dropdownBackdrop}
                  onClick={() => setDropdownOpen(false)}
                />
                <div
                  className={styles.dropdownMenu}
                  style={{
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    boxShadow: `0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ${colors.border}`,
                  }}
                >
                  <button
                    className={`${styles.dropdownItem} ${!selectedFacility ? styles.active : ""}`}
                    style={{
                      color: !selectedFacility ? colors.accent : colors.text,
                    }}
                    onClick={() => {
                      setSelectedFacility(null);
                      setDropdownOpen(false);
                    }}
                  >
                    <span>Brak wybranego zakładu</span>
                    {!selectedFacility && (
                      <span className={styles.check}>✓</span>
                    )}
                  </button>
                  {facilities.map((f) => (
                    <button
                      key={f.id}
                      className={`${styles.dropdownItem} ${selectedFacility?.id === f.id ? styles.active : ""}`}
                      style={{
                        color:
                          selectedFacility?.id === f.id
                            ? colors.accent
                            : colors.text,
                      }}
                      onClick={() => {
                        setSelectedFacility(f);
                        setDropdownOpen(false);
                      }}
                    >
                      <span>{f.name}</span>
                      {selectedFacility?.id === f.id && (
                        <span className={styles.check}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h2
            className={styles.sectionTitle}
            style={{ color: colors.textSecondary }}
          >
            NORMA
          </h2>
          <div className={styles.normList}>
            {normOptions.map((n) => (
              <button
                key={n}
                className={`${styles.normChip} ${selectedNorm === n ? styles.normChipActive : ""}`}
                style={{
                  borderColor:
                    selectedNorm === n ? colors.accent : colors.border,
                  backgroundColor:
                    selectedNorm === n ? colors.accent : "transparent",
                }}
                onClick={() => setSelectedNorm(n)}
              >
                <span
                  className={styles.normChipText}
                  style={{
                    color: selectedNorm === n ? "#fff" : colors.textSecondary,
                  }}
                >
                  {n}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 12,
            borderRadius: 10,
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
          }}
        >
          {(["photo", "video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                clearMedia();
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                cursor: "pointer",
                backgroundColor: mode === m ? colors.accent : colors.bgCard,
                color: mode === m ? "#fff" : colors.textSecondary,
                fontWeight: mode === m ? 700 : 400,
                fontSize: 14,
              }}
            >
              {m === "photo" ? "📷 Zdjęcie" : "🎬 Film"}
            </button>
          ))}
        </div>

        {mode === "photo" ? (
          <div
            className={styles.imageArea}
            style={{
              borderColor: colors.border,
              backgroundColor: colors.bgSecondary,
            }}
          >
            {imageUri ? (
              <div className={styles.imageWrapper}>
                <img
                  src={imageUri}
                  className={styles.imagePreview}
                  alt="Podgląd"
                />
                <button className={styles.clearImage} onClick={clearMedia}>
                  ✕
                </button>
                <button
                  onClick={() => setCropSrc(imageUri)}
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 12,
                    background: colors.accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  ✂️ Przytnij
                </button>
              </div>
            ) : (
              <button
                className={styles.imagePlaceholder}
                onClick={() => fileInputRef.current?.click()}
              >
                <span style={{ fontSize: 56 }}>📷</span>
                <p
                  className={styles.placeholderText}
                  style={{ color: colors.text }}
                >
                  Wybierz lub zrób zdjęcie
                </p>
                <p
                  className={styles.placeholderSub}
                  style={{ color: colors.textSecondary }}
                >
                  stanowiska pracy do analizy
                </p>
              </button>
            )}
          </div>
        ) : (
          <div
            className={styles.imageArea}
            style={{
              borderColor: colors.border,
              backgroundColor: colors.bgSecondary,
              minHeight: 120,
            }}
          >
            {videoFile ? (
              <div style={{ textAlign: "center", padding: 16 }}>
                <p style={{ color: colors.text, fontWeight: 600 }}>
                  🎬 {videoFile.name}
                </p>
                <p style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <button
                  onClick={clearMedia}
                  style={{
                    marginTop: 8,
                    color: colors.danger,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Usuń ✕
                </button>
              </div>
            ) : (
              <button
                className={styles.imagePlaceholder}
                onClick={() => videoInputRef.current?.click()}
              >
                <span style={{ fontSize: 56 }}>🎬</span>
                <p
                  className={styles.placeholderText}
                  style={{ color: colors.text }}
                >
                  Wybierz film do analizy
                </p>
                <p
                  className={styles.placeholderSub}
                  style={{ color: colors.textSecondary }}
                >
                  MP4, MOV, AVI (max 200 MB)
                </p>
              </button>
            )}
          </div>
        )}

        {fileError && (
          <div
            style={{
              color: colors.danger,
              marginBottom: 16,
              fontSize: 14,
              textAlign: "center",
              lineHeight: "1.4",
            }}
          >
            {fileError}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoChange}
          style={{ display: "none" }}
        />

        {mode === "photo" && (
          <div className={styles.actionRow}>
            <button
              className={styles.actionBtn}
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              }}
              onClick={() => setShowCamera(true)}
            >
              <span className={styles.actionIcon}>📸</span>
              <span
                className={styles.actionLabel}
                style={{ color: colors.text }}
              >
                Kamera
              </span>
            </button>
            <button
              className={styles.actionBtn}
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className={styles.actionIcon}>🖼️</span>
              <span
                className={styles.actionLabel}
                style={{ color: colors.text }}
              >
                Galeria
              </span>
            </button>
          </div>
        )}

        <button
          className={`${styles.analyzeBtn} ${!(imageUri || videoFile) || loading ? styles.analyzeBtnDisabled : ""}`}
          style={{ backgroundColor: colors.accent }}
          onClick={handleAnalyze}
          disabled={!(imageUri || videoFile) || loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner}></span>
              <span className={styles.analyzeBtnText}>{progressMsg}</span>
            </>
          ) : (
            <span className={styles.analyzeBtnText}>
              {mode === "photo" ? "Analizuj zdjęcie →" : "Analizuj film →"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
