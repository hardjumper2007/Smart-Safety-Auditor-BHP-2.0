import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiGetHistory } from "../services/api";
import styles from "./HistoryPage.module.css";

interface AuditRow {
  id: number;
  created_at: string;
  norm: string;
  status: string;
  compliance_score: number;
  risk_level: string;
  hazards?: any[];
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

  const load = useCallback(
    async (silent = false) => {
      if (!user?.user_id) return;
      if (!silent) setLoading(true);

      try {
        const data = await apiGetHistory(user.user_id);
        const sortedData = data.sort(
          (a: AuditRow, b: AuditRow) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAudits(sortedData);
      } catch (e) {
        console.error("Błąd pobierania historii:", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.user_id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading &&!refreshing) {
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
            {refreshing? "..." : "↻"}
          </button>
        </div>
      </div>

      <div className={styles.listContainer}>
        {audits.length === 0? (
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
              <button
                key={item.id}
                className={styles.card}
                style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}
                onClick={() =>
                  navigate("/analysis-result", { state: { result: item } })
                }
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <p className={styles.cardId} style={{ color: colors.text }}>
                      Audyt #{item.id}
                    </p>
                    <p className={styles.cardDate} style={{ color: colors.textMuted }}>
                      {formatDate(item.created_at)}
                    </p>
                    <p className={styles.cardNorm} style={{ color: colors.accent }}>
                      {item.norm || "PN-ISO 45001"}
                    </p>
                  </div>
                  <div className={styles.cardRight}>
                    <span className={styles.score} style={{ color: scoreColor }}>
                      {item.compliance_score}%
                    </span>
                  </div>
                </div>

                <div className={styles.cardBottom} style={{ borderColor: colors.border + "50" }}>
                  <div
                    className={styles.statusBadge}
                    style={{
                      backgroundColor: statusColor + "15",
                      borderColor: statusColor + "40",
                    }}
                  >
                    <span className={styles.statusText} style={{ color: statusColor }}>
                      {item.status}
                    </span>
                  </div>
                  <span className={styles.riskText} style={{ color: colors.textSecondary }}>
                    {riskIcon} {item.risk_level}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}