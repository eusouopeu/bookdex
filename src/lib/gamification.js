/**
 * Gamificação leve: sequência de dias de uso (streak) + conquistas simples.
 * Estado persistido em storage (KEYS.gamification):
 *   { streak, longestStreak, lastVisitDate, reviewsCompleted, unlocked: [] }
 * `lastVisitDate` é uma string "AAAA-MM-DD" (fuso local) pra comparar dias
 * sem depender de horário.
 */
const DAY_MS = 86400000;

export function initGamificationState() {
  return { streak: 0, longestStreak: 0, lastVisitDate: null, reviewsCompleted: 0, unlocked: [] };
}

function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chamado uma vez por abertura do app; só muda o streak se o dia mudou. */
export function recordVisit(prevState, now = Date.now()) {
  const state = prevState || initGamificationState();
  const today = dateKey(now);
  if (state.lastVisitDate === today) return state;

  const yesterday = dateKey(now - DAY_MS);
  const isConsecutive = state.lastVisitDate === yesterday;
  const streak = isConsecutive ? state.streak + 1 : 1;
  return {
    ...state,
    streak,
    longestStreak: Math.max(state.longestStreak || 0, streak),
    lastVisitDate: today,
  };
}

export function recordReviewCompleted(prevState) {
  const state = prevState || initGamificationState();
  return { ...state, reviewsCompleted: (state.reviewsCompleted || 0) + 1 };
}

export const ACHIEVEMENTS = [
  { id: "first-capture", label: "Primeira captura", desc: "Capture seu primeiro item.", check: (s) => s.totalSaved >= 1 },
  { id: "collector-10", label: "Colecionador", desc: "Capture 10 itens.", check: (s) => s.totalSaved >= 10 },
  { id: "collector-50", label: "Grande colecionador", desc: "Capture 50 itens.", check: (s) => s.totalSaved >= 50 },
  { id: "streak-3", label: "Hábito formado", desc: "3 dias seguidos de uso.", check: (s) => s.streak >= 3 },
  { id: "streak-7", label: "Uma semana inteira", desc: "7 dias seguidos de uso.", check: (s) => s.streak >= 7 },
  { id: "streak-30", label: "Mestre da constância", desc: "30 dias seguidos de uso.", check: (s) => s.streak >= 30 },
  { id: "reviewer-10", label: "Estudante aplicado", desc: "Complete 10 revisões.", check: (s) => s.reviewsCompleted >= 10 },
  { id: "reviewer-50", label: "Memória de elefante", desc: "Complete 50 revisões.", check: (s) => s.reviewsCompleted >= 50 },
];

/** Recalcula quais conquistas estão desbloqueadas dado o estado atual + total salvo. */
export function computeUnlocked(state, totalSaved) {
  const stats = { totalSaved, streak: state.streak || 0, reviewsCompleted: state.reviewsCompleted || 0 };
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.id);
}
