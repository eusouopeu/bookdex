/**
 * Parse do input de meta usado nas Coleções: "+ ressonância" (quero mais) ou
 * "- nasal" (quero menos). O sinal precisa ser o primeiro caractere não-
 * espaço; o resto (sem o sinal) é o alvo.
 */
export function parseGoalInput(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const sign = trimmed[0];
  if (sign !== "+" && sign !== "-") return null;
  const target = trimmed.slice(1).trim();
  if (!target) return null;
  return { direction: sign === "+" ? "mais" : "menos", target };
}
