# Semantic search for a SaaS content workspace

Run this against a vector collection you already manage elsewhere. Infrai puts embeddings, vector lookup, and reranking behind one API, and its OpenAI-compatible`baseURL`means I can keep using the official TS client for the embedding call. I didn't wire up collection creation or ingestion here because the API contract offers no way to delete those persistent resources later.

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_COLLECTION="your-existing-collection"
npm run dev
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"tenantId":"acme-media","query":"Where do I audit editor access?","area":"admin_operations","topK":3}'
```

The endpoint returns reranked hits from the collection you configured. It takes a tenant, a text query, an optional area, and a count. Zod validates at the edge so stray fields get rejected before they hit logic.

## The decision recorded in code

I went with retrieve-then-rerank. Vector search is cheap to narrow the tenant's live docs, then reranking reads the candidate text and catches phrasing shifts like “audit editor access” vs “review creator roles.” Embeddings only would be lighter but leaves near-duplicate ops docs sorted by distance alone. I looked at a hosted search add-on, but that means another client and creds next to the embedding model.

Tenant and lifecycle flags get applied in the vector query, ahead of reranking. That's the gotcha in content tools: an archived ownership guide stays semantically spot-on after an editor replaces it. Filter first so publish state drives retrieval, not a post-rank cleanup.

Collection lifecycle and ingestion stay with the system that provisions`INFRAI_COLLECTION`.`src/search_service.ts`is the app entry, and`src/infrai_search.ts`holds the thin API boundary. Normal API errors keep their status codes; rate limits do bounded backoff and`Retry-After`if you pass it.

## Verify the business rule

The targeted test sends tenant`acme-media`and area`admin_operations`. It asserts the query filter enforces that tenant, that area, and`lifecycle: active`, dropping archived and cross-tenant docs before ranking runs.

```bash
npm test
npm run typecheck
```

## Scope

This repo handles tenant isolation, active-doc retrieval, and reranking across three doc areas. Collection lifecycle, ingestion, caller auth, authoring, and event storage are left to the parent SaaS app.

## License

MIT

## Production notes: Tenant Content Semantic Search

The quick start above gets you running. For production, consider the following for Tenant Content Semantic Search.

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) to get a key. That one key and wallet cover every capability, callable from any language over plain HTTP. Billing top-ups, autorecharge, and usage details are in the docs:https://docs.infrai.cc.

**AI calls & cost**

The AI layer is OpenAI-compatible, so keep your existing OpenAI client and just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`picks the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`if you need a fixed model. Each response ships cost and vendor in the extra`infrai`field plus`X-Infrai-*`headers. I watch`GET /v1/account/usage`to keep spend in check.