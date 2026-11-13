import { CheckIcon } from "./icons";

/// A grid of colour circles with a checkmark and ring on the chosen one —
/// used for subject colours, the accent colour, and avatar backgrounds.
export function Swatches({
  colors,
  selected,
  onSelect,
}: {
  colors: { hex: string; name?: string }[];
  selected: string;
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="swatches">
      {colors.map(({ hex, name }) => {
        const isSelected = hex.toLowerCase() === selected.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            className={isSelected ? "swatch selected" : "swatch"}
            style={{ background: hex }}
            aria-label={name ?? hex}
            aria-pressed={isSelected}
            onClick={() => onSelect(hex)}
          >
            {isSelected && <CheckIcon size={16} strokeWidth={3.2} />}
          </button>
        );
      })}
    </div>
  );
}
