import { X } from "lucide-react";
import { COLORS } from "../theme";

/** Chips de tag livre já atribuídas a um item salvo, com botão de remover. */
export default function TagEditor({ tags, onChange }) {
  if (!tags || tags.length === 0) return null;

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
    </div>
  );
}
