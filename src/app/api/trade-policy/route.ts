import { engineRouteHandler } from "@/lib/api/engineRoute";
export async function GET() {
  return engineRouteHandler("trade_economic_policy");
}
