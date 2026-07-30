export const COLORS = {
  shellRed: "#D6293B",
  shellRedDark: "#A81F2E",
  shellRedDarker: "#7A1620",
  lensBlue: "#2E86DE",
  lensBlueLight: "#6FB8FF",
  screenBg: "#CFE0C6",
  screenBorder: "#5C6B52",
  ink: "#23291F",
  gold: "#FFC947",
  white: "#F5F5F0",
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
