import { useEffect, useRef, useState } from "react";

export default function PokeballIcon({ filled, size = 24 }) {
  const topColor = filled ? "#EB4B4B" : "#D8D8CC";
  const [bounce, setBounce] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setBounce(true);
    const id = setTimeout(() => setBounce(false), 320);
    return () => clearTimeout(id);
  }, [filled]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        transform: bounce ? "scale(1.28)" : "scale(1)",
        transition: bounce ? "transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)" : "transform 0.18s ease-out",
      }}
    >
      <circle cx="12" cy="12" r="10" fill="#F5F5F0" stroke="#23291F" strokeWidth="1.5" />
      <path d="M 2 12 A 10 10 0 0 1 22 12 Z" fill={topColor} stroke="#23291F" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="1.2" y="11" width="21.6" height="2" fill="#23291F" />
      <circle cx="12" cy="12" r="3.4" fill="#F5F5F0" stroke="#23291F" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.3" fill={filled ? "#EB4B4B" : "#B9B9AA"} />
    </svg>
  );
}
