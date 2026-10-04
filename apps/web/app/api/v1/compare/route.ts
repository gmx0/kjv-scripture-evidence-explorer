import { api, jsonBody } from "../../../../src/server/api.ts";
import { getStudyService } from "../../../../src/server/runtime.ts";
import { compareRequestSchema } from "../../../../src/server/schemas.ts";

export async function POST(request: Request) {
  return api(async () => {
    const input = compareRequestSchema.parse(await jsonBody(request));
    return (await getStudyService()).compare(input.references);
  });
}
