import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { colors } = useTheme();
  const { user } = useAuth();

  if (!user) return null; // nie pokazuj navbaru na login/register

  const navItems = [
    { path: "/", label: "Audyt", icon: "📷" },
    { path: "/history", label: "Historia", icon: "📋" },
    { path: "/settings", label: "Ustawienia", icon: "⚙️" },
  ];

  return (
    <nav
      className={styles.navbar}
      style={{
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
      }}
    >
      <div className={styles.container}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ""}`
            }
            style={({ isActive }) => ({
              color: isActive ? colors.accent : colors.textMuted,
            })}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}