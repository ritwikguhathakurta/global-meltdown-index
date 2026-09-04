import { apiResponse, apiError } from "@/lib/api/respond";
import { getLatestGfmi } from "@/lib/api/engineData";

export async function GET() {
  try {
    const rows = await getLatestGfmi();
    const [current, previous] = rows;
    return apiResponse({ current: current ?? null, previous: previous ?? null });
  } catch (e) {
    return apiError((e as Error).message);
  }
}
