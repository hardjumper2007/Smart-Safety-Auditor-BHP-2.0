import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { apiUpdateNotes, apiGetAuditDetails } from "../services/api";
import styles from "./AnalysisResultPage.module.css";

interface Hazard {
  name: string;
  severity: string;
}

interface AnalysisResult {
  id: number;
  compliance_score: number;
  status: string;
  hazards: Hazard[];
  risk_level: string;
  non_compliances: string[];
  recommendations: string[];
  iso_clauses: string[];
  created_at?: string;
  norm?: string;
  user_notes?: string;
  image_base64?: string;
  facility_name?: string;
  facility_logo?: string;
}

const SEV: Record<string, { color: string; icon: string; label: string }> = {
  niskie: { color: "#2ed573", icon: "🟢", label: "Niskie" },
  średnie: { color: "#ffa502", icon: "🟡", label: "Średnie" },
  wysokie: { color: "#ff6348", icon: "🟠", label: "Wysokie" },
  krytyczne: { color: "#ff4757", icon: "🔴", label: "Krytyczne" },
};
const RISK: Record<string, { color: string; bg: string; label: string }> = {
  niskie: { color: "#2ed573", bg: "rgba(46,213,115,0.12)", label: "NISKIE" },
  średnie: { color: "#ffa502", bg: "rgba(255,165,2,0.12)", label: "ŚREDNIE" },
  wysokie: { color: "#ff6348", bg: "rgba(255,99,72,0.12)", label: "WYSOKIE" },
  krytyczne: {
    color: "#ff4757",
    bg: "rgba(255,71,87,0.12)",
    label: "KRYTYCZNE",
  },
};
const STATUS: Record<string, { icon: string; color: string }> = {
  Zgodne: { icon: "✅", color: "#2ed573" },
  "Częściowo zgodne": { icon: "⚠️", color: "#ffa502" },
  Niezgodne: { icon: "❌", color: "#ff4757" },
};

function formatDate(iso?: string) {
  if (!iso) return new Date().toLocaleDateString("pl-PL");
  try {
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ensureDataUri(b64?: string, mime = "image/jpeg") {
  if (!b64) return null;
  if (b64.startsWith("data:")) return b64;
  return `data:${mime};base64,${b64}`;
}

export default function AnalysisResultPage() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    result: initialResult,
    imageUri,
    facilityLogo,
  } = (location.state || {}) as {
    result: AnalysisResult;
    imageUri?: string;
    facilityLogo?: string;
  };

  const [result, setResult] = useState<AnalysisResult>(initialResult);
  const [notes, setNotes] = useState(initialResult?.user_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  if (!result) {
    return (
      <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
        <p style={{ color: colors.text, textAlign: "center", marginTop: 50 }}>
          Błąd: Brak danych analizy.
        </p>
      </div>
    );
  }

  const risk = RISK[result.risk_level?.toLowerCase()] || RISK.niskie;
  const statusCfg = STATUS[result.status] || STATUS["Częściowo zgodne"];
  const scoreColor = useMemo(() => {
    if (result.compliance_score >= 80) return "#2ed573";
    if (result.compliance_score >= 50) return "#ffa502";
    return "#ff4757";
  }, [result.compliance_score]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await apiUpdateNotes(result.id, notes);
      setResult((r) => ({ ...r, user_notes: notes }));
      setNotesOpen(false);
    } catch {
      alert("Nie udało się zapisać uwag.");
    } finally {
      setSavingNotes(false);
    }
  };

  const exportPDF = async () => {
    setExportingPDF(true);
    try {
      const fullAudit: any = await apiGetAuditDetails(result.id);

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const createSection = (html: string) => {
        const div = document.createElement("div");
        div.style.width = "794px";
        div.style.padding = "40px";
        div.style.fontFamily = "Arial, sans-serif";
        div.style.backgroundColor = "#ffffff";
        div.style.color = "#000000";
        div.style.pageBreakInside = "avoid";
        div.style.breakInside = "avoid";
        div.innerHTML = html;
        return div;
      };

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      let isFirstPage = true;

      const addSectionToPDF = async (sectionHtml: string) => {
        const element = createSection(sectionHtml);
        document.body.appendChild(element);

        await new Promise((r) => setTimeout(r, 50));

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (!isFirstPage) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
        isFirstPage = false;

        document.body.removeChild(element);
      };

      const riskLabel = fullAudit.risk_level?.toUpperCase() || "";
      const scoreColorPDF =
        fullAudit.compliance_score >= 80
          ? "#2ed573"
          : fullAudit.compliance_score >= 50
            ? "#ffa502"
            : "#ff4757";

      await addSectionToPDF(`
        <div style="margin-bottom: 20px;">
          ${fullAudit.facility_logo ? `<img src="data:image/png;base64,${fullAudit.facility_logo}" style="width: 60px; height: 60px; object-fit: contain; float: left; margin-right: 15px;" />` : ""}
          <h1 style="color: #0e87c7; font-size: 28px; margin: 0 0 10px 0;">Raport BHP #${fullAudit.id}</h1>
          <p style="margin: 5px 0; font-size: 14px;">Data: ${formatDate(fullAudit.created_at)}</p>
          <p style="margin: 5px 0; font-size: 14px;">Norma: ${fullAudit.norm || "PN-ISO 45001:2018"}</p>
          ${fullAudit.facility_name ? `<p style="margin: 5px 0; font-size: 14px;">Zakład: ${fullAudit.facility_name}</p>` : ""}
          <div style="clear: both;"></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 2px solid #0e87c7;">
          <thead>
            <tr style="background: #0e87c7; color: white;">
              <th style="padding: 12px; font-size: 14px; border: 1px solid #0e87c7;">Wynik zgodności</th>
              <th style="padding: 12px; font-size: 14px; border: 1px solid #0e87c7;">Status</th>
              <th style="padding: 12px; font-size: 14px; border: 1px solid #0e87c7;">Poziom ryzyka</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 15px; text-align: center; font-size: 18px; font-weight: bold; color: ${scoreColorPDF}; border: 1px solid #ddd;">${fullAudit.compliance_score}%</td>
              <td style="padding: 15px; text-align: center; font-size: 16px; border: 1px solid #ddd;">${fullAudit.status}</td>
              <td style="padding: 15px; text-align: center; font-size: 16px; font-weight: bold; border: 1px solid #ddd;">${riskLabel}</td>
            </tr>
          </tbody>
        </table>

        ${
          fullAudit.image_base64
            ? `
        <div style="margin: 25px 0;">
          <h2 style="color: #0e87c7; font-size: 18px; margin: 0 0 10px 0;">Analizowane zdjęcie</h2>
          <img src="data:image/jpeg;base64,${fullAudit.image_base64}" style="width: 100%; max-width: 700px; border: 1px solid #ddd;" />
        </div>
        `
            : ""
        }
      `);

      if ((fullAudit.hazards ?? []).length > 0) {
        await addSectionToPDF(`
          <h2 style="color: #0e87c7; font-size: 18px; margin: 0 0 10px 0;">Wykryte zagrożenia</h2>
          <ul style="font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            ${fullAudit.hazards.map((h: Hazard) => `<li>${h.name} [${SEV[h.severity?.toLowerCase()]?.label || h.severity}]</li>`).join("")}
          </ul>
        `);
      }

      if ((fullAudit.non_compliances ?? []).length > 0) {
        await addSectionToPDF(`
          <h2 style="color: #0e87c7; font-size: 18px; margin: 0 0 10px 0;">Niezgodności</h2>
          <ol style="font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            ${fullAudit.non_compliances.map((n: string) => `<li>${n}</li>`).join("")}
          </ol>
        `);
      }

      if ((fullAudit.recommendations ?? []).length > 0) {
        await addSectionToPDF(`
          <h2 style="color: #0e87c7; font-size: 18px; margin: 0 0 10px 0;">Zalecenia</h2>
          <ol style="font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            ${fullAudit.recommendations.map((r: string) => `<li>${r}</li>`).join("")}
          </ol>
        `);
      }

      await addSectionToPDF(`
        ${
          (fullAudit.iso_clauses ?? []).length > 0
            ? `
        <h2 style="color: #0e87c7; font-size: 18px; margin: 0 0 10px 0;">Klauzule ISO</h2>
        <p style="font-size: 14px; line-height: 1.8;">${fullAudit.iso_clauses.join(", ")}</p>
        `
            : ""
        }

        ${
          fullAudit.user_notes
            ? `
        <h2 style="color: #0e87c7; font-size: 18px; margin: 25px 0 10px 0;">Uwagi inspektora</h2>
        <p style="font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${fullAudit.user_notes}</p>
        `
            : ""
        }

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999;">
          Wygenerowano przez Smart Safety Auditor
        </div>
      `);

      pdf.save(`raport-BHP-${fullAudit.id}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Błąd podczas generowania PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const shareReport = async () => {
    const text =
      `🛡️ RAPORT BHP — #${result.id}\n\n` +
      `Wynik zgodności: ${result.compliance_score}%\nStatus: ${result.status}\n` +
      `Poziom ryzyka: ${result.risk_level}\n\n` +
      `Zagrożenia:\n${(result.hazards || []).map((h) => `• ${h.name} [${h.severity}]`).join("\n")}\n\n` +
      `Zalecenia:\n${(result.recommendations || []).map((r) => `• ${r}`).join("\n")}\n\n` +
      `Klauzule ISO: ${(result.iso_clauses || []).join(", ")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Raport BHP #${result.id}`, text });
      } catch {}
    } else {
      navigator.clipboard.writeText(text);
      alert("Raport skopiowany do schowka");
    }
  };

  const photoSrc = imageUri || ensureDataUri(result.image_base64);

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div className={styles.topBar} style={{ borderColor: colors.border }}>
        <button onClick={() => navigate(-1)} className={styles.closeBtn}>
          <span style={{ color: colors.accent, fontSize: 15, fontWeight: 600 }}>
            ← Zamknij
          </span>
        </button>
        <h1 className={styles.topTitle} style={{ color: colors.text }}>
          Wynik #{result.id}
        </h1>
        <button onClick={shareReport} className={styles.shareIconBtn}>
          <span style={{ color: colors.accent, fontSize: 24 }}>⎙</span>
        </button>
      </div>

      <div className={styles.container}>
        {(result.facility_name || facilityLogo || result.facility_logo) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {ensureDataUri(
              facilityLogo || result.facility_logo,
              "image/png",
            ) && (
              <img
                src={
                  ensureDataUri(
                    facilityLogo || result.facility_logo,
                    "image/png",
                  )!
                }
                alt="logo zakładu"
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "contain",
                  borderRadius: 6,
                }}
              />
            )}
            {result.facility_name && (
              <span
                style={{
                  color: colors.textSecondary,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {result.facility_name}
              </span>
            )}
          </div>
        )}

        {photoSrc && (
          <img
            src={photoSrc}
            className={styles.photo}
            alt="Analizowane zdjęcie"
          />
        )}

        <div
          className={styles.scoreCard}
          style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
        >
          <div className={styles.scoreLeft}>
            <span className={styles.statusIcon}>{statusCfg.icon}</span>
            <div>
              <p className={styles.statusText} style={{ color: colors.text }}>
                {result.status}
              </p>
              <p
                className={styles.normText}
                style={{ color: colors.textMuted }}
              >
                {result.norm || "PN-ISO 45001:2018"}
              </p>
            </div>
          </div>
          <div className={styles.scoreCircle}>
            <span className={styles.scoreNumber} style={{ color: scoreColor }}>
              {result.compliance_score}
            </span>
            <span
              className={styles.scorePercent}
              style={{ color: colors.textMuted }}
            >
              %
            </span>
          </div>
        </div>

        <div
          className={styles.riskBadge}
          style={{ backgroundColor: risk.bg, borderColor: risk.color }}
        >
          <span style={{ fontSize: 18 }}>⚡</span>
          <div>
            <p className={styles.riskLabel} style={{ color: colors.textMuted }}>
              Poziom ryzyka
            </p>
            <p className={styles.riskValue} style={{ color: risk.color }}>
              {risk.label}
            </p>
          </div>
        </div>

        {(result.hazards ?? []).length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: colors.text }}>
              🔺 Wykryte zagrożenia
            </h2>
            <div
              className={styles.list}
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              }}
            >
              {result.hazards.map((hazard, i) => {
                const sev = SEV[hazard.severity?.toLowerCase()] || SEV.niskie;
                return (
                  <div
                    key={i}
                    className={styles.hazardRow}
                    style={{ borderColor: colors.border }}
                  >
                    <span>{sev.icon}</span>
                    <p
                      className={styles.hazardName}
                      style={{ color: colors.text }}
                    >
                      {hazard.name}
                    </p>
                    <div
                      className={styles.sevBadge}
                      style={{
                        borderColor: sev.color + "55",
                        backgroundColor: sev.color + "22",
                      }}
                    >
                      <span
                        className={styles.sevText}
                        style={{ color: sev.color }}
                      >
                        {sev.label.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(result.non_compliances ?? []).length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: colors.text }}>
              ❗ Niezgodności
            </h2>
            <div
              className={styles.list}
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              }}
            >
              {result.non_compliances.map((item, i) => (
                <div
                  key={i}
                  className={styles.bulletRow}
                  style={{ borderColor: colors.border }}
                >
                  <div
                    className={styles.bullet}
                    style={{ backgroundColor: "#ff4757" }}
                  ></div>
                  <p
                    className={styles.bulletText}
                    style={{ color: colors.textSecondary }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.recommendations ?? []).length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: colors.text }}>
              💡 Zalecenia
            </h2>
            <div
              className={styles.list}
              style={{
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
              }}
            >
              {result.recommendations.map((item, i) => (
                <div
                  key={i}
                  className={styles.recRow}
                  style={{ borderColor: colors.border }}
                >
                  <span
                    className={styles.recNum}
                    style={{ color: colors.accent }}
                  >
                    {i + 1}.
                  </span>
                  <p
                    className={styles.recText}
                    style={{ color: colors.textSecondary }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.iso_clauses ?? []).length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: colors.text }}>
              📋 Klauzule ISO
            </h2>
            <div className={styles.clauseWrap}>
              {result.iso_clauses.map((cl, i) => (
                <div
                  key={i}
                  className={styles.clauseChip}
                  style={{
                    borderColor: colors.accent + "55",
                    backgroundColor: colors.accentLight,
                  }}
                >
                  <span
                    className={styles.clauseText}
                    style={{ color: colors.accent }}
                  >
                    {cl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle} style={{ color: colors.text }}>
            📝 Uwagi inspektora
          </h2>
          {!notesOpen ? (
            <div>
              {result.user_notes ? (
                <p style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  {result.user_notes}
                </p>
              ) : (
                <p
                  style={{
                    color: colors.textMuted,
                    marginBottom: 8,
                    fontStyle: "italic",
                  }}
                >
                  Brak uwag
                </p>
              )}
              <button
                onClick={() => setNotesOpen(true)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: `1px solid ${colors.accent}`,
                  backgroundColor: colors.accentLight,
                  color: colors.accent,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {result.user_notes ? "Edytuj uwagi" : "+ Dodaj uwagi"}
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: 14,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
                placeholder="Wpisz swoje uwagi do audytu..."
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: colors.accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {savingNotes ? "Zapisywanie..." : "Zapisz"}
                </button>
                <button
                  onClick={() => {
                    setNotes(result.user_notes || "");
                    setNotesOpen(false);
                  }}
                  style={{
                    padding: "8px 20px",
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
        </div>

        <button
          className={styles.shareBtn}
          style={{ backgroundColor: colors.accent }}
          onClick={exportPDF}
          disabled={exportingPDF}
        >
          <span className={styles.shareBtnText}>
            {exportingPDF ? "⏳ Generowanie..." : "📄 Eksportuj raport PDF"}
          </span>
        </button>
      </div>
    </div>
  );
}
