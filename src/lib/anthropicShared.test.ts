import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./anthropicShared";

const res = (status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({}), { status, headers });

describe("fetchWithRetry", () => {
  it("tenta de novo em 529/503 e devolve a primeira resposta ok", async () => {
    const doFetch = vi.fn().mockResolvedValueOnce(res(529)).mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const r = await fetchWithRetry(doFetch, { sleep, retries: 3 });
    expect(r.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("não repete erro de cliente (400/401) e devolve a resposta pra quem chamou tratar", async () => {
    const doFetch = vi.fn().mockResolvedValue(res(400));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const r = await fetchWithRetry(doFetch, { sleep, retries: 3 });
    expect(r.status).toBe(400);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("respeita retry-after em 429 e para depois de esgotar as tentativas", async () => {
    const doFetch = vi.fn().mockResolvedValue(res(429, { "retry-after": "2" }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const r = await fetchWithRetry(doFetch, { sleep, retries: 2 });
    expect(r.status).toBe(429);
    expect(doFetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("não tenta de novo quando a requisição foi abortada", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const doFetch = vi.fn().mockRejectedValue(abort);
    await expect(fetchWithRetry(doFetch, { sleep: vi.fn(), retries: 3 })).rejects.toBe(abort);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });
});
