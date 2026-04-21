import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import jsPDF from "jspdf";
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
}

const SEVERITY_CONFIG: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  niskie: { color: "#2ed573", icon: "🟢", label: "Niskie" },
  średnie: { color: "#ffa502", icon: "🟡", label: "Średnie" },
  wysokie: { color: "#ff6348", icon: "🟠", label: "Wysokie" },
  krytyczne: { color: "#ff4757", icon: "🔴", label: "Krytyczne" },
};

const RISK_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  niskie: { color: "#2ed573", bg: "rgba(46,213,115,0.12)", label: "NISKIE" },
  średnie: { color: "#ffa502", bg: "rgba(255,165,2,0.12)", label: "ŚREDNIE" },
  wysokie: { color: "#ff6348", bg: "rgba(255,99,72,0.12)", label: "WYSOKIE" },
  krytyczne: {
    color: "#ff4757",
    bg: "rgba(255,71,87,0.12)",
    label: "KRYTYCZNE",
  },
};

const STATUS_CONFIG: Record<string, { icon: string; color: string }> = {
  Zgodne: { icon: "✅", color: "#2ed573" },
  "Częściowo zgodne": { icon: "⚠️", color: "#ffa502" },
  Niezgodne: { icon: "❌", color: "#ff4757" },
};

function formatDate(iso?: string) {
  if (!iso) return new Date().toLocaleDateString("pl-PL");
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", {
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

export default function AnalysisResultPage() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const { result, imageUri } = (location.state || {}) as {
    result: AnalysisResult;
    imageUri?: string;
  };

  if (!result) {
    return (
      <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
        <p style={{ color: colors.text, textAlign: "center", marginTop: 50 }}>
          Błąd: Brak danych analizy.
        </p>
      </div>
    );
  }

  const risk =
    RISK_CONFIG[result.risk_level?.toLowerCase()] || RISK_CONFIG.niskie;
  const statusCfg =
    STATUS_CONFIG[result.status] || STATUS_CONFIG["Częściowo zgodne"];

  const scoreColor = useMemo(() => {
    if (result.compliance_score >= 80) return "#2ed573";
    if (result.compliance_score >= 50) return "#ffa502";
    return "#ff4757";
  }, [result.compliance_score]);

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.addFont(
      "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      "Roboto",
      "normal",
    );
    doc.addFont(
      "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      "Roboto",
      "bold",
    );
    doc.setFont("Roboto");

    const margin = 20;
    let y = margin;
    const lineHeight = 7;
    const pageWidth = doc.internal.pageSize.width;

    const addLine = (
      text: string,
      size = 11,
      style: "normal" | "bold" = "normal",
    ) => {
      doc.setFontSize(size);
      doc.setFont("Roboto", style);
      const cleaned = text
        .replace(/ą/g, "a")
        .replace(/ć/g, "c")
        .replace(/ę/g, "e")
        .replace(/ł/g, "l")
        .replace(/ń/g, "n")
        .replace(/ó/g, "o")
        .replace(/ś/g, "s")
        .replace(/ź/g, "z")
        .replace(/ż/g, "z")
        .replace(/Ą/g, "A")
        .replace(/Ć/g, "C")
        .replace(/Ę/g, "E")
        .replace(/Ł/g, "L")
        .replace(/Ń/g, "N")
        .replace(/Ó/g, "O")
        .replace(/Ś/g, "S")
        .replace(/Ź/g, "Z")
        .replace(/Ż/g, "Z");

      const lines = doc.splitTextToSize(cleaned, pageWidth - margin * 2);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });
    };

    const addSection = (title: string) => {
      y += 4;
      addLine(title, 14, "bold");
      y += 2;
    };

    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, pageWidth, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("Roboto", "bold");
    doc.text(`Raport BHP #${result.id}`, margin, 16);

    doc.setTextColor(0, 0, 0);
    y = 35;

    addLine(`Data wygenerowania: ${formatDate(result.created_at)}`, 10);
    addLine(`Norma: ${result.norm || "PN-ISO 45001:2018"}`, 10);
    y += 3;

    addSection("Podsumowanie");
    addLine(`Wynik zgodnosci: ${result.compliance_score}%`, 12, "bold");
    addLine(`Status: ${result.status}`, 11);
    addLine(`Poziom ryzyka: ${result.risk_level.toUpperCase()}`, 11);

    const hazards = result.hazards ?? [];
    if (hazards.length > 0) {
      addSection("Wykryte zagrozenia");
      hazards.forEach((h: Hazard, i: number) => {
        const sev =
          SEVERITY_CONFIG[h.severity?.toLowerCase()]?.label || h.severity;
        addLine(`${i + 1}. ${h.name} [${sev}]`);
      });
    }

    const nonCompliances = result.non_compliances ?? [];
    if (nonCompliances.length > 0) {
      addSection("Niezgodnosci");
      nonCompliances.forEach((item: string, i: number) => {
        addLine(`${i + 1}. ${item}`);
      });
    }

    const recommendations = result.recommendations ?? [];
    if (recommendations.length > 0) {
      addSection("Zalecenia");
      recommendations.forEach((item: string, i: number) => {
        addLine(`${i + 1}. ${item}`);
      });
    }

    const isoClauses = result.iso_clauses ?? [];
    if (isoClauses.length > 0) {
      addSection("Klauzule ISO");
      addLine(isoClauses.join(", "));
    }

    y = 285;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Wygenerowano przez Smart Safety Auditor", margin, y);

    doc.save(`raport-BHP-${result.id}.pdf`);
  };

  const shareReport = async () => {
    const text =
      `🛡️ RAPORT BHP — #${result.id}\n\n` +
      `Wynik zgodności: ${result.compliance_score}%\n` +
      `Status: ${result.status}\n` +
      `Poziom ryzyka: ${result.risk_level}\n\n` +
      `Zagrożenia:\n${(result.hazards || []).map((h) => `• ${h.name} [${h.severity}]`).join("\n")}\n\n` +
      `Zalecenia:\n${(result.recommendations || []).map((r) => `• ${r}`).join("\n")}\n\n` +
      `Klauzule ISO: ${(result.iso_clauses || []).join(", ")}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Raport BHP #${result.id}`, text });
      } catch (err) {
        console.error("Błąd udostępniania:", err);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Raport skopiowany do schowka");
    }
  };

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div className={styles.topBar} style={{ borderColor: colors.border }}>
        <button onClick={() => navigate(-1)} className={styles.closeBtn}>
          <span style={{ color: colors.accent, fontSize: 15, fontWeight: 600 }}>
            ← Zamknij
          </span>
        </button>
        <h1 className={styles.topTitle} style={{ color: colors.text }}>
          Wynik analizy #{result.id}
        </h1>
        <button onClick={shareReport} className={styles.shareIconBtn}>
          <span style={{ color: colors.accent, fontSize: 24 }}>⎙</span>
        </button>
      </div>

      <div className={styles.container}>
        {imageUri && (
          <img
            src={imageUri}
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
              {(result.hazards ?? []).map((hazard: Hazard, i: number) => {
                const sev =
                  SEVERITY_CONFIG[hazard.severity?.toLowerCase()] ||
                  SEVERITY_CONFIG.niskie;
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
              {(result.non_compliances ?? []).map((item: string, i: number) => (
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
              {(result.recommendations ?? []).map((item: string, i: number) => (
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
              {(result.iso_clauses ?? []).map((cl: string, i: number) => (
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

        <button
          className={styles.shareBtn}
          style={{ backgroundColor: colors.accent }}
          onClick={exportPDF}
        >
          <span className={styles.shareBtnText}>📄 Eksportuj raport PDF</span>
        </button>
      </div>
    </div>
  );
}
