import { api, jsonBody } from "../../../../../src/server/api.ts";
import { getStudyService } from "../../../../../src/server/runtime.ts";
import { researchQuerySchema } from "../../../../../src/server/schemas.ts";

export async function POST(request: Request) {
  const result = await api(async () => {
    const query = researchQuerySchema.parse(await jsonBody(request));
    return (await getStudyService()).researchRecord(query);
  });
  if (!result.ok) return result;
  return new Response(result.body, {
    status: result.status,
    headers: {
      ...Object.fromEntries(result.headers),
      "Content-Disposition": "attachment; filename=kjv-research-record.json",
    },
  });
}
