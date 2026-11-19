import { CheckIcon } from "./icons";
import { openPicker } from "./Pickers";

/// A grid of colour circles with a checkmark and ring on the chosen one —
/// used for subject colours, the accent colour, and avatar backgrounds.
export function Swatches({
  colors,
  selected,
  onSelect,
  allowsCustom,
}: {
  colors: { hex: string; name?: string }[];
  selected: string;
  onSelect: (hex: string) => void;
  /// Adds a rainbow swatch at the end that opens a colour picker, like
  /// SwiftUI's `ColorPicker`.
  allowsCustom?: boolean;
}) {
  const isCustom = !colors.some(({ hex }) => hex.toLowerCase() === selected.toLowerCase());
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
      {allowsCustom && (
        <CustomSwatch hex={selected} isSelected={isCustom} onSelect={onSelect} />
      )}
    </div>
  );
}

/// The rainbow circle, with the browser's own colour picker laid invisibly on
/// top: on an iPhone that's the same picker as SwiftUI's `ColorPicker`. Once
/// a colour from it is chosen, the circle shows that colour inside a rainbow
/// ring, so it stays visible after the picker closes.
function CustomSwatch({
  hex,
  isSelected,
  onSelect,
}: {
  hex: string;
  isSelected: boolean;
  onSelect: (hex: string) => void;
}) {
  return (
    <label className={isSelected ? "swatch custom selected" : "swatch custom"}>
      {isSelected && (
        <span className="swatch-custom-fill" style={{ background: hex }}>
          <CheckIcon size={14} strokeWidth={3.2} />
        </span>
      )}
      <input
        type="color"
        className="native-overlay"
        aria-label="Custom color"
        value={hex.toLowerCase()}
        onClick={openPicker}
        onChange={(event) => onSelect(event.target.value.toUpperCase())}
      />
    </label>
  );
}
