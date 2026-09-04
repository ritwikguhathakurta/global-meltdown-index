export function DisclaimerBanner() {
  return (
    <div className="border-t border-border bg-panel px-4 py-3 text-xs leading-relaxed text-text-dim">
      <strong className="text-text">IMPORTANT DISCLAIMER — </strong>
      This platform provides quantitative, macroeconomic and financial-stability research based on
      available data, official communications, historical relationships and model outputs. All market
      assessments, risk scores, probabilities, scenarios and India market classifications represent a{" "}
      <strong className="text-text">CURRENT MACRO/MARKET ASSESSMENT</strong> and are{" "}
      <strong className="text-text">NOT guaranteed forecasts, predictions or investment recommendations</strong>.
      Markets can change rapidly. Historical relationships may fail, data may be revised, and models may
      be wrong. Nothing on this platform should be interpreted as a recommendation to buy, sell or hold
      any security or financial product. Independently verify information and obtain qualified
      professional advice before making investment decisions.
    </div>
  );
}

export function InlineDisclaimer({ text }: { text: string }) {
  return (
    <div className="rounded border border-border bg-panel-raised px-3 py-1.5 text-[11px] uppercase tracking-wide text-text-dim">
      {text}
    </div>
  );
}
