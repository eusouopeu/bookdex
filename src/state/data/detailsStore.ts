import { useCallback, useMemo, useRef, useState } from "react";
import { slug } from "../../theme";
import { KEYS } from "../../lib/storage";
import { MODELS } from "../../lib/models";
import { persist } from "./persist";

/** Uma versão anterior de um guia, guardada quando ele é regenerado (ver `deleteDetail`). */
export interface DetailVersion {
  detail: unknown;
  model: string;
  generatedAt: number;
}

const MAX_DETAIL_VERSIONS = 5;

export interface DetailsContextValue {
  detailCache: Record<string, unknown>;
  detailHistory: Record<string, DetailVersion[]>;
  prefetchDetailsEnabled: boolean;
  changePrefetchDetails: (enabled: boolean) => void;
  hasDetail: (subjectDisplay: string, technique: any) => boolean;
  cacheDetail: (cacheKey: string, detail: unknown) => void;
  deleteDetail: (cacheKey: string) => void;
  restoreDetailVersion: (cacheKey: string, versionIndex: number) => void;
}

/**
 * Guias passo a passo (cache), histórico de versões arquivadas e a
 * preferência de baixar guias em background. `detailCacheRef`/`prefetchRef`
 * existem pro store da Pokédex consultar o valor atual sem depender dele (e
 * sem re-renderizar a Pokédex inteira toda vez que um guia chega).
 */
export function useDetailsStore() {
  const [detailCache, setDetailCache] = useState<Record<string, unknown>>({});
  const [detailHistory, setDetailHistory] = useState<Record<string, DetailVersion[]>>({});
  const [prefetchDetailsEnabled, setPrefetchDetailsEnabled] = useState(true);

  const detailCacheRef = useRef(detailCache);
  detailCacheRef.current = detailCache;
  const prefetchRef = useRef(prefetchDetailsEnabled);
  prefetchRef.current = prefetchDetailsEnabled;

  // Estável (só usa o setter funcional) — o store da Pokédex depende dela pro prefetch.
  const cacheDetail = useCallback((cacheKey: string, detail: unknown) => {
    setDetailCache((prev) => {
      const next = { ...prev, [cacheKey]: detail };
      persist(KEYS.details, next);
      return next;
    });
  }, []);

  const value = useMemo<DetailsContextValue>(() => {

    /**
     * Remove um guia do cache pra regenerar do zero — em vez de descartar o
     * guia atual, arquiva-o em `detailHistory` (limitado a
     * `MAX_DETAIL_VERSIONS`, o mais antigo cai fora) pra dar pra restaurar ou
     * comparar depois (ver DetailPage). Assume o modelo fixo de guia
     * (`MODELS.sonnet`, ver lib/models.ts) — se isso um dia virar configurável,
     * o modelo real precisa vir de quem chama.
     */
    function deleteDetail(cacheKey: string) {
      const current = detailCache[cacheKey];
      if (current !== undefined) {
        const versions = [...(detailHistory[cacheKey] || []), { detail: current, model: MODELS.sonnet, generatedAt: Date.now() }].slice(
          -MAX_DETAIL_VERSIONS
        );
        const nextHistory = { ...detailHistory, [cacheKey]: versions };
        setDetailHistory(nextHistory);
        persist(KEYS.detailHistory, nextHistory);
      }
      setDetailCache((prev) => {
        if (!(cacheKey in prev)) return prev;
        const next = { ...prev };
        delete next[cacheKey];
        persist(KEYS.details, next);
        return next;
      });
    }

    /** Restaura uma versão arquivada como o guia ativo — a que estava ativa vai pro arquivo no lugar dela. */
    function restoreDetailVersion(cacheKey: string, versionIndex: number) {
      const versions = detailHistory[cacheKey] || [];
      const version = versions[versionIndex];
      if (!version) return;

      const rest = versions.filter((_, i) => i !== versionIndex);
      const current = detailCache[cacheKey];
      const nextVersions =
        current !== undefined ? [...rest, { detail: current, model: MODELS.sonnet, generatedAt: Date.now() }].slice(-MAX_DETAIL_VERSIONS) : rest;
      const nextHistory = { ...detailHistory, [cacheKey]: nextVersions };
      setDetailHistory(nextHistory);
      persist(KEYS.detailHistory, nextHistory);

      const nextDetails = { ...detailCache, [cacheKey]: version.detail };
      setDetailCache(nextDetails);
      persist(KEYS.details, nextDetails);
    }

    return {
      detailCache,
      detailHistory,
      prefetchDetailsEnabled,
      changePrefetchDetails(enabled: boolean) {
        setPrefetchDetailsEnabled(enabled);
        persist(KEYS.prefetchDetails, enabled);
      },
      hasDetail(subjectDisplay: string, technique: any) {
        const techId = technique.id || slug(technique.name);
        return !!detailCache[`${slug(subjectDisplay)}:${techId}`];
      },
      cacheDetail,
      deleteDetail,
      restoreDetailVersion,
    };
  }, [detailCache, detailHistory, prefetchDetailsEnabled, cacheDetail]);

  return { value, cacheDetail, setDetailCache, setDetailHistory, setPrefetchDetailsEnabled, detailCacheRef, prefetchRef };
}
