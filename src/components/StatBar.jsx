import { COLORS } from "../theme";

export default function StatBar({ label, value, color }) {
  const v = value || 0;
  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "9.5px",
          color: COLORS.ink,
          width: "78px",
          flexShrink: 0,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            style={{
              width: "14px",
              height: "8px",
              borderRadius: "2px",
              background: n <= v ? color.bg : "transparent",
              border: `1.5px solid ${n <= v ? color.bg : COLORS.screenBorder}`,
              opacity: n <= v ? 1 : 0.35,
            }}
          />
        ))}
      </div>
    </div>
  );
}
