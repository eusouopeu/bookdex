import { COLORS } from "../theme";

interface ToastProps {
  msg: string;
  onUndo?: () => void;
  onDismiss: () => void;
}

export default function Toast({ msg, onUndo, onDismiss }: ToastProps) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: "4px",
        left: 0,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        pointerEvents: onUndo ? "auto" : "none",
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          background: "#23291F",
          color: COLORS.white,
          padding: "8px 8px 8px 16px",
          borderRadius: "999px",
          fontSize: "12px",
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
        }}
      >
        <span>{msg}</span>
        {onUndo && (
          <button
            onClick={() => {
              onUndo();
              onDismiss();
            }}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: COLORS.gold,
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 700,
              fontSize: "11.5px",
              borderRadius: "999px",
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Desfazer
          </button>
        )}
      </div>
    </div>
  );
}
