"use client";

export function PrintButton() {
  return (
    <div className="no-print flex flex-col items-end gap-1">
      <button
        onClick={() => window.print()}
        className="gfew-mono rounded bg-white px-4 py-2 text-sm font-semibold text-[#0f1420] shadow transition hover:bg-white/90"
      >
        Download PDF
      </button>
      <span className="text-[10px] text-[#c7dcf0]">Opens your browser&apos;s print dialog — choose &ldquo;Save as PDF&rdquo; as the destination</span>
    </div>
  );
}
