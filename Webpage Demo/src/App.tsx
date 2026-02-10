import { NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./homePage";
import FlamegraphPage from "./flameGraph";

export default function App() {
  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        

        <nav style={styles.nav}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.linkActive : null),
            })}
          >
            Home
          </NavLink>

          <NavLink
            to="/flamegraph"
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.linkActive : null),
            })}
          >
            Flamegraph
          </NavLink>
        </nav>
      </header>

      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/flamegraph" element={<FlamegraphPage />} />
        </Routes>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "#0b1020",
    color: "#e8eaf0",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    display: "grid",
    gridTemplateRows: "56px 1fr",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  brand: { fontWeight: 900, letterSpacing: 0.2 },
  nav: { display: "flex", gap: 10 },
  link: {
    padding: "8px 10px",
    borderRadius: 10,
    textDecoration: "none",
    color: "#e8eaf0",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },
  linkActive: {
    border: "1px solid rgba(56,189,248,0.55)",
    background: "rgba(56,189,248,0.12)",
  },
  main: { position: "relative" },
};
