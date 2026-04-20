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

  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      alert("Wszystkie pola są wymagane.");
      return;
    }
    if (password !== confirm) {
      alert("Hasła nie są identyczne.");
      return;
    }
    if (password.length < 6) {
      alert("Dla bezpieczeństwa hasło musi mieć co najmniej 6 znaków.");
      return;
    }

    setLoading(true);
    try {
      const user = await apiRegister(cleanEmail, password, cleanName);
      login(user); // Automatyczne logowanie po rejestracji
      navigate("/");
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.detail ||
          "Nie udało się utworzyć konta. Spróbuj innego adresu email."
      );
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
            <label className={styles.label} style={{ color: colors.textSecondary }}>
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
            <label className={styles.label} style={{ color: colors.textSecondary }}>
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
            <label className={styles.label} style={{ color: colors.textSecondary }}>
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
            <label className={styles.label} style={{ color: colors.textSecondary }}>
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