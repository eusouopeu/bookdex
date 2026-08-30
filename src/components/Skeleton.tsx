import { COLORS } from "../theme";

const shimmerKeyframes = `@keyframes skeletonShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`;

function Bar({ width, height = "10px", style }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: "4px",
        background: "linear-gradient(90deg, #e2e0d6 25%, #efeee5 37%, #e2e0d6 63%)",
        backgroundSize: "400% 100%",
        animation: "skeletonShimmer 1.4s ease infinite",
        ...style,
      }}
    />
  );
}

/** Card fantasma no formato do TechCard, usado enquanto o resultado carrega. */
export function TechCardSkeleton() {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `2px solid ${COLORS.screenBorder}`,
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "10px",
      }}
    >
      <Bar width="40px" height="8px" style={{ marginBottom: "6px" }} />
      <Bar width="65%" height="15px" style={{ marginBottom: "8px" }} />
      <Bar width="70px" height="16px" style={{ borderRadius: "999px", marginBottom: "10px" }} />
      <Bar width="100%" height="10px" style={{ marginBottom: "5px" }} />
      <Bar width="85%" height="10px" style={{ marginBottom: "10px" }} />
      <Bar width="100%" height="8px" style={{ marginBottom: "5px" }} />
      <Bar width="100%" height="8px" style={{ marginBottom: "5px" }} />
      <Bar width="60%" height="8px" />
    </div>
  );
}

export function GuideSkeleton() {
  return (
    <div>
      <style>{shimmerKeyframes}</style>
      <Bar width="100%" height="11px" style={{ marginBottom: "5px" }} />
      <Bar width="80%" height="11px" style={{ marginBottom: "18px" }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <Bar key={i} width="100%" height="44px" style={{ borderRadius: "10px", marginBottom: "8px" }} />
      ))}
    </div>
  );
}

export default function SkeletonList({ count = 3 }) {
  return (
    <div>
      <style>{shimmerKeyframes}</style>
      <Bar width="55%" height="17px" style={{ marginBottom: "8px" }} />
      <Bar width="90%" height="11px" style={{ marginBottom: "16px" }} />
      {Array.from({ length: count }).map((_, i) => (
        <TechCardSkeleton key={i} />
      ))}
    </div>
  );
}
