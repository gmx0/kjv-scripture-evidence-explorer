import { z } from "zod";
import { api } from "../../../../../../src/server/api.ts";
import { getStudyService } from "../../../../../../src/server/runtime.ts";

const optionsSchema = z.object({
  caseSensitive: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export async function GET(request: Request, { params }: { params: Promise<{ term: string }> }) {
  return api(async () => {
    const { term } = await params;
    const options = optionsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return (await getStudyService()).distribution(decodeURIComponent(term), options);
  });
}
