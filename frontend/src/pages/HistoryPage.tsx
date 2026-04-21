import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiGetHistory, apiGetAuditDetails } from "../services/api";
import jsPDF from "jspdf";
import styles from "./HistoryPage.module.css";

interface Hazard {
  name: string;
  severity: string;
}

interface AuditRow {
  id: number;
  created_at: string;
  norm: string;
  status: string;
  compliance_score: number;
  risk_level: string;
  hazards?: Hazard[];
  recommendations?: string[];
  non_compliances?: string[];
  iso_clauses?: string[];
}

const STATUS_COLOR: Record<string, string> = {
  Zgodne: "#2ed573",
  "Częściowo zgodne": "#ffa502",
  Niezgodne: "#ff4757",
};

const RISK_ICON: Record<string, string> = {
  niskie: "🟢",
  średnie: "🟡",
  wysokie: "🟠",
  krytyczne: "🔴",
};

const SEVERITY_CONFIG: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  niskie: { color: "#2ed573", icon: "🟢", label: "Niskie" },
  średnie: { color: "#ffa502", icon: "🟡", label: "Średnie" },
  wysokie: { color: "#ff6348", icon: "🟠", label: "Wysokie" },
  krytyczne: { color: "#ff4757", icon: "🔴", label: "Krytyczne" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.user_id) return;
      if (!silent) setLoading(true);

      try {
        const data = await apiGetHistory(user.user_id);
        const sortedData = data.sort(
          (a: AuditRow, b: AuditRow) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setAudits(sortedData);
      } catch (e) {
        console.error("Błąd pobierania historii:", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.user_id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const exportPDF = async (e: React.MouseEvent, audit: AuditRow) => {
    e.stopPropagation();
    setExportingId(audit.id);

    try {
      const fullAudit: AuditRow = await apiGetAuditDetails(audit.id);

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
      doc.text(`Raport BHP #${fullAudit.id}`, margin, 16);

      doc.setTextColor(0, 0, 0);
      y = 35;

      addLine(`Data audytu: ${formatDate(fullAudit.created_at)}`, 10);
      addLine(`Norma: ${fullAudit.norm || "PN-ISO 45001:2018"}`, 10);
      y += 3;

      addSection("Podsumowanie");
      addLine(`Wynik zgodnosci: ${fullAudit.compliance_score}%`, 12, "bold");
      addLine(`Status: ${fullAudit.status}`, 11);
      addLine(`Poziom ryzyka: ${fullAudit.risk_level.toUpperCase()}`, 11);

      const hazards = fullAudit.hazards ?? [];
      if (hazards.length > 0) {
        addSection("Wykryte zagrozenia");
        hazards.forEach((h: Hazard, i: number) => {
          const sev =
            SEVERITY_CONFIG[h.severity?.toLowerCase()]?.label || h.severity;
          addLine(`${i + 1}. ${h.name} [${sev}]`);
        });
      }

      const nonCompliances = fullAudit.non_compliances ?? [];
      if (nonCompliances.length > 0) {
        addSection("Niezgodnosci");
        nonCompliances.forEach((item: string, i: number) => {
          addLine(`${i + 1}. ${item}`);
        });
      }

      const recommendations = fullAudit.recommendations ?? [];
      if (recommendations.length > 0) {
        addSection("Zalecenia");
        recommendations.forEach((item: string, i: number) => {
          addLine(`${i + 1}. ${item}`);
        });
      }

      const isoClauses = fullAudit.iso_clauses ?? [];
      if (isoClauses.length > 0) {
        addSection("Klauzule ISO");
        addLine(isoClauses.join(", "));
      }

      y = 285;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Wygenerowano przez Smart Safety Auditor", margin, y);

      doc.save(`raport-BHP-${fullAudit.id}.pdf`);
    } catch (err) {
      console.error("Błąd eksportu PDF:", err);
      alert("Nie udało się wygenerować PDF. Spróbuj ponownie.");
    } finally {
      setExportingId(null);
    }
  };

  if (loading && !refreshing) {
    return (
      <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
        <div className={styles.center}>
          <div className={styles.spinner}></div>
          <p style={{ color: colors.textMuted, marginTop: 12 }}>
            Ładowanie historii...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.safe} style={{ backgroundColor: colors.bg }}>
      <div className={styles.topBar} style={{ borderColor: colors.border }}>
        <h1 className={styles.title} style={{ color: colors.text }}>
          Historia audytów
        </h1>
        <div className={styles.topRight}>
          <span className={styles.count} style={{ color: colors.textMuted }}>
            {audits.length} wpisów
          </span>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ color: colors.accent }}
          >
            {refreshing ? "..." : "↻"}
          </button>
        </div>
      </div>

      <div className={styles.listContainer}>
        {audits.length === 0 ? (
          <div className={styles.empty}>
            <span style={{ fontSize: 64 }}>📋</span>
            <h2 className={styles.emptyTitle} style={{ color: colors.text }}>
              Brak audytów
            </h2>
            <p className={styles.emptySub} style={{ color: colors.textMuted }}>
              Wykonaj pierwszą inspekcję BHP!
            </p>
          </div>
        ) : (
          audits.map((item) => {
            const statusColor = STATUS_COLOR[item.status] || colors.textMuted;
            const riskIcon = RISK_ICON[item.risk_level?.toLowerCase()] || "⚪";
            const scoreColor =
              item.compliance_score >= 80
                ? "#2ed573"
                : item.compliance_score >= 50
                  ? "#ffa502"
                  : "#ff4757";

            return (
              <div
                key={item.id}
                className={styles.card}
                style={{
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                }}
              >
                <div
                  className={styles.cardContent}
                  onClick={() =>
                    navigate("/analysis-result", { state: { result: item } })
                  }
                >
                  <div className={styles.cardTop}>
                    <div className={styles.cardLeft}>
                      <p
                        className={styles.cardId}
                        style={{ color: colors.text }}
                      >
                        Audyt #{item.id}
                      </p>
                      <p
                        className={styles.cardDate}
                        style={{ color: colors.textMuted }}
                      >
                        {formatDate(item.created_at)}
                      </p>
                      <p
                        className={styles.cardNorm}
                        style={{ color: colors.accent }}
                      >
                        {item.norm || "PN-ISO 45001"}
                      </p>
                    </div>
                    <div className={styles.cardRight}>
                      <span
                        className={styles.score}
                        style={{ color: scoreColor }}
                      >
                        {item.compliance_score}%
                      </span>
                    </div>
                  </div>

                  <div
                    className={styles.cardBottom}
                    style={{ borderColor: colors.border + "50" }}
                  >
                    <div
                      className={styles.statusBadge}
                      style={{
                        backgroundColor: statusColor + "15",
                        borderColor: statusColor + "40",
                      }}
                    >
                      <span
                        className={styles.statusText}
                        style={{ color: statusColor }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <span
                      className={styles.riskText}
                      style={{ color: colors.textSecondary }}
                    >
                      {riskIcon} {item.risk_level}
                    </span>
                  </div>
                </div>

                <button
                  className={styles.pdfBtn}
                  onClick={(e) => exportPDF(e, item)}
                  disabled={exportingId === item.id}
                  style={{
                    backgroundColor: colors.accentLight,
                    borderColor: colors.accent,
                    color: colors.accent,
                    opacity: exportingId === item.id ? 0.5 : 1,
                  }}
                >
                  {exportingId === item.id ? "⏳" : "📄 PDF"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
