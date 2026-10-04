import { api, jsonBody } from "../../../../../src/server/api.ts";
import { getStudyService } from "../../../../../src/server/runtime.ts";
import { topicRequestSchema } from "../../../../../src/server/schemas.ts";

export async function POST(request: Request) {
  return api(async () => {
    const input = topicRequestSchema.parse(await jsonBody(request));
    return (await getStudyService()).topic(input);
  });
}
