"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createProject } from "@/lib/client";
import { ArrowRightIcon, Spinner } from "./icons";

const EXAMPLES = ["calai.app", "allbirds.com", "liquiddeath.com", "notion.so"];

export function NewProjectForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(raw: string) {
    if (!raw.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const id = await createProject(raw);
      startTransition(() => router.push(`/p/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start that one");
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div id="new" className="w-full scroll-mt-24">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className={`group flex items-center gap-2 rounded-2xl border bg-card p-2 pl-5 shadow-[0_1px_0_var(--line-2),0_12px_32px_-18px_rgba(22,21,19,0.35)] transition ${
          error ? "border-rec" : "border-line focus-within:border-ink"
        }`}
      >
        <span className="font-mono text-sm text-ink-3 select-none">https://</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="yourproduct.com"
          aria-label="Product link"
          aria-invalid={!!error}
          aria-describedby={error ? "new-error" : undefined}
          autoComplete="url"
          inputMode="url"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] placeholder:text-ink-3/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-rec px-4 text-[15px] font-medium text-white transition hover:brightness-105 active:scale-[0.98] disabled:bg-ink/15 disabled:text-ink-3"
        >
          {submitting ? <Spinner /> : null}
          <span>{submitting ? "Starting" : "Make the ad"}</span>
          {!submitting && <ArrowRightIcon className="h-4 w-4" />}
        </button>
      </form>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {error ? (
          <p id="new-error" role="alert" className="text-rec">
            {error}
          </p>
        ) : (
          <>
            <span className="text-ink-3">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={submitting}
                onClick={() => {
                  setValue(ex);
                  submit(ex);
                }}
                className="font-mono text-[13px] text-ink-2 underline decoration-line decoration-1 underline-offset-4 transition hover:text-ink hover:decoration-ink disabled:opacity-40"
              >
                {ex}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
