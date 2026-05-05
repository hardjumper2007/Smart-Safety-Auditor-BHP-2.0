import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  apiChangePassword,
  apiGetFacilities,
  apiCreateFacility,
  apiUpdateFacility,
  apiDeleteFacility,
  apiGetNorms,
  apiAddNorm,
  apiDeleteNorm,
} from "../services/api";
import styles from "./SettingsPage.module.css";

interface Facility {
  id: number;
  name: string;
  address: string;
  logo_base64?: string;
}
interface NormRow {
  id: number;
  norm_name: string;
}

export default function SettingsPage() {
  const { colors, isDark, toggleTheme, hue, setHue } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Password - ZMIENIONE: dodane pwdErrors zamiast alertów
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<string[]>([]);

  // Facilities
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [editingFac, setEditingFac] = useState<Facility | null>(null);
  const [newFacName, setNewFacName] = useState("");
  const [newFacAddr, setNewFacAddr] = useState("");
  const [newFacLogo, setNewFacLogo] = useState("");
  const [facLoading, setFacLoading] = useState(false);
  const [showFacForm, setShowFacForm] = useState(false);

  // Norms
  const [selectedFacId, setSelectedFacId] = useState<number | null>(null);
  const [norms, setNorms] = useState<NormRow[]>([]);
  const [newNorm, setNewNorm] = useState("");
  const [normLoading, setNormLoading] = useState(false);

  useEffect(() => {
    if (!user?.user_id) return;
    apiGetFacilities(user.user_id)
      .then(setFacilities)
      .catch(() => {});
  }, [user?.user_id]);

  useEffect(() => {
    if (selectedFacId == null) {
      setNorms([]);
      return;
    }
    apiGetNorms(selectedFacId)
      .then(setNorms)
      .catch(() => {});
  }, [selectedFacId]);

  // ─── password ─────────────────────────────────────────────
  // ZMIENIONE: mechanika z Claude'a - walidacja + pwdErrors
  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errors: string[] = [];

    if (!oldPwd || !newPwd || !confirmPwd) {
      errors.push("❌ Wszystkie pola są wymagane");
    }
    if (newPwd !== confirmPwd) {
      errors.push("❌ Nowe hasła nie są identyczne");
    }
    if (newPwd.length < 8) {
      errors.push("❌ Hasło musi mieć co najmniej 8 znaków");
    }
    if (oldPwd === newPwd && newPwd.length > 0) {
      errors.push("❌ Nowe hasło musi być różne od starego hasła");
    }

    if (errors.length > 0) {
      setPwdErrors(errors);
      return;
    }

    setPwdErrors([]);
    setPwdLoading(true);
    try {
      await apiChangePassword(user!.user_id, oldPwd, newPwd);
      setPwdErrors(["✅ Hasło zostało zmienione pomyślnie"]);
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => {
        setShowPwdForm(false);
        setPwdErrors([]);
      }, 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Nie udało się zmienić hasła";
      setPwdErrors(["❌ " + msg]);
    } finally {
      setPwdLoading(false);
    }
  };

  // ─── facility ─────────────────────────────────────────────
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewFacLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveFacility = async () => {
    if (!newFacName.trim()) {
      alert("Podaj nazwę zakładu.");
      return;
    }
    setFacLoading(true);
    try {
      if (editingFac) {
        const updated = await apiUpdateFacility(
          editingFac.id,
          newFacName,
          newFacAddr,
          newFacLogo,
        );
        setFacilities((fs) =>
          fs.map((f) => (f.id === editingFac.id ? updated : f)),
        );
      } else {
        const created = await apiCreateFacility(
          user!.user_id,
          newFacName,
          newFacAddr,
          newFacLogo,
        );
        setFacilities((fs) => [created, ...fs]);
      }
      setShowFacForm(false);
      setEditingFac(null);
      setNewFacName("");
      setNewFacAddr("");
      setNewFacLogo("");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Błąd zapisu zakładu.");
    } finally {
      setFacLoading(false);
    }
  };

  const startEditFac = (f: Facility) => {
    setEditingFac(f);
    setNewFacName(f.name);
    setNewFacAddr(f.address || "");
    setNewFacLogo(f.logo_base64 || "");
    setShowFacForm(true);
  };

  const deleteFacility = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć ten zakład?")) return;
    try {
      await apiDeleteFacility(id);
      setFacilities((fs) => fs.filter((f) => f.id !== id));
      if (selectedFacId === id) setSelectedFacId(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Błąd usunięcia zakładu.");
    }
  };

  // ─── norms ────────────────────────────────────────────────
  const addNorm = async () => {
    if (!selectedFacId || !newNorm.trim()) return;
    setNormLoading(true);
    try {
      const added = await apiAddNorm(selectedFacId, newNorm);
      setNorms((ns) => [added, ...ns]);
      setNewNorm("");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Błąd dodania normy.");
    } finally {
      setNormLoading(false);
    }
  };

  const deleteNormItem = async (id: number) => {
    try {
      await apiDeleteNorm(id);
      setNorms((ns) => ns.filter((n) => n.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Błąd usunięcia normy.");
    }
  };

  // ─── logout ───────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const cardStyle = {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
  };

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div className={styles.container}>
        {/* Profile */}
        <div className={styles.card} style={cardStyle}>
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

        {/* Facilities */}
        <div className={styles.card} style={cardStyle}>
          <h2 className={styles.cardHeader} style={{ color: colors.text }}>
            🏭 Zakłady
          </h2>

          {facilities.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              {f.logo_base64 && (
                <img
                  src={
                    f.logo_base64.startsWith("data:")
                      ? f.logo_base64
                      : `data:image/png;base64,${f.logo_base64}`
                  }
                  alt="logo"
                  style={{
                    width: 32,
                    height: 32,
                    objectFit: "contain",
                    borderRadius: 4,
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <p
                  style={{ color: colors.text, fontWeight: 600, fontSize: 14 }}
                >
                  {f.name}
                </p>
                {f.address && (
                  <p style={{ color: colors.textMuted, fontSize: 12 }}>
                    {f.address}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedFacId(f.id === selectedFacId ? null : f.id);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  backgroundColor:
                    selectedFacId === f.id ? colors.accent : colors.bgSecondary,
                  color: selectedFacId === f.id ? "#fff" : colors.textSecondary,
                }}
              >
                Normy
              </button>
              <button
                onClick={() => startEditFac(f)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  backgroundColor: colors.bgSecondary,
                  color: colors.textSecondary,
                }}
              >
                Edytuj
              </button>
              <button
                onClick={() => deleteFacility(f.id)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  backgroundColor: colors.danger + "20",
                  color: colors.danger,
                }}
              >
                Usuń
              </button>
            </div>
          ))}

          <button
            onClick={() => {
              setEditingFac(null);
              setNewFacName("");
              setNewFacAddr("");
              setNewFacLogo("");
              setShowFacForm(!showFacForm);
            }}
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              backgroundColor: colors.accent,
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {showFacForm ? "Anuluj" : "+ Dodaj zakład"}
          </button>

          {showFacForm && (
            <form
              className={styles.facForm}
              onSubmit={(e) => {
                e.preventDefault();
                saveFacility();
              }}
            >
              {[
                {
                  label: "Nazwa zakładu",
                  value: newFacName,
                  setter: setNewFacName,
                },
                { label: "Adres", value: newFacAddr, setter: setNewFacAddr },
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
                    placeholder={field.label}
                  />
                </div>
              ))}
              <div className={styles.inputGroup}>
                <label
                  className={styles.label}
                  style={{ color: colors.textSecondary }}
                >
                  Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFile}
                  style={{ color: colors.text }}
                />
                {newFacLogo && (
                  <img
                    src={newFacLogo}
                    alt="logo"
                    style={{
                      marginTop: 8,
                      width: 48,
                      height: 48,
                      objectFit: "contain",
                      borderRadius: 4,
                    }}
                  />
                )}
              </div>
              <button
                className={styles.btn}
                style={{
                  backgroundColor: colors.accent,
                  opacity: facLoading ? 0.7 : 1,
                }}
                type="submit"
                disabled={facLoading}
              >
                {facLoading ? (
                  <span className={styles.spinner}></span>
                ) : (
                  <span className={styles.btnText}>
                    {editingFac ? "Zaktualizuj" : "Dodaj"} zakład
                  </span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Norms */}
        {selectedFacId && (
          <div className={styles.card} style={cardStyle}>
            <h2 className={styles.cardHeader} style={{ color: colors.text }}>
              📋 Normy dla wybranego zakładu
            </h2>
            {norms.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <p style={{ color: colors.text, fontSize: 13 }}>
                  {n.norm_name}
                </p>
                <button
                  onClick={() => deleteNormItem(n.id)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    backgroundColor: colors.danger + "20",
                    color: colors.danger,
                  }}
                >
                  Usuń
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                className={styles.input}
                style={{
                  flex: 1,
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border,
                  color: colors.text,
                }}
                value={newNorm}
                onChange={(e) => setNewNorm(e.target.value)}
                placeholder="Nazwa normy..."
              />
              <button
                onClick={addNorm}
                disabled={normLoading || !newNorm.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor:
                    normLoading || !newNorm.trim() ? "not-allowed" : "pointer",
                  backgroundColor: colors.accent,
                  color: "#fff",
                  fontWeight: 600,
                  opacity: normLoading || !newNorm.trim() ? 0.5 : 1,
                }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Theme */}
        <div className={styles.card} style={cardStyle}>
          <h2 className={styles.cardHeader} style={{ color: colors.text }}>
            🎨 Wygląd
          </h2>
          <div className={styles.themeRow}>
            <div className={styles.themeLabel}>
              <span>🌙</span>
              <span>Ciemny motyw</span>
            </div>
            <label className={styles.switch}>
              <input type="checkbox" checked={isDark} onChange={toggleTheme} />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: colors.textSecondary }}>Odcień akcentu:</span>
            <input
              type="range"
              min="0"
              max="360"
              value={hue}
              onChange={(e) => setHue(parseInt(e.target.value))}
              style={{ flex: 1, maxWidth: 150 }}
            />
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: colors.accent,
                border: `2px solid ${colors.border}`,
              }}
            />
          </div>
        </div>

        {/* Security - ZMIENIONE */}
        <div className={styles.card} style={cardStyle}>
          <h2 className={styles.cardHeader} style={{ color: colors.text }}>
            🔐 Bezpieczeństwo
          </h2>
          <button
            className={styles.securityBtn}
            onClick={() => {
              setShowPwdForm(!showPwdForm);
              setPwdErrors([]);
            }}
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
                    autoComplete="new-password" // KLUCZOWE: zabija okienko z mailami
                  />
                </div>
              ))}

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
                  📋 Wymagania:
                </p>
                <p
                  style={{
                    color:
                      newPwd.length >= 8 ? colors.success : colors.textMuted,
                    fontSize: 12,
                  }}
                >
                  {newPwd.length >= 8 ? "✅" : "❌"} Minimum 8 znaków
                </p>
                <p
                  style={{
                    color:
                      newPwd === confirmPwd && newPwd.length > 0
                        ? colors.success
                        : colors.textMuted,
                    fontSize: 12,
                  }}
                >
                  {newPwd === confirmPwd && newPwd.length > 0 ? "✅" : "❌"}{" "}
                  Hasła się zgadzają
                </p>
                <p
                  style={{
                    color:
                      newPwd.length > 0 && oldPwd !== newPwd
                        ? colors.success
                        : colors.textMuted,
                    fontSize: 12,
                  }}
                >
                  {newPwd.length > 0 && oldPwd !== newPwd ? "✅" : "❌"} Inne
                  niż stare hasło
                </p>
              </div>

              {/* Błędy/komunikaty */}
              {pwdErrors.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {pwdErrors.map((err, i) => (
                    <p
                      key={i}
                      style={{
                        color: err.includes("✅")
                          ? colors.success
                          : colors.danger,
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
