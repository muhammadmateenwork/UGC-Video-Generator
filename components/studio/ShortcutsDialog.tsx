"use client";

import { useEffect, useRef } from "react";

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Space"], label: "Play / pause the preview" },
  { keys: ["←", "→"], label: "Step the playhead" },
  { keys: ["M"], label: "Mute / unmute" },
  { keys: ["B"], label: "Next background (Shift for previous)" },
  { keys: ["G"], label: "Next reaction GIF (Shift for previous)" },
  { keys: ["A"], label: "Next audio track (Shift for previous)" },
  { keys: ["C"], label: "Cycle caption style" },
  { keys: ["R"], label: "Render the video" },
  { keys: ["?"], label: "Show this list" },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-2xl border border-line bg-card p-0 text-ink shadow-[0_30px_80px_-30px_rgba(22,21,19,0.6)] backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[28px] leading-none">Shortcuts</h2>
          <button onClick={onClose} className="font-mono text-[12px] text-ink-3 hover:text-ink">
            Esc
          </button>
        </div>
        <ul className="mt-4 divide-y divide-line-2">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
              <span className="text-ink-2">{s.label}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-7 rounded-md border border-line border-b-2 bg-paper px-1.5 py-0.5 text-center font-mono text-[12px]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
