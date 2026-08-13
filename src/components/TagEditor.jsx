import { useState } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { COLORS } from "../theme";

/** Chips de tag livre num item salvo, com input pequeno para adicionar mais. */
export default function TagEditor({ tags, onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const clean = draft.trim();
    if (clean && !tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onChange([...tags, clean]);
    }
    setDraft("");
    setAdding(false);
  }

  function removeTag(tag) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px", marginTop: "9px" }} onClick={(e) => e.stopPropagation()}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10px",
            color: COLORS.ink,
            background: "rgba(46,134,222,0.12)",
            border: `1.5px solid ${COLORS.lensBlue}`,
            borderRadius: "999px",
            padding: "2px 4px 2px 8px",
          }}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            aria-label={`Remover tag ${tag}`}
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.lensBlue, padding: "2px", display: "flex" }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="nova tag"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10.5px",
            border: `1.5px solid ${COLORS.screenBorder}`,
            borderRadius: "999px",
            padding: "3px 9px",
            width: "84px",
            outline: "none",
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1"
          aria-label="Adicionar tag"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "10px",
            color: COLORS.screenBorder,
            background: "transparent",
            border: `1.5px dashed ${COLORS.screenBorder}`,
            borderRadius: "999px",
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          <TagIcon size={10} /> <Plus size={10} />
        </button>
      )}
    </div>
  );
}
