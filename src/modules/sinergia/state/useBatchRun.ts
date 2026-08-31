/**
 * Lote de chamadas de IA com as três coisas que faltavam: custo estimado
 * ANTES, progresso DURANTE e cancelamento a qualquer momento.
 *
 * Quem chama passa `run(step, isCancelled)`: chama `step()` a cada unidade
 * concluída e consulta `isCancelled()` antes de gastar a próxima chamada.
 */
import { useCallback, useRef, useState } from "react";
import { estimateBatch } from "../lib/batchCost";

export function useBatchRun() {
  const [pending, setPending] = useState<any>(null); // { label, calls, kind, estimate, run }
  const [progress, setProgress] = useState<any>(null); // { done, total }
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cancelRef = useRef(false);

  /**
   * `units` é o que aparece no progresso (itens, pares); `calls` é o que custa
   * dinheiro (o que não veio do cache). Lote de custo zero — tudo em cache —
   * roda direto, sem pedir confirmação de um gasto que não existe.
   */
  const request = useCallback(async ({ label, units, calls, kind = "rating", run }: any) => {
    setError(null);
    setNote(null);
    const total = units ?? calls;
    if (!calls) {
      await execute(run, total);
      return;
    }
    const estimate = await estimateBatch(calls, kind);
    setPending({ label, units: total, calls, kind, estimate, run });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function execute(run: any, total: number) {
    cancelRef.current = false;
    setProgress({ done: 0, total });
    let done = 0;
    try {
      await run(
        () => {
          done += 1;
          setProgress({ done, total });
        },
        () => cancelRef.current
      );
      if (cancelRef.current) setNote(`Cancelado depois de ${done} de ${total}.`);
    } catch (err: any) {
      setError(err.message || "Não foi possível concluir o lote.");
    } finally {
      setProgress(null);
      cancelRef.current = false;
    }
  }

  const dismiss = useCallback(() => {
    setPending(null);
    setError(null);
    setNote(null);
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const confirm = useCallback(async () => {
    if (!pending) return;
    const { run, units } = pending;
    setPending(null);
    await execute(run, units);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return { pending, progress, error, note, request, confirm, cancel, dismiss, setError };
}
