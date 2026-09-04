import { engineRouteHandler } from "@/lib/api/engineRoute";
export async function GET() {
  return engineRouteHandler("market_concentration");
}
