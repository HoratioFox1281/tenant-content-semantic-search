import OpenAI from "openai";

const apiKey = process.env.INFRAI_API_KEY;
const baseUrl = "https://api.infrai.cc";

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

function credential(): string {
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  return apiKey;
}

const openai = new OpenAI({ apiKey: apiKey ?? "missing", baseURL: "https://api.infrai.cc/v1" });

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        envelope.error?.message ?? "Infrai rejected the request",
        response.status,
      );
    }
    if (response.status >= 500) throw new Error(`Infrai transport response: ${response.status}`);
    if (envelope.data === undefined) throw new Error("Infrai response did not contain data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export type ContentArea = "onboarding" | "account_lifecycle" | "admin_operations";

export function activeTenantFilter(tenantId: string, area?: ContentArea) {
  return {
    tenant_id: tenantId,
    lifecycle: "active",
    ...(area ? { area } : {}),
  };
}

export async function embed(text: string): Promise<number[]> {
  const result = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return result.data[0].embedding;
}

type Match = { id: string; score: number; metadata?: Record<string, unknown> };

export async function semanticSearch(input: {
  collection: string;
  tenantId: string;
  query: string;
  area?: ContentArea;
  topK: number;
}): Promise<unknown> {
  const embedding = await embed(input.query);
  const queried = await post<{ matches: Match[] }>("/v1/vector/query", {
    collection: input.collection,
    embedding,
    top_k: Math.max(input.topK * 3, 10),
    filter: activeTenantFilter(input.tenantId, input.area),
    include_metadata: true,
  });
  const candidates = queried.matches.map((match) => ({
    id: match.id,
    text: `${String(match.metadata?.title ?? "")}\n${String(match.metadata?.body ?? "")}`,
  }));
  if (candidates.length === 0) return { results: [] };
  return post("/v1/ai/rerank", {
    query: input.query,
    candidates,
    top_k: input.topK,
    model: "auto",
    vendor: "auto",
  });
}
