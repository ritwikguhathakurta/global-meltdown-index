import { apiResponse, apiError } from "@/lib/api/respond";
import { getLatestIndiaRegime } from "@/lib/api/engineData";

export async function GET() {
  try {
    const rows = await getLatestIndiaRegime();
    return apiResponse({ horizons: rows });
  } catch (e) {
    return apiError((e as Error).message);
  }
}
