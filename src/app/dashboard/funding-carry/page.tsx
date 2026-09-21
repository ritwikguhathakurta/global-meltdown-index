import { getCarryLiveSnapshot } from "@/lib/api/carryData";
import CarryLoader from "./CarryLoader";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const metadata = { title: "Funding Carry & Arbitrage Intelligence" };

export default async function FundingCarryPage() {
  const live = await getCarryLiveSnapshot();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Funding Carry &amp; Arbitrage Intelligence</h1>
      <p className="mb-6 max-w-4xl text-sm text-text-dim">
        For an Indian borrower: which currency, tenor, funding structure and hedge currently give the lowest <b>effective INR funding cost</b> once every conversion, hedge, fee, tax and regulatory cost is counted — worked out from real cash flows using the OTC quotes <b>you</b> enter from your banks. It also shows the maximum lender spread, hedge cost and CCS quote you can accept, what would change the answer, and the USD-carry routes (foreign → USD → INR). <b>Decision support only:</b> it never contacts a bank or executes anything, and nothing is guessed — empty boxes stay empty.
      </p>
      <CarryLoader live={live} />
    </div>
  );
}
