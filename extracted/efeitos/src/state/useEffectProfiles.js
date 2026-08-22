/**
 * Estado dos perfis de efeito, extraído do `App.jsx` do Bookdex.
 *
 * No Bookdex isso morava solto no App e descia por props até `EffectsSection`.
 * Aqui já vem como hook: no app novo, chame `useEffectProfiles(storage)` uma
 * vez e passe o retorno pra `<EffectsSection {...effects} />`.
 *
 * `storage` precisa expor `getJSON(key, fallback)` e `setJSON(key, value)` —
 * no Bookdex era `src/lib/storage.js` (Capacitor Preferences com fallback pra
 * localStorage). A chave usada era `KEYS.effectProfiles` = "effect-profiles",
 * e os dados de quem já usava a aba continuam gravados nela no aparelho.
 */
import { useEffect, useState } from "react";
import { createProfileId, createCriterionId, createItemId, clampRating, initEffectProfiles } from "../lib/effectProfiles";

export const STORAGE_KEY = "effect-profiles";

export function useEffectProfiles(storage, showToast = () => {}) {
  const [profiles, setProfiles] = useState(initEffectProfiles());

  useEffect(() => {
    (async () => {
      setProfiles(await storage.getJSON(STORAGE_KEY, initEffectProfiles()));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next) {
    storage.setJSON(STORAGE_KEY, next).catch(() => {});
  }

  function createProfile(name) {
    const clean = (name || "").trim();
    if (!clean) return null;
    const id = createProfileId();
    setProfiles((prev) => {
      const next = { ...prev, [id]: { id, name: clean, createdAt: Date.now(), criteria: [], items: [] } };
      persist(next);
      return next;
    });
    showToast(`Perfil "${clean}" criado.`);
    return id;
  }

  function deleteProfile(id) {
    setProfiles((prev) => {
      const profile = prev[id];
      if (!profile) return prev;
      const next = { ...prev };
      delete next[id];
      persist(next);
      return next;
    });
  }

  function addCriterion(profileId, label) {
    const clean = (label || "").trim();
    if (!clean) return;
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      if (profile.criteria.some((c) => c.label.toLowerCase() === clean.toLowerCase())) return prev;
      const id = createCriterionId(profile.criteria.map((c) => c.id), clean);
      const next = { ...prev, [profileId]: { ...profile, criteria: [...profile.criteria, { id, label: clean }] } };
      persist(next);
      return next;
    });
  }

  function removeCriterion(profileId, criterionId) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const criteria = profile.criteria.filter((c) => c.id !== criterionId);
      const items = profile.items.map((it) => {
        const ratings = { ...it.ratings };
        const reasons = { ...(it.reasons || {}) };
        delete ratings[criterionId];
        delete reasons[criterionId];
        return { ...it, ratings, reasons };
      });
      const next = { ...prev, [profileId]: { ...profile, criteria, items } };
      persist(next);
      return next;
    });
  }

  function addItem(profileId, { name, ratings, reasons, note }) {
    const clean = (name || "").trim();
    if (!clean) return;
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const id = createItemId(profile.items.map((it) => it.id), clean);
      const item = { id, name: clean, active: true, ratings: ratings || {}, reasons: reasons || {}, note: note || "" };
      const next = { ...prev, [profileId]: { ...profile, items: [...profile.items, item] } };
      persist(next);
      return next;
    });
    showToast(`"${clean}" adicionado(a) ao perfil.`);
  }

  function updateItems(profileId, mutate) {
    setProfiles((prev) => {
      const profile = prev[profileId];
      if (!profile) return prev;
      const next = { ...prev, [profileId]: { ...profile, items: mutate(profile.items) } };
      persist(next);
      return next;
    });
  }

  return {
    profiles,
    onCreateProfile: createProfile,
    onDeleteProfile: deleteProfile,
    onAddCriterion: addCriterion,
    onRemoveCriterion: removeCriterion,
    onAddItem: addItem,
    onRemoveItem: (profileId, itemId) => updateItems(profileId, (items) => items.filter((it) => it.id !== itemId)),
    onToggleItemActive: (profileId, itemId) =>
      updateItems(profileId, (items) => items.map((it) => (it.id === itemId ? { ...it, active: !it.active } : it))),
    onUpdateItemRating: (profileId, itemId, criterionId, value) =>
      updateItems(profileId, (items) =>
        items.map((it) => (it.id === itemId ? { ...it, ratings: { ...it.ratings, [criterionId]: clampRating(value) } } : it))
      ),
    onUpdateItemNote: (profileId, itemId, note) =>
      updateItems(profileId, (items) => items.map((it) => (it.id === itemId ? { ...it, note } : it))),
  };
}
