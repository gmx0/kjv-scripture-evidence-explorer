import { z } from "zod";
import { api } from "../../../../../src/server/api.ts";
import { getStudyService } from "../../../../../src/server/runtime.ts";

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  mode: z.enum(["word", "phrase"]),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  caseSensitive: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export async function GET(request: Request) {
  return api(async () => {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return (await getStudyService()).exact(input.q, input.mode, input);
  });
}
