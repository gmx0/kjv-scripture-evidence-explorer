import { api } from "../../../../../src/server/api.ts";
import { getStudyService } from "../../../../../src/server/runtime.ts";

export async function GET(request: Request, { params }: { params: Promise<{ reference: string[] }> }) {
  return api(async () => {
    const service = await getStudyService();
    const { reference } = await params;
    const contextValue = new URL(request.url).searchParams.get("context");
    const context = contextValue === null ? 2 : Number(contextValue);
    return service.passage(decodeURIComponent(reference.join("/")), context);
  });
}
