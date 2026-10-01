import { useMemo, useState } from "react";
import { KEYS } from "../../lib/storage";
import { wordLangKey, wordItemId, type WordsState } from "../../lib/words";
import { persist } from "./persist";

export interface WordsContextValue {
  words: WordsState;
  isWordSaved: (languageCode: string | undefined, language: string, word: string) => boolean;
  toggleWordSave: (data: any) => void;
  removeWordGroup: (langKey: string) => void;
  updateWordTags: (langKey: string, wordId: string, tags: string[]) => void;
  updateWordNote: (langKey: string, wordId: string, note: string) => void;
}

type ShowToast = (msg: string, onUndo?: () => void) => void;

/** Aba Palavras: acervo agrupado por idioma e as operações sobre ele. */
export function useWordsStore(showToast: ShowToast) {
  const [words, setWords] = useState<WordsState>({});

  const value = useMemo<WordsContextValue>(() => {
    const commit = (next: WordsState) => {
      setWords(next);
      persist(KEYS.words, next);
    };

    function updateWordInGroup(langKey: string, wordId: string, mutate: (item: any) => any) {
      setWords((prev) => {
        const group = prev[langKey];
        if (!group) return prev;
        const idx = group.words.findIndex((w) => w.id === wordId);
        if (idx === -1) return prev;
        const nextList = [...group.words];
        nextList[idx] = mutate(nextList[idx]);
        const next = { ...prev, [langKey]: { ...group, words: nextList } };
        persist(KEYS.words, next);
        return next;
      });
    }

    return {
      words,
      isWordSaved(languageCode, language, word) {
        const group = words[wordLangKey(languageCode, language)];
        return !!(group && group.words.some((w) => w.id === wordItemId(word)));
      },
      toggleWordSave(data: any) {
        const prevWords = words;
        const langKey = wordLangKey(data.languageCode, data.language);
        const wordId = wordItemId(data.word);
        const next = { ...words };
        const existing = next[langKey];
        const group = existing ? { displayName: existing.displayName, words: [...existing.words] } : { displayName: data.language, words: [] };

        const idx = group.words.findIndex((w) => w.id === wordId);
        const removed = idx >= 0;
        if (removed) {
          group.words.splice(idx, 1);
        } else {
          group.words.push({
            id: wordId,
            word: data.word,
            language: data.language,
            languageCode: data.languageCode || "",
            meaning: data.meaning,
            pinyin: data.pinyin || "",
            radical: data.radical || "",
            characters: data.characters || [],
            savedAt: Date.now(),
            tags: [],
            note: "",
          });
        }

        if (group.words.length === 0) delete next[langKey];
        else next[langKey] = group;

        commit(next);
        showToast(removed ? `"${data.word}" solta(o) das Palavras.` : `"${data.word}" capturada(o)!`, () => commit(prevWords));
      },
      removeWordGroup(langKey: string) {
        const prevWords = words;
        const group = words[langKey];
        if (!group) return;
        const next = { ...words };
        delete next[langKey];
        commit(next);
        showToast(`"${group.displayName}" removido(a) das Palavras.`, () => commit(prevWords));
      },
      updateWordTags: (langKey, wordId, tags) => updateWordInGroup(langKey, wordId, (w) => ({ ...w, tags })),
      updateWordNote: (langKey, wordId, note) => updateWordInGroup(langKey, wordId, (w) => ({ ...w, note })),
    };
  }, [words, showToast]);

  return { value, setWords };
}
