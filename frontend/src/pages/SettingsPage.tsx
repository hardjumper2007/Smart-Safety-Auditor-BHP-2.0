import { useState, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiChangePassword } from "../services/api";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const { colors, isDark, toggleTheme, hue, setHue } = useTheme();
  const { user, logout } = useAuth();

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);

  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!oldPwd || !newPwd || !confirmPwd) {
      alert("Wypełnij wszystkie pola formularza.");
      return;
    }
    if (newPwd !== confirmPwd) {
      alert("Nowe hasła nie są identyczne.");
      return;
    }
    if (newPwd.length < 6) {
      alert("Nowe hasło musi mieć co najmniej 6 znaków.");
      return;
    }

    setPwdLoading(true);
    try {
      await apiChangePassword(user!.user_id, oldPwd, newPwd);
      alert("Twoje hasło zostało pomyślnie zmienione.");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setShowPwdForm(false);
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
          "Nie udało się zmienić hasła. Sprawdź obecne hasło.",
      );
    } finally {
      setPwdLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Czy na pewno chcesz się wylogować?")) {
      logout();
    }
  };

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div
        className={styles.topBar}
        style={{ borderColor: colors.border, backgroundColor: colors.bgCard }}
      >
        <h1 className={styles.title} style={{ color: colors.text }}>
          Ustawienia
        </h1>
      </div>

      <div className={styles.container}>
        <div
          className={styles.card}
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
        >
          <h2 className={styles.cardHeader} style={{ color: colors.text }}>
            👤 Profil użytkownika
          </h2>
          <div className={styles.avatarRow}>
            <div
              className={styles.avatar}
              style={{
                backgroundColor: colors.accentLight,
                borderColor: colors.accent,
              }}
            >
              <span
                className={styles.avatarText}
                style={{ color: colors.accent }}
              >
                {user?.email?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className={styles.userName} style={{ color: colors.text }}>
                {user?.full_name || "Użytkownik"}
              </p>
              <p
                className={styles.userEmail}
                style={{ color: colors.textSecondary }}
              >
                {user?.email}
              </p>
              <p className={styles.userId} style={{ color: colors.textMuted }}>
                ID: {user?.user_id?.slice(0, 12)}
              </p>
            </div>
          </div>
        </div>

        <div
          className={styles.card}
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
        >
          <h2 className={styles.cardHeader} style={{ color: colors.text }}>
            🎨 Personalizacja
          </h2>

          <div className={styles.row}>
            <span className={styles.rowLabel} style={{ color: colors.text }}>
              Tryb ciemny
            </span>
            <label className={styles.switch}>
              <input type="checkbox" checked={isDark} onChange={toggleTheme} />
              <span
                className={styles.slider}
                style={{
                  backgroundColor: isDark ? colors.accent : colors.border,
                }}
              >
                <span
                  className={styles.sliderKnob}
                  style={{
                    backgroundColor: isDark ? "#fff" : colors.textMuted,
                    transform: isDark ? "translateX(20px)" : "translateX(0px)",
                  }}
                />
              </span>
            </label>
          </div>

          <div
            className={styles.separator}
            style={{ backgroundColor: colors.border }}
          ></div>

          <span
            className={styles.rowLabel}
            style={{ color: colors.text, marginBottom: 4 }}
          >
            Kolor akcentu
          </span>
          <div className={styles.hueRow}>
            {[0, 35, 60, 145, 190, 225, 275, 315].map((h) => (
              <button
                key={h}
                className={`${styles.hueCircle} ${Math.abs(hue - h) < 15 ? styles.hueCircleActive : ""}`}
                style={{ backgroundColor: `hsl(${h}, 85%, 55%)` }}
                onClick={() => setHue(h)}
              />
            ))}
          </div>

          <div className={styles.sliderRow}>
            <div className={styles.customSlider}>
              {Array.from({ length: 24 }, (_, i) => i * 15).map((h) => (
                <button
                  key={h}
                  className={styles.sliderTick}
                  style={{
                    backgroundColor: `hsl(${h}, 80%, 55%)`,
                    opacity: Math.abs(hue - h) < 8 ? 1 : 0.3,
                    transform: `scaleY(${Math.abs(hue - h) < 8 ? 1.2 : 1})`,
                  }}
                  onClick={() => setHue(h)}
                />
              ))}
            </div>
          </div>

          <div
            className={styles.accentPreview}
            style={{
              backgroundColor: colors.accentLight,
              borderColor: colors.accent,
            }}
          >
            <span
              className={styles.accentPreviewText}
              style={{ color: colors.accent }}
            >
              Podgląd koloru
            </span>
          </div>
        </div>

        <div
          className={styles.card}
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
        >
          <h2 className={styles.cardHeader} style={{ color: colors.text }}>
            🔐 Bezpieczeństwo
          </h2>
          <button
            className={styles.securityBtn}
            onClick={() => setShowPwdForm(!showPwdForm)}
            style={{ color: colors.accent }}
          >
            {showPwdForm ? "Anuluj zmianę hasła" : "Zmień hasło"}
          </button>

          {showPwdForm && (
            <form className={styles.pwdForm} onSubmit={handleChangePassword}>
              {[
                { label: "Obecne hasło", value: oldPwd, setter: setOldPwd },
                { label: "Nowe hasło", value: newPwd, setter: setNewPwd },
                {
                  label: "Potwierdź nowe hasło",
                  value: confirmPwd,
                  setter: setConfirmPwd,
                },
              ].map((field) => (
                <div key={field.label} className={styles.inputGroup}>
                  <label
                    className={styles.label}
                    style={{ color: colors.textSecondary }}
                  >
                    {field.label}
                  </label>
                  <input
                    className={styles.input}
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </div>
              ))}
              <button
                className={styles.btn}
                style={{
                  backgroundColor: colors.accent,
                  opacity: pwdLoading ? 0.7 : 1,
                }}
                type="submit"
                disabled={pwdLoading}
              >
                {pwdLoading ? (
                  <span className={styles.spinner}></span>
                ) : (
                  <span className={styles.btnText}>Zaktualizuj hasło</span>
                )}
              </button>
            </form>
          )}
        </div>

        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          style={{
            borderColor: colors.danger + "60",
            backgroundColor: colors.danger + "10",
          }}
        >
          <span className={styles.logoutText} style={{ color: colors.danger }}>
            Wyloguj się z konta
          </span>
        </button>
      </div>
    </div>
  );
}
