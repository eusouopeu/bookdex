import { render } from "@testing-library/react";
import { DataProvider } from "../state/DataContext";
import { PrefsProvider } from "../state/PrefsContext";

/**
 * Renderiza uma view dentro do DataProvider real (com o storage já mockado
 * pelo teste), que é como ela roda no app — em vez de injetar um contexto
 * falso que não pega quebra de contrato entre provider e view.
 */
export function renderWithData(ui, options) {
  return render(ui, {
    wrapper: ({ children }) => (
      <DataProvider>
        <PrefsProvider>{children}</PrefsProvider>
      </DataProvider>
    ),
    ...options,
  });
}
