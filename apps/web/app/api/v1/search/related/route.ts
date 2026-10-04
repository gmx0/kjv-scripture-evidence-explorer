import { api, jsonBody } from "../../../../../src/server/api.ts";
import { getStudyService } from "../../../../../src/server/runtime.ts";
import { relatedRequestSchema } from "../../../../../src/server/schemas.ts";

export async function POST(request: Request) {
  return api(async () => {
    const input = relatedRequestSchema.parse(await jsonBody(request));
    return (await getStudyService()).related(input);
  });
}
