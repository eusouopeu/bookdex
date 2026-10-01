import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Toast global (mensagem curta + "desfazer" opcional). Vive num contexto
 * próprio porque quase toda operação de dados dispara um toast, mas só o
 * App desenha o toast — separado, mostrar/esconder não re-renderiza quem
 * consome os dados.
 */
export interface ToastState {
  msg: string;
  onUndo?: () => void;
}

export interface ToastContextValue {
  toast: ToastState | null;
  showToast: (msg: string, onUndo?: () => void) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() precisa estar dentro de <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((msg: string, onUndo?: () => void) => {
    setToast({ msg, onUndo });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), onUndo ? 4000 : 2200);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo(() => ({ toast, showToast, dismissToast }), [toast, showToast, dismissToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
