import { useState, useEffect } from "react";
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

  // Password
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);

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
  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!oldPwd || !newPwd || !confirmPwd) {
      alert("Wypełnij wszystkie pola.");
      return;
    }
    if (newPwd !== confirmPwd) {
      alert("Nowe hasła nie są identyczne.");
      return;
    }
    if (newPwd.length < 6) {
      alert("Hasło musi mieć min 6 znaków.");
      return;
    }
    setPwdLoading(true);
    try {
      await apiChangePassword(user!.user_id, oldPwd, newPwd);
      alert("Hasło zostało zmienione.");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setShowPwdForm(false);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Nie udało się zmienić hasła.");
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
    if (!confirm("Usunąć zakład? Wszystkie audyty zostaną odpięte.")) return;
    await apiDeleteFacility(id);
    setFacilities((fs) => fs.filter((f) => f.id !== id));
    if (selectedFacId === id) setSelectedFacId(null);
  };

  // ─── norm ─────────────────────────────────────────────────
  const addNorm = async () => {
    if (!newNorm.trim() || !selectedFacId) return;
    setNormLoading(true);
    try {
      const n = await apiAddNorm(selectedFacId, newNorm.trim());
      setNorms((prev) => [...prev, n]);
      setNewNorm("");
    } catch {
      alert("Nie udało się dodać normy.");
    } finally {
      setNormLoading(false);
    }
  };

  const deleteNorm = async (id: number) => {
    await apiDeleteNorm(id);
    setNorms((ns) => ns.filter((n) => n.id !== id));
  };

  const handleLogout = () => {
    if (confirm("Czy na pewno chcesz się wylogować?")) logout();
  };

  const cardStyle = {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
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
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colors.accent,
                  fontSize: 16,
                }}
              >
                ✏️
              </button>
              <button
                onClick={() => deleteFacility(f.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colors.danger,
                  fontSize: 16,
                }}
              >
                🗑️
              </button>
            </div>
          ))}

          {/* Norms panel */}
          {selectedFacId != null && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                backgroundColor: colors.bgSecondary,
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  color: colors.textSecondary,
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                Normy dla:{" "}
                {facilities.find((f) => f.id === selectedFacId)?.name}
              </p>
              {norms.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ flex: 1, color: colors.text, fontSize: 13 }}>
                    {n.norm_name}
                  </span>
                  <button
                    onClick={() => deleteNorm(n.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: colors.danger,
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  value={newNorm}
                  onChange={(e) => setNewNorm(e.target.value)}
                  placeholder="np. PN-EN ISO 9001:2015"
                  style={{
                    flex: 1,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.bgCard,
                    color: colors.text,
                    fontSize: 13,
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addNorm()}
                />
                <button
                  onClick={addNorm}
                  disabled={normLoading || !newNorm.trim()}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: colors.accent,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: normLoading ? 0.6 : 1,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Add/Edit facility form */}
          {showFacForm && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                backgroundColor: colors.bgSecondary,
                borderRadius: 10,
              }}
            >
              <p
                style={{ color: colors.text, fontWeight: 600, marginBottom: 8 }}
              >
                {editingFac ? "Edytuj zakład" : "Nowy zakład"}
              </p>
              {[
                {
                  label: "Nazwa *",
                  value: newFacName,
                  setter: setNewFacName,
                  ph: "Fabryka Kowalski Sp. z o.o.",
                },
                {
                  label: "Adres",
                  value: newFacAddr,
                  setter: setNewFacAddr,
                  ph: "ul. Przemysłowa 1, Warszawa",
                },
              ].map((f) => (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {f.label}
                  </label>
                  <input
                    value={f.value}
                    onChange={(e) => f.setter(e.target.value)}
                    placeholder={f.ph}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 4,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.bgCard,
                      color: colors.text,
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Logo zakładu
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  {newFacLogo && (
                    <img
                      src={
                        newFacLogo.startsWith("data:")
                          ? newFacLogo
                          : `data:image/png;base64,${newFacLogo}`
                      }
                      alt="logo"
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "contain",
                        borderRadius: 6,
                      }}
                    />
                  )}
                  <label
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.bgCard,
                      color: colors.textSecondary,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    📁 Wybierz plik
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFile}
                      style={{ display: "none" }}
                    />
                  </label>
                  {newFacLogo && (
                    <button
                      onClick={() => setNewFacLogo("")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: colors.danger,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={saveFacility}
                  disabled={facLoading}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: colors.accent,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: facLoading ? 0.6 : 1,
                  }}
                >
                  {facLoading ? "Zapisywanie..." : "Zapisz"}
                </button>
                <button
                  onClick={() => {
                    setShowFacForm(false);
                    setEditingFac(null);
                    setNewFacName("");
                    setNewFacAddr("");
                    setNewFacLogo("");
                  }}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.bgCard,
                    color: colors.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}

          {!showFacForm && (
            <button
              onClick={() => {
                setShowFacForm(true);
                setEditingFac(null);
                setNewFacName("");
                setNewFacAddr("");
                setNewFacLogo("");
              }}
              style={{
                marginTop: 12,
                padding: "8px 18px",
                borderRadius: 8,
                border: `1px solid ${colors.accent}`,
                backgroundColor: colors.accentLight,
                color: colors.accent,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              + Dodaj zakład
            </button>
          )}
        </div>

        {/* Personalization */}
        <div className={styles.card} style={cardStyle}>
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

        {/* Security */}
        <div className={styles.card} style={cardStyle}>
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
