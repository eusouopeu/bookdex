import { describe, expect, it } from "vitest";
import { planCareReminders } from "./careReminders";

const DAY = 24 * 60 * 60 * 1000;
// 2026-10-01 14:00 local
const NOW = new Date(2026, 9, 1, 14, 0, 0).getTime();

function savedWith(care: any, extra: any = {}) {
  return {
    lamiaceae: {
      displayName: "Lamiaceae",
      items: [{ id: "alecrim", kind: "plant", commonNames: ["Alecrim"], care, ...extra }],
    },
  } as any;
}

describe("planCareReminders", () => {
  it("agenda às 9h do dia em que a tarefa vence, com id estável", () => {
    const saved = savedWith({ water: { enabled: true, intervalDays: 3, lastDoneAt: NOW - 1 * DAY } });
    const plan = planCareReminders(saved, NOW);
    expect(plan).toHaveLength(1);
    const at = new Date(plan[0].at);
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 9, 3, 9, 0]);
    expect(plan[0].body).toContain("Alecrim");
    expect(planCareReminders(saved, NOW)[0].id).toBe(plan[0].id);
  });

  it("tarefa atrasada vira lembrete no próximo 9h (amanhã, já que hoje passou)", () => {
    const saved = savedWith({ fertilize: { enabled: true, intervalDays: 30, lastDoneAt: NOW - 40 * DAY } });
    const at = new Date(planCareReminders(saved, NOW)[0].at);
    expect([at.getMonth(), at.getDate(), at.getHours()]).toEqual([9, 2, 9]);
  });

  it("ignora tarefa desligada, nunca feita e planta arquivada", () => {
    expect(planCareReminders(savedWith({ water: { enabled: false, intervalDays: 3, lastDoneAt: NOW } }), NOW)).toEqual([]);
    expect(planCareReminders(savedWith({ water: { enabled: true, intervalDays: 3, lastDoneAt: null } }), NOW)).toEqual([]);
    expect(
      planCareReminders(savedWith({ water: { enabled: true, intervalDays: 3, lastDoneAt: NOW } }, { archived: true }), NOW)
    ).toEqual([]);
  });
});
