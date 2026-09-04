import { apiResponse, apiError } from "@/lib/api/respond";
import { getRecentCentralBankEvents } from "@/lib/api/engineData";

export async function GET() {
  try {
    const events = await getRecentCentralBankEvents();
    return apiResponse({ events }, {
      note: "Headline/date tracking only in this phase. Hawkishness/dovishness NLP scoring is not yet implemented — those fields will read null until that pass ships.",
    });
  } catch (e) {
    return apiError((e as Error).message);
  }
}
