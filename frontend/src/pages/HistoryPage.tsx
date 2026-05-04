import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  apiGetHistory,
  apiGetAuditDetails,
  apiGetFacilities,
} from "../services/api";
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
  facility_id?: number;
  facility_name?: string;
  hazards?: Hazard[];
  recommendations?: string[];
  non_compliances?: string[];
  iso_clauses?: string[];
}
interface Facility {
  id: number;
  name: string;
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
    return new Date(iso).toLocaleDateString("pl-PL", {
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

function formatDateLong(iso: string) {
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

export default function HistoryPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filterFacility, setFilterFacility] = useState<number | null>(null);
  const [filterRisk, setFilterRisk] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!user?.user_id) return;
      if (!silent) setLoading(true);
      try {
        const [data, facs] = await Promise.all([
          apiGetHistory(user.user_id, {
            facility_id: filterFacility,
            risk_level: filterRisk || undefined,
            date_from: filterDateFrom || undefined,
            date_to: filterDateTo || undefined,
          }),
          apiGetFacilities(user.user_id),
        ]);
        setAudits(data);
        setFacilities(facs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.user_id, filterFacility, filterRisk, filterDateFrom, filterDateTo],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const resetFilters = () => {
    setFilterFacility(null);
    setFilterRisk("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const exportPDF = async (e: React.MouseEvent, audit: AuditRow) => {
    e.stopPropagation();
    setExportingId(audit.id);
    try {
      const fullAudit: any = await apiGetAuditDetails(audit.id);

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
      const scoreColor =
        fullAudit.compliance_score >= 80
          ? "#2ed573"
          : fullAudit.compliance_score >= 50
            ? "#ffa502"
            : "#ff4757";

      await addSectionToPDF(`
        <div style="margin-bottom: 20px;">
          ${fullAudit.facility_logo ? `<img src="data:image/png;base64,${fullAudit.facility_logo}" style="width: 60px; height: 60px; object-fit: contain; float: left; margin-right: 15px;" />` : ""}
          <h1 style="color: #0e87c7; font-size: 28px; margin: 0 0 10px 0;">Raport BHP #${fullAudit.id}</h1>
          <p style="margin: 5px 0; font-size: 14px;">Data: ${formatDateLong(fullAudit.created_at)}</p>
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
              <td style="padding: 15px; text-align: center; font-size: 18px; font-weight: bold; color: ${scoreColor}; border: 1px solid #ddd;">${fullAudit.compliance_score}%</td>
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
            ${fullAudit.hazards.map((h: Hazard) => `<li>${h.name} [${SEVERITY_CONFIG[h.severity?.toLowerCase()]?.label || h.severity}]</li>`).join("")}
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
      alert("Nie udało się wygenerować PDF.");
    } finally {
      setExportingId(null);
    }
  };

  const activeFiltersCount = [
    filterFacility,
    filterRisk,
    filterDateFrom,
    filterDateTo,
  ].filter(Boolean).length;

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
            onClick={() => setShowFilters((s) => !s)}
            style={{
              padding: "4px 12px",
              borderRadius: 8,
              border: `1px solid ${activeFiltersCount > 0 ? colors.accent : colors.border}`,
              backgroundColor:
                activeFiltersCount > 0 ? colors.accentLight : colors.bgCard,
              color:
                activeFiltersCount > 0 ? colors.accent : colors.textSecondary,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🔍 Filtry{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
          </button>
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

      {showFilters && (
        <div
          style={{
            backgroundColor: colors.bgCard,
            borderBottom: `1px solid ${colors.border}`,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {facilities.length > 0 && (
            <div>
              <label
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ZAKŁAD
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginTop: 4,
                }}
              >
                <button
                  onClick={() => setFilterFacility(null)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    fontSize: 13,
                    border: `1px solid ${!filterFacility ? colors.accent : colors.border}`,
                    backgroundColor: !filterFacility
                      ? colors.accentLight
                      : colors.bgSecondary,
                    color: !filterFacility
                      ? colors.accent
                      : colors.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  Wszystkie
                </button>
                {facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterFacility(f.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      fontSize: 13,
                      border: `1px solid ${filterFacility === f.id ? colors.accent : colors.border}`,
                      backgroundColor:
                        filterFacility === f.id
                          ? colors.accentLight
                          : colors.bgSecondary,
                      color:
                        filterFacility === f.id
                          ? colors.accent
                          : colors.textSecondary,
                      cursor: "pointer",
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              POZIOM RYZYKA
            </label>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 4,
              }}
            >
              {["", "niskie", "średnie", "wysokie", "krytyczne"].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRisk(r)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    fontSize: 13,
                    border: `1px solid ${filterRisk === r ? colors.accent : colors.border}`,
                    backgroundColor:
                      filterRisk === r
                        ? colors.accentLight
                        : colors.bgSecondary,
                    color:
                      filterRisk === r ? colors.accent : colors.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  {r ? `${RISK_ICON[r]} ${r}` : "Wszystkie"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                OD
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.bgSecondary,
                  color: colors.text,
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                DO
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.bgSecondary,
                  color: colors.text,
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${colors.danger}`,
                backgroundColor: "transparent",
                color: colors.danger,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              Resetuj filtry
            </button>
          )}
        </div>
      )}

      <div className={styles.listContainer}>
        {audits.length === 0 ? (
          <div className={styles.empty}>
            <span style={{ fontSize: 64 }}>📋</span>
            <h2 className={styles.emptyTitle} style={{ color: colors.text }}>
              Brak audytów
            </h2>
            <p className={styles.emptySub} style={{ color: colors.textMuted }}>
              {activeFiltersCount > 0 ? "Zmień filtry lub" : ""} Wykonaj
              pierwszą inspekcję BHP!
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
                <div className={styles.cardContent}>
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
                      {item.facility_name && (
                        <p
                          style={{
                            color: colors.textMuted,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          🏭 {item.facility_name}
                        </p>
                      )}
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

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "0 16px 16px 16px",
                  }}
                >
                  <button
                    onClick={() =>
                      navigate("/analysis-result", { state: { result: item } })
                    }
                    style={{
                      flex: 1,
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.textSecondary,
                      padding: "10px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Szczegóły
                  </button>
                  <button
                    className={styles.pdfBtn}
                    onClick={(e) => exportPDF(e, item)}
                    disabled={exportingId === item.id}
                    style={{
                      flex: 1,
                      backgroundColor: colors.accentLight,
                      borderColor: colors.accent,
                      color: colors.accent,
                      opacity: exportingId === item.id ? 0.5 : 1,
                      padding: "10px",
                      borderRadius: 8,
                      border: `1px solid ${colors.accent}`,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {exportingId === item.id ? "⏳" : "📄 PDF"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
