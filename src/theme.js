// Paleta base fixa (chrome do "aparelho": nunca muda com o tema) mais os
// tokens de conteúdo, que apontam para custom properties CSS trocadas pelo
// tema claro/escuro (ver THEME_VARS + o <style> injetado em App.jsx).
export const COLORS = {
  shellRed: "#D6293B",
  shellRedDark: "#A81F2E",
  shellRedDarker: "#7A1620",
  lensBlue: "#2E86DE",
  lensBlueLight: "#6FB8FF",
  gold: "#FFC947",
  white: "#F5F5F0",
  screenBg: "var(--screen-bg)",
  screenBorder: "var(--screen-border)",
  ink: "var(--ink)",
  surface: "var(--surface)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  textFaint: "var(--text-faint)",
  danger: "var(--danger)",
  success: "var(--success)",
  pageBg: "var(--page-bg)",
};

export const THEME_VARS = {
  light: {
    "--page-bg": "#e8e6df",
    "--screen-bg": "#CFE0C6",
    "--screen-border": "#5C6B52",
    "--ink": "#23291F",
    "--surface": "#F5F5F0",
    "--text": "#3a3a30",
    "--text-muted": "#5c6b52",
    "--text-faint": "#6b6b5c",
    "--danger": "#8a1f1f",
    "--success": "#2E7D32",
  },
  dark: {
    "--page-bg": "#111310",
    "--screen-bg": "#1b2318",
    "--screen-border": "#7c8c70",
    "--ink": "#EDEEE6",
    "--surface": "#242b20",
    "--text": "#d9d7ca",
    "--text-muted": "#a8ab9c",
    "--text-faint": "#8f9284",
    "--danger": "#ff6b6b",
    "--success": "#6bcf70",
  },
};

export const TYPE_PALETTE = [
  { bg: "#2A9D8F", text: "#FFFFFF" },
  { bg: "#E9B44C", text: "#3D2B00" },
  { bg: "#8E7CC3", text: "#FFFFFF" },
  { bg: "#F4845F", text: "#3D1400" },
  { bg: "#4A7C9E", text: "#FFFFFF" },
  { bg: "#6A9955", text: "#FFFFFF" },
  { bg: "#C2558B", text: "#FFFFFF" },
  { bg: "#6C7A89", text: "#FFFFFF" },
];

export function getTypeColor(type) {
  let hash = 0;
  const s = type || "geral";
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return TYPE_PALETTE[Math.abs(hash) % TYPE_PALETTE.length];
}

export function slug(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function tabStyle(active) {
  return {
    flex: 1,
    padding: "10px 10px",
    minHeight: "44px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontFamily: '"Baloo 2", sans-serif',
    fontWeight: 700,
    fontSize: "11.5px",
    letterSpacing: "0.02em",
    background: active ? COLORS.gold : "rgba(255,255,255,0.18)",
    color: active ? "#4A3300" : COLORS.white,
    transition: "background 0.15s ease",
  };
}

export const iconButtonStyle = {
  width: "34px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  border: "none",
  background: "rgba(255,255,255,0.18)",
  color: COLORS.white,
  cursor: "pointer",
  flexShrink: 0,
};

export const primaryButtonStyle = {
  background: COLORS.lensBlue,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "11px 16px",
  minHeight: "44px",
  fontFamily: '"Baloo 2", sans-serif',
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};
