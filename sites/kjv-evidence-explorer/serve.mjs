import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".jsonl": "application/x-ndjson; charset=utf-8" };

createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const path = resolve(root, requested);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Content-Length": stat.size, "Cache-Control": "no-store" });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("Site preview: http://127.0.0.1:4173"));
