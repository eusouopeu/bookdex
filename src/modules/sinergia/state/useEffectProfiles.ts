/**
 * Estado dos perfis de efeito.
 *
 * `storage` precisa expor `getJSON(key, fallback)` e `setJSON(key, value)` —
 * ver `src/lib/storage.js`. A chave usada é `STORAGE_KEY` = "effect-profiles".
 */
import { useEffect, useState } from "react";
import { createProfileId, createCriterionId, createItemId, clampRating, initEffectProfiles, buildItem, currentVariantIndex } from "../lib/effectProfiles";
import { migrateProfiles, SCHEMA_VERSION } from "../lib/migrate";
import { createCheckIn } from "../lib/checkins";

export const STORAGE_KEY = "effect-profiles";

export function useEffectProfiles(storage: any, showToast: (msg: string) => void = () => {}) {
  const [profiles, setProfiles] = useState<Record<string, any>>(initEffectProfiles());
  // `profiles` começa vazio até o storage carregar — quem precisa achar um
  // perfil por nome (ver ponte com o Cognidex em SinergiaModule) não pode
  // fazer essa busca antes de `loaded`, ou nunca vai achar o que já existe.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Dado antigo é normalizado UMA vez aqui (ver lib/migrate.js) — daqui pra
      // baixo o app pode assumir a forma completa, sem defensiva espalhada.
      const stored = await storage.getJSON(STORAGE_KEY, initEffectProfiles());
      const migrated = migrateProfiles(stored);
      setProfiles(migrated);
      setLoaded(true);
      if (JSON.stringify(migrated) !== JSON.stringify(stored)) storage.setJSON(STORAGE_KEY, migrated).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: Record<string, any>) {
    storage.setJSON(STORAGE_KEY, next).catch(() => {});
  }

  function createProfile(name: string) {
    const clean = (name || "").trim();
    if (!clean) return null;
    const id = createProfileId();
    setProfiles((prev) => {
      const next = {
        ...prev,
        [id]: {
          id,
          schemaVersion: SCHEMA_VERSION,
          name: clean,
          createdAt: Date.now(),
          criteria: [],
          items: [],
          interactions: {},
          comparisons: {},
          criteriaLinks: {},
          checkins: [],
          saturation: false,
        },
      };
      persist(next);
      return next;
    });
    showToast(`Perfil "${clean}" criado.`);
    return id;
  }

  function renameProfile(profileId: string, name: string) {
    const clean = (name || "").trim();
    if (!clean) return;
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const next = { ...prev, [profileId]: { ...profile, name: clean } };
      persist(next);
      return next;
    });
  }

  function deleteProfile(id: string) {
    setProfiles((prev) => {
      const profile = prev[id];
      if (!profile) return prev;
      const next = { ...prev };
      delete next[id];
      persist(next);
      return next;
    });
  }

  function addCriterion(profileId: string, label: string) {
    const clean = (label || "").trim();
    if (!clean) return;
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      if (profile.criteria.some((c: any) => c.label.toLowerCase() === clean.toLowerCase())) return prev;
      const id = createCriterionId(profile.criteria.map((c: any) => c.id), clean);
      const next = { ...prev, [profileId]: { ...profile, criteria: [...profile.criteria, { id, label: clean, weight: 1, hidden: false }] } };
      persist(next);
      return next;
    });
  }

  function renameCriterion(profileId: string, criterionId: string, label: string) {
    const clean = (label || "").trim();
    if (!clean) return;
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteria = profile.criteria.map((c: any) => (c.id === criterionId ? { ...c, label: clean } : c));
      const next = { ...prev, [profileId]: { ...profile, criteria } };
      persist(next);
      return next;
    });
  }

  function setCriterionWeight(profileId: string, criterionId: string, weight: number) {
    const w = Math.max(0, Math.min(3, Math.round(Number(weight) || 0)));
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteria = profile.criteria.map((c: any) => (c.id === criterionId ? { ...c, weight: w } : c));
      const next = { ...prev, [profileId]: { ...profile, criteria } };
      persist(next);
      return next;
    });
  }

  /** Ocultar um critério tira ele dos cards e da barra do efeito combinado, mas ele continua existindo (e contando no score). Agora mora no perfil, não na tela. */
  function setCriterionHidden(profileId: string, criterionId: string, hidden: boolean) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteria = profile.criteria.map((c: any) => (c.id === criterionId ? { ...c, hidden: !!hidden } : c));
      const next = { ...prev, [profileId]: { ...profile, criteria } };
      persist(next);
      return next;
    });
  }

  /** Saturação (retornos decrescentes) do efeito combinado deste perfil — ver `saturate` em lib/effectProfiles.js. */
  function setProfileSaturation(profileId: string, saturation: boolean) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const next = { ...prev, [profileId]: { ...profile, saturation: !!saturation } };
      persist(next);
      return next;
    });
  }

  /** Registro do resultado observado de fato, com o previsto congelado junto (ver lib/checkins.js). */
  function addCheckIn(profileId: string, observed: any, note: string) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const checkins = [...(profile.checkins || []), createCheckIn(profile, observed, note)];
      const next = { ...prev, [profileId]: { ...profile, checkins } };
      persist(next);
      return next;
    });
    showToast("Check-in registrado.");
  }

  function removeCheckIn(profileId: string, checkInId: string) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const checkins = (profile.checkins || []).filter((ci: any) => ci.id !== checkInId);
      const next = { ...prev, [profileId]: { ...profile, checkins } };
      persist(next);
      return next;
    });
  }

  /** Remove um critério do perfil e de TODAS as variantes de TODOS os itens. */
  function removeCriterion(profileId: string, criterionId: string) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteria = profile.criteria.filter((c: any) => c.id !== criterionId);
      const dropKey = (obj: any) => {
        if (!obj) return obj;
        const next = { ...obj };
        delete next[criterionId];
        return next;
      };
      const items = profile.items.map((it: any) => ({
        ...it,
        ratings: (it.ratings || []).map(dropKey),
        originalRatings: (it.originalRatings || []).map(dropKey),
        reasons: (it.reasons || []).map(dropKey),
        explainCache: (it.explainCache || []).map(dropKey),
      }));
      const next = { ...prev, [profileId]: { ...profile, criteria, items } };
      persist(next);
      return next;
    });
  }

  /**
   * Adiciona um item já pronto — sem tela de rascunho, ele entra salvo no
   * perfil direto. `variantLabels`/`ratings`/`reasons`/`aiEvaluated` vêm de
   * `buildItem` (lib/effectProfiles.js): quem chama monta o item pronto e só
   * passa pra cá.
   */
  function addItem(profileId: string, { name, variantLabels, ratings, reasons, aiEvaluated, ratingMeta }: any) {
    const clean = (name || "").trim();
    if (!clean) return null;
    let newId: string | null = null;
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const id = createItemId(profile.items.map((it: any) => it.id), clean);
      newId = id;
      const item = buildItem(id, clean, { variantLabels, ratings, reasons, aiEvaluated, ratingMeta });
      const next = { ...prev, [profileId]: { ...profile, items: [...profile.items, item] } };
      persist(next);
      return next;
    });
    showToast(`"${clean}" adicionado(a) ao perfil.`);
    return newId;
  }

  function updateItems(profileId: string, mutate: (items: any[]) => any[]) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const next = { ...prev, [profileId]: { ...profile, items: mutate(profile.items) } };
      persist(next);
      return next;
    });
  }

  function updateOneItem(profileId: string, itemId: string, mutate: (item: any) => any) {
    updateItems(profileId, (items) => items.map((it) => (it.id === itemId ? mutate(it) : it)));
  }

  function renameItem(profileId: string, itemId: string, name: string) {
    const clean = (name || "").trim();
    if (!clean) return;
    updateOneItem(profileId, itemId, (it) => ({ ...it, name: clean }));
  }

  /** Preenche a nota de UM critério (via IA ou manual) numa variante específica — usado pro "avaliar item(ns) neste critério" quando um critério novo é criado e itens antigos ficam sem nota nele. */
  function fillCriterionForItem(profileId: string, itemId: string, variantIndex: number, criterionId: string, value: number, reason?: string) {
    updateOneItem(profileId, itemId, (it) => {
      const v = clampRating(value);
      const ratings = it.ratings.map((r: any, i: number) => (i === variantIndex ? { ...r, [criterionId]: v } : r));
      const originalRatings = it.originalRatings.map((r: any, i: number) => (i === variantIndex ? { ...r, [criterionId]: v } : r));
      const reasons = it.reasons.map((r: any, i: number) => (i === variantIndex ? { ...r, [criterionId]: reason || "" } : r));
      return { ...it, ratings, originalRatings, reasons };
    });
  }

  /** Guarda (ou substitui) o ajuste de interação detectado entre um par de itens ativos. */
  function setInteraction(profileId: string, key: string, itemAId: string, itemBId: string, adjustments: any, reasons?: any) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const interactions = { ...(profile.interactions || {}), [key]: { itemAId, itemBId, adjustments, reasons: reasons || {} } };
      const next = { ...prev, [profileId]: { ...profile, interactions } };
      persist(next);
      return next;
    });
  }

  function removeInteraction(profileId: string, key: string) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const interactions = { ...(profile.interactions || {}) };
      delete interactions[key];
      const next = { ...prev, [profileId]: { ...profile, interactions } };
      persist(next);
      return next;
    });
  }

  /** Cache (por par de itens) das explicações geradas sob demanda na aba Comparar: mecanismo, veredito e "escolha se". */
  function setComparisonCache(profileId: string, key: string, patch: any) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const comparisons = { ...(profile.comparisons || {}) };
      comparisons[key] = { ...(comparisons[key] || {}), ...patch };
      const next = { ...prev, [profileId]: { ...profile, comparisons } };
      persist(next);
      return next;
    });
  }

  /** Metadados da aresta item->critério (probabilidade, confiança, latência, duração, reversibilidade). Sem `variantIndex`, usa a variante atual do item. */
  function setRatingMeta(profileId: string, itemId: string, criterionId: string, patch: any, variantIndex?: number) {
    updateOneItem(profileId, itemId, (it) => {
      const idx = variantIndex ?? currentVariantIndex(it);
      const ratingMeta = (it.ratingMeta || it.ratings.map(() => ({}))).map((m: any, i: number) =>
        i === idx ? { ...m, [criterionId]: { ...(m[criterionId] || {}), ...patch } } : m
      );
      return { ...it, ratingMeta };
    });
  }

  /** Ligação causal critério->critério (chave direcional, ver `criterionLinkKey`). */
  function setCriterionLink(profileId: string, key: string, fromId: string, toId: string, patch: any) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteriaLinks = { ...(profile.criteriaLinks || {}) };
      criteriaLinks[key] = {
        ...(criteriaLinks[key] || { fromId, toId, magnitude: 0, probability: "provavel", confidence: "mecanismo", latency: "dias", duration: "persiste", reversible: true, reason: "" }),
        ...patch,
        fromId,
        toId,
      };
      const next = { ...prev, [profileId]: { ...profile, criteriaLinks } };
      persist(next);
      return next;
    });
  }

  function removeCriterionLink(profileId: string, key: string) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteriaLinks = { ...(profile.criteriaLinks || {}) };
      delete criteriaLinks[key];
      const next = { ...prev, [profileId]: { ...profile, criteriaLinks } };
      persist(next);
      return next;
    });
  }

  /** Protocolo de uso do item: intensidade/dose, frequência, duração, ordem e melhor momento. */
  function setItemProtocol(profileId: string, itemId: string, protocol: any) {
    updateOneItem(profileId, itemId, (it) => ({ ...it, protocol }));
  }

  /** Sinais de que o uso do item está indo bem ou precisa de ajuste. */
  function setItemIndicators(profileId: string, itemId: string, indicators: any) {
    updateOneItem(profileId, itemId, (it) => ({ ...it, indicators }));
  }

  return {
    profiles,
    loaded,
    onCreateProfile: createProfile,
    onRenameProfile: renameProfile,
    onDeleteProfile: deleteProfile,
    onAddCriterion: addCriterion,
    onRenameCriterion: renameCriterion,
    onSetCriterionWeight: setCriterionWeight,
    onRemoveCriterion: removeCriterion,
    onAddItem: addItem,
    onRenameItem: renameItem,
    onRemoveItem: (profileId: string, itemId: string) => updateItems(profileId, (items) => items.filter((it) => it.id !== itemId)),
    /** Desativar oculta o card automaticamente (não atrapalha a análise); reativar desoculta. Pra ver um item desativado sem reativá-lo, use onSetItemHidden. */
    onToggleItemActive: (profileId: string, itemId: string) =>
      updateOneItem(profileId, itemId, (it) => {
        const active = !it.active;
        return { ...it, active, hidden: !active };
      }),
    onSetItemHidden: (profileId: string, itemId: string, hidden: boolean) => updateOneItem(profileId, itemId, (it) => ({ ...it, hidden })),
    onUpdateItemRating: (profileId: string, itemId: string, criterionId: string, value: number) =>
      updateOneItem(profileId, itemId, (it) => {
        const idx = currentVariantIndex(it);
        const ratings = it.ratings.map((r: any, i: number) => (i === idx ? { ...r, [criterionId]: clampRating(value) } : r));
        return { ...it, ratings };
      }),
    onFillCriterionForItem: fillCriterionForItem,
    onUpdateItemNote: (profileId: string, itemId: string, note: string) => updateOneItem(profileId, itemId, (it) => ({ ...it, note })),
    onSetItemVariant: (profileId: string, itemId: string, variantIndex: number) =>
      updateOneItem(profileId, itemId, (it) => ({ ...it, activeVariantIndex: variantIndex })),
    /** Guarda o texto de uma explicação gerada sob demanda ("why"/"deviation") pra variante atual do item. */
    onCacheItemExplain: (profileId: string, itemId: string, criterionId: string, kind: string, text: string) =>
      updateOneItem(profileId, itemId, (it) => {
        const idx = currentVariantIndex(it);
        const explainCache = it.explainCache.map((entry: any, i: number) =>
          i === idx ? { ...entry, [criterionId]: { ...(entry[criterionId] || {}), [kind]: text } } : entry
        );
        return { ...it, explainCache };
      }),
    onSetInteraction: setInteraction,
    onRemoveInteraction: removeInteraction,
    onSetComparisonCache: setComparisonCache,
    onSetRatingMeta: setRatingMeta,
    onSetCriterionLink: setCriterionLink,
    onRemoveCriterionLink: removeCriterionLink,
    onSetItemProtocol: setItemProtocol,
    onSetItemIndicators: setItemIndicators,
    onSetCriterionHidden: setCriterionHidden,
    onSetProfileSaturation: setProfileSaturation,
    onAddCheckIn: addCheckIn,
    onRemoveCheckIn: removeCheckIn,
    /** Custo/atrito do item: { money: R$/mês, time: min/dia, effort: 1-5 }. */
    onSetItemCost: (profileId: string, itemId: string, cost: any) => updateOneItem(profileId, itemId, (it) => ({ ...it, cost })),
  };
}
