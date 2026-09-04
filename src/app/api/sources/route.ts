import { apiResponse, apiError } from "@/lib/api/respond";
import { getSourceRegistry } from "@/lib/api/engineData";

export async function GET() {
  try {
    const sources = await getSourceRegistry();
    return apiResponse({ sources });
  } catch (e) {
    return apiError((e as Error).message);
  }
}
