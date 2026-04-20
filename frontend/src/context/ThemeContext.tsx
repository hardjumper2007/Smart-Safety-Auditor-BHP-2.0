import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";

interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgCard: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentHover: string;
  border: string;
  danger: string;
  warning: string;
  success: string;
  overlay: string;
}

interface ThemeContextType {
  isDark: boolean;
  hue: number;
  colors: ThemeColors;
  toggleTheme: () => void;
  setHue: (hue: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getColors(isDark: boolean, hue: number): ThemeColors {
  const accent = hslToHex(hue, 85, 55);
  const accentLight = hslToHex(hue, 70, isDark ? 25 : 92);
  const accentHover = hslToHex(hue, 85, 50);

  if (isDark) {
    return {
      bg: "#0a0a0f",
      bgSecondary: "#111118",
      bgCard: "#16161f",
      text: "#f0f0f8",
      textSecondary: "#b8b8cc",
      textMuted: "#66667a",
      accent,
      accentLight,
      accentHover,
      border: "#222230",
      danger: "#ff4757",
      warning: "#ffa502",
      success: "#2ed573",
      overlay: "rgba(0,0,0,0.85)",
    };
  } else {
    return {
      bg: "#f5f5fa",
      bgSecondary: "#ebebf5",
      bgCard: "#ffffff",
      text: "#0f0f1a",
      textSecondary: "#444455",
      textMuted: "#8888a0",
      accent,
      accentLight,
      accentHover,
      border: "#dddde8",
      danger: "#e53e3e",
      warning: "#dd6b20",
      success: "#38a169",
      overlay: "rgba(0,0,0,0.4)",
    };
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem("bhp_theme");
      return stored
        ? stored === "true"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return true;
    }
  });

  const [hue, setHueState] = useState(() => {
    try {
      const stored = localStorage.getItem("bhp_hue");
      const parsed = stored ? parseInt(stored) : NaN;
      return !isNaN(parsed) ? parsed : 220;
    } catch {
      return 220;
    }
  });

  const colors = useMemo(() => getColors(isDark, hue), [isDark, hue]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-bg", colors.bg);
    root.style.setProperty("--color-bg-secondary", colors.bgSecondary);
    root.style.setProperty("--color-bg-card", colors.bgCard);
    root.style.setProperty("--color-text", colors.text);
    root.style.setProperty("--color-text-secondary", colors.textSecondary);
    root.style.setProperty("--color-text-muted", colors.textMuted);
    root.style.setProperty("--color-border", colors.border);
    root.style.setProperty("--color-accent", colors.accent);
    root.style.setProperty("--color-accent-light", colors.accentLight);
    root.style.setProperty("--color-accent-hover", colors.accentHover);
    root.style.setProperty("--color-danger", colors.danger);
    root.style.setProperty("--color-warning", colors.warning);
    root.style.setProperty("--color-success", colors.success);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [colors, isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      localStorage.setItem("bhp_theme", String(next));
    } catch (e) {
      console.error("Błąd zapisu motywu:", e);
    }
  };

  const setHue = (h: number) => {
    setHueState(h);
    try {
      localStorage.setItem("bhp_hue", String(h));
    } catch (e) {
      console.error("Błąd zapisu barwy:", e);
    }
  };

  const value = useMemo(
    () => ({
      isDark,
      hue,
      colors,
      toggleTheme,
      setHue,
    }),
    [isDark, hue, colors],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme musi być używane wewnątrz ThemeProvider");
  }
  return context;
}
