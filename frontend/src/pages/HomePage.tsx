import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiAnalyze } from "../services/api";
import styles from "./HomePage.module.css";

const NORMS = [
  "PN-ISO 45001:2018",
  "PN-EN ISO 9001:2015",
  "Kodeks pracy art. 207",
  "PN-EN 13501-1",
];

export default function HomePage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Zapisujemy zarówno plik (do wysłania API) jak i URI (do podglądu na UI)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedNorm, setSelectedNorm] = useState(NORMS[0]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFromGallery = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file); // Zapisujemy plik dla API
      const url = URL.createObjectURL(file);
      setImageUri(url); // Zapisujemy URL dla podglądu
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImageUri(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      alert("Kamera na web: do zaimplementowania. Użyj galerii na start.");
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      alert("Brak dostępu do kamery");
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      alert("Wybierz zdjęcie");
      return;
    }

    if (!user?.user_id) {
      alert("Błąd: Nie znaleziono ID użytkownika. Zaloguj się ponownie.");
      return;
    }

    setLoading(true);
    setProgressMsg("Wysyłanie...");

    try {
      // Prawidłowe wywołanie apiAnalyze (Plik, ID, Norma, Callback progressu)
      const res = await apiAnalyze(
        imageFile,
        user.user_id,
        selectedNorm,
        (msg) => setProgressMsg(msg),
      );

      // Przekazujemy również imageUri do podglądu na stronie wyników
      navigate("/analysis-result", { state: { result: res, imageUri } });
    } catch (err: any) {
      console.error("Szczegóły błędu analizy:", err);
      // Wyświetlamy faktyczny błąd, żeby w przyszłości ułatwić debugowanie
      alert(
        "Błąd analizy: " +
          (err?.response?.data?.detail || err.message || "Nieznany błąd"),
      );
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  return (
    <div className={styles.container} style={{ backgroundColor: colors.bg }}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting} style={{ color: colors.text }}>
            Cześć, {user?.full_name || "Użytkowniku"}
          </h1>
          <p className={styles.sub} style={{ color: colors.textMuted }}>
            Sprawdź zgodność stanowiska z normami
          </p>
        </div>
        <div
          className={styles.badge}
          style={{ backgroundColor: colors.accent }}
        >
          <span className={styles.badgeText}>BHP</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2
          className={styles.sectionTitle}
          style={{ color: colors.textSecondary }}
        >
          WYBIERZ NORMĘ
        </h2>
        <div className={styles.normList}>
          {NORMS.map((n) => (
            <button
              key={n}
              className={`${styles.normChip} ${
                selectedNorm === n ? styles.normChipActive : ""
              }`}
              style={{
                borderColor: selectedNorm === n ? colors.accent : colors.border,
                backgroundColor:
                  selectedNorm === n ? colors.accentLight : colors.bgCard,
              }}
              onClick={() => setSelectedNorm(n)}
            >
              <span
                className={styles.normChipText}
                style={{
                  color:
                    selectedNorm === n ? colors.accent : colors.textSecondary,
                }}
              >
                {n}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.imageArea} style={{ borderColor: colors.border }}>
        {imageUri ? (
          <div className={styles.imageWrapper}>
            <img src={imageUri} className={styles.imagePreview} alt="Podgląd" />
            <button className={styles.clearImage} onClick={clearImage}>
              ✕
            </button>
          </div>
        ) : (
          <button className={styles.imagePlaceholder} onClick={pickFromGallery}>
            <span style={{ fontSize: 56 }}>📷</span>
            <p
              className={styles.placeholderText}
              style={{ color: colors.textMuted }}
            >
              Wybierz lub zrób zdjęcie
            </p>
            <p
              className={styles.placeholderSub}
              style={{ color: colors.textMuted }}
            >
              stanowiska pracy do analizy
            </p>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div className={styles.actionRow}>
        <button
          className={styles.actionBtn}
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
          onClick={openCamera}
        >
          <span className={styles.actionIcon}>📸</span>
          <span className={styles.actionLabel} style={{ color: colors.text }}>
            Kamera
          </span>
        </button>
        <button
          className={styles.actionBtn}
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
          onClick={pickFromGallery}
        >
          <span className={styles.actionIcon}>🖼️</span>
          <span className={styles.actionLabel} style={{ color: colors.text }}>
            Galeria
          </span>
        </button>
      </div>

      <button
        className={`${styles.analyzeBtn} ${!imageUri || loading ? styles.analyzeBtnDisabled : ""}`}
        style={{ backgroundColor: colors.accent }}
        onClick={handleAnalyze}
        disabled={!imageUri || loading}
      >
        {loading ? (
          <>
            <span className={styles.spinner}></span>
            <span className={styles.analyzeBtnText}>{progressMsg}</span>
          </>
        ) : (
          <span className={styles.analyzeBtnText}>Analizuj zdjęcie →</span>
        )}
      </button>

      <div
        className={styles.infoCard}
        style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
      >
        <h3
          className={styles.infoTitle}
          style={{ color: colors.textSecondary }}
        >
          JAK TO DZIAŁA
        </h3>
        <div className={styles.infoRow}>
          <div
            className={styles.infoNum}
            style={{ backgroundColor: colors.accentLight }}
          >
            <span>1</span>
          </div>
          <p
            className={styles.infoText}
            style={{ color: colors.textSecondary }}
          >
            Zrób zdjęcie stanowiska pracy
          </p>
        </div>
        <div className={styles.infoRow}>
          <div
            className={styles.infoNum}
            style={{ backgroundColor: colors.accentLight }}
          >
            <span>2</span>
          </div>
          <p
            className={styles.infoText}
            style={{ color: colors.textSecondary }}
          >
            Wybierz normę do sprawdzenia
          </p>
        </div>
        <div className={styles.infoRow}>
          <div
            className={styles.infoNum}
            style={{ backgroundColor: colors.accentLight }}
          >
            <span>3</span>
          </div>
          <p
            className={styles.infoText}
            style={{ color: colors.textSecondary }}
          >
            Otrzymaj raport z zaleceniami
          </p>
        </div>
      </div>
    </div>
  );
}
