import { engineRouteHandler } from "@/lib/api/engineRoute";
export async function GET() {
  return engineRouteHandler("ai_financial_sustainability");
}
