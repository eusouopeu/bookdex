/**
 * Estado do fluxo de busca (aba Buscar) num reducer só, em vez de meia dúzia
 * de `useState` soltos no App. Cada transição do fluxo — digitar, disparar,
 * receber resultado, falhar — vira uma ação nomeada, o que torna o fluxo
 * testável sem renderizar nada.
 */
export const initialSearchState = {
  query: "",
  criteria: "",
  mode: "technique",
  loading: false,
  error: null,
  needsKey: false,
  result: null,
  scanCount: 0,
};

export function searchReducer(state, action) {
  switch (action.type) {
    case "setQuery":
      return { ...state, query: action.query };
    case "setCriteria":
      return { ...state, criteria: action.criteria };
    case "setMode":
      return { ...state, mode: action.mode };
    case "start":
      return {
        ...state,
        mode: action.mode ?? state.mode,
        query: action.term ?? state.query,
        loading: true,
        error: null,
        needsKey: false,
      };
    case "success":
      // `source` diz de onde veio o resultado ("network", "cache", "saved",
      // "saved-similar") — a view usa isso pra avisar que não gastou chamada e
      // pra oferecer refazer a busca.
      return {
        ...state,
        query: action.term ?? state.query,
        mode: action.mode ?? state.mode,
        loading: false,
        error: null,
        needsKey: false,
        result: { mode: action.mode, data: action.data, source: action.source || "network", cacheKey: action.cacheKey || null },
        scanCount: state.scanCount + 1,
      };
    case "failure":
      return { ...state, loading: false, error: action.error };
    case "cancelled":
      return { ...state, loading: false, error: null };
    case "missingKey":
      return { ...state, loading: false, needsKey: true };
    case "clearNeedsKey":
      return { ...state, needsKey: false };
    case "queuedOffline":
      return { ...state, mode: action.mode, query: action.term, loading: false };
    case "reset":
      return initialSearchState;
    default:
      return state;
  }
}
