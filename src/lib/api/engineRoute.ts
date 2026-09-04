import { apiResponse, apiError } from "./respond";
import { getLatestEngine } from "./engineData";

export async function engineRouteHandler(engineKey: string) {
  try {
    const rows = await getLatestEngine(engineKey);
    return apiResponse({ engineKey, horizons: rows });
  } catch (e) {
    return apiError((e as Error).message);
  }
}
