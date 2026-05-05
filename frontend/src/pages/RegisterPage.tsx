import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiRegister } from "../services/api";
import styles from "./RegisterPage.module.css";

export default function RegisterPage() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const newErrors: string[] = [];

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      newErrors.push("❌ Wszystkie pola są wymagane");
    }
    if (cleanEmail && !/\S+@\S+\.\S+/.test(cleanEmail)) {
      newErrors.push("❌ Nieprawidłowy adres email");
    }
    if (password && password.length < 8) {
      newErrors.push("❌ Hasło musi mieć co najmniej 8 znaków");
    }
    if (password !== confirm) {
      newErrors.push("❌ Hasła nie są identyczne");
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setLoading(true);
    try {
      const user = await apiRegister(cleanEmail, password, cleanName);
      login(user); // Automatyczne logowanie po rejestracji
      navigate("/");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        "Nie udało się utworzyć konta. Spróbuj innego adresu email.";
      setErrors(["❌ " + msg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div className={styles.container}>
        <button
          onClick={() => navigate("/login")}
          className={styles.backBtn}
          disabled={loading}
        >
          <span style={{ color: colors.accent, fontSize: 16, fontWeight: 600 }}>
            ← Wróć do logowania
          </span>
        </button>

        <div className={styles.header}>
          <h1 className={styles.title} style={{ color: colors.text }}>
            Utwórz konto
          </h1>
          <p className={styles.sub} style={{ color: colors.textMuted }}>
            Zacznij przeprowadzać audyty z AI
          </p>
        </div>

        <form
          className={styles.card}
          style={{
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
          }}
          onSubmit={handleRegister}
        >
          <div className={styles.inputGroup}>
            <label
              className={styles.label}
              style={{ color: colors.textSecondary }}
            >
              Imię i nazwisko
            </label>
            <input
              className={styles.input}
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jan Kowalski"
              autoCapitalize="words"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  emailRef.current?.focus();
                }
              }}
            />
          </div>

          <div className={styles.inputGroup}>
            <label
              className={styles.label}
              style={{ color: colors.textSecondary }}
            >
              Email służbowy
            </label>
            <input
              ref={emailRef}
              className={styles.input}
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@firma.pl"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  passRef.current?.focus();
                }
              }}
            />
          </div>

          <div className={styles.inputGroup}>
            <label
              className={styles.label}
              style={{ color: colors.textSecondary }}
            >
              Hasło
            </label>
            <input
              ref={passRef}
              className={styles.input}
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmRef.current?.focus();
                }
              }}
            />
          </div>

          <div className={styles.inputGroup}>
            <label
              className={styles.label}
              style={{ color: colors.textSecondary }}
            >
              Powtórz hasło
            </label>
            <input
              ref={confirmRef}
              className={styles.input}
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              type="password"
            />
          </div>

          {/* Wymagania hasła */}
          <div
            style={{
              padding: "12px",
              borderRadius: 6,
              backgroundColor: colors.bgSecondary,
              marginBottom: 12,
            }}
          >
            <p
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              📋 Wymagania hasła:
            </p>
            <p
              style={{
                color: password.length >= 8 ? colors.success : colors.textMuted,
                fontSize: 12,
              }}
            >
              {password.length >= 8 ? "✅" : "❌"} Minimum 8 znaków
            </p>
            <p
              style={{
                color:
                  password === confirm && password.length > 0
                    ? colors.success
                    : colors.textMuted,
                fontSize: 12,
              }}
            >
              {password === confirm && password.length > 0 ? "✅" : "❌"} Hasła
              się zgadzają
            </p>
          </div>

          {/* Błędy */}
          {errors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {errors.map((err, i) => (
                <p
                  key={i}
                  style={{
                    color: colors.danger,
                    fontSize: 13,
                    marginBottom: 4,
                    lineHeight: "1.3",
                  }}
                >
                  {err}
                </p>
              ))}
            </div>
          )}

          <button
            className={styles.btn}
            style={{
              backgroundColor: colors.accent,
              opacity: loading ? 0.7 : 1,
            }}
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner}></span>
            ) : (
              <span className={styles.btnText}>Zarejestruj się</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
