import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, semanticSearch } from "./infrai_search.js";

const collection = process.env.INFRAI_COLLECTION;
if (!collection) {
  throw new Error("Set INFRAI_COLLECTION to an existing, externally managed collection");
}

const SearchBody = z.object({
  tenantId: z.string().min(1),
  query: z.string().min(2).max(500),
  area: z.enum(["onboarding", "account_lifecycle", "admin_operations"]).optional(),
  topK: z.number().int().min(1).max(20).default(5),
}).strict();

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/search") {
    send(response, 404, { error: "Route not found" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = SearchBody.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await semanticSearch({
      collection,
      ...body,
    });
    send(response, 200, result);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid search request" });
    } else if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.message,
        code: error.code,
      });
    } else {
      send(response, 502, { error: "Search could not be completed" });
    }
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(Number(process.env.PORT ?? 3000), () => {
    console.log("Semantic search listening on http://localhost:3000/search");
  });
}
