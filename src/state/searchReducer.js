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
      return {
        ...state,
        loading: false,
        error: null,
        needsKey: false,
        result: { mode: action.mode, data: action.data },
        scanCount: state.scanCount + 1,
      };
    case "failure":
      return { ...state, loading: false, error: action.error };
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
