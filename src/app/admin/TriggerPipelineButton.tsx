"use client";

import { useState, useTransition } from "react";
import { triggerPipeline } from "./actions";

export function TriggerPipelineButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              const r = await triggerPipeline();
              setResult(JSON.stringify(r, null, 2));
            } catch (e) {
              setResult(`Error: ${(e as Error).message}`);
            }
          })
        }
        className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-[#061018] hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Running pipeline…" : "Run pipeline now"}
      </button>
      {result && (
        <pre className="gfew-mono max-h-64 overflow-auto rounded border border-border bg-panel-raised p-3 text-xs text-text-dim">
          {result}
        </pre>
      )}
    </div>
  );
}
