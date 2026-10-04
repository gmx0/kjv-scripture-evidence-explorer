import { ZodError } from "zod";
import { ReferenceParseError } from "../../../../packages/corpus/src/reference.ts";
import { StudyServiceError } from "./study-service.ts";

export async function api<T>(operation: () => T | Promise<T>): Promise<Response> {
  try {
    return Response.json(await operation(), {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const status = error instanceof StudyServiceError
      ? error.status
      : error instanceof ReferenceParseError || error instanceof ZodError
        ? 400
        : 500;
    const message = status === 500 ? "The local corpus service could not complete the request." : formatError(error);
    if (status === 500) console.error(error);
    return Response.json({ error: { status, message } }, { status });
  }
}

export async function jsonBody(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new StudyServiceError("Request body must be valid JSON", 400); }
}

function formatError(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; ");
  return error instanceof Error ? error.message : "Invalid request";
}
