"use client";

/** Small, consistent editor controls shared by the layer cards. */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  color = "var(--ink)",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? `Turn ${label.toLowerCase()} off` : `Turn ${label.toLowerCase()} on`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{ background: checked ? color : "var(--line)" }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left]"
        style={{ left: checked ? 18 : 2 }}
      />
    </button>
  );
}

/**
 * A labelled range slider. `onChange` fires while dragging (live preview);
 * `onCommit` fires once when the user lets go (the save), so dragging a
 * slider doesn't send a request per pixel.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  color = "var(--ink)",
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  disabled?: boolean;
  color?: string;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className={`flex items-center gap-3 text-[12px] ${disabled ? "opacity-40" : ""}`}>
      <span className="w-12 shrink-0 text-ink-3">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-1 min-w-0 flex-1 cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className="w-11 shrink-0 text-right font-mono text-ink-2 tnum">{format(value)}</span>
    </label>
  );
}

export function ColorSwatches({
  label,
  colors,
  value,
  onChange,
  disabled,
}: {
  label: string;
  colors: readonly string[];
  /** null = the style's own colour. */
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 text-[12px] ${disabled ? "opacity-40" : ""}`} role="radiogroup" aria-label={label}>
      <span className="w-12 shrink-0 text-ink-3">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="Style default"
          title="Style default"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] font-semibold ${
            value === null ? "border-ink ring-2 ring-ink ring-offset-1 ring-offset-card" : "border-line"
          }`}
        >
          A
        </button>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            title={c}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={`h-5 w-5 rounded-full border border-ink/15 ${
              value === c ? "ring-2 ring-ink ring-offset-1 ring-offset-card" : ""
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
