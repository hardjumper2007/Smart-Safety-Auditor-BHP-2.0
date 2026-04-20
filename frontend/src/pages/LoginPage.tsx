import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiLogin } from "../services/api";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      alert("Wprowadź adres email oraz hasło.");
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(cleanEmail)) {
      alert("Wprowadź poprawny adres email.");
      return;
    }

    setLoading(true);
    try {
      const userData = await apiLogin(cleanEmail, password);
      login(userData);
      navigate("/");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Nieprawidłowy email lub hasło.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div className={styles.container}>
        <div className={styles.logoContainer}>
          <div
            className={styles.logoIcon}
            style={{
              backgroundColor: colors.accentLight,
              borderColor: colors.accent,
              boxShadow: `0 4px 8px ${colors.accent}33`,
            }}
          >
            <span className={styles.logoEmoji}>🛡️</span>
          </div>
          <h1 className={styles.logoTitle} style={{ color: colors.text }}>
            SafetyAuditor
          </h1>
          <p className={styles.logoSub} style={{ color: colors.textMuted }}>
            BHP 2.0 — Inspekcja wspierana przez AI
          </p>
        </div>

        <form
          className={styles.card}
          style={{
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
          }}
          onSubmit={handleLogin}
        >
          <h2 className={styles.cardTitle} style={{ color: colors.text }}>
            Zaloguj się
          </h2>

          <div className={styles.inputGroup}>
            <label className={styles.label} style={{ color: colors.textSecondary }}>
              Email
            </label>
            <input
              className={styles.input}
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="inspektor@firma.pl"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} style={{ color: colors.textSecondary }}>
              Hasło
            </label>
            <input
              ref={passwordRef}
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
              <span className={styles.btnText}>Zaloguj się</span>
            )}
          </button>
        </form>

        <Link to="/register" className={styles.link} style={{ opacity: loading ? 0.5 : 1 }}>
          <p className={styles.linkText} style={{ color: colors.textSecondary }}>
            Nie masz konta?{" "}
            <span style={{ color: colors.accent, fontWeight: 700 }}>
              Zarejestruj się
            </span>
          </p>
        </Link>
      </div>
    </div>
  );
}