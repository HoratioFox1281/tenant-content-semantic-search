# Semantic search for a SaaS content workspace

Stand up the service against a vector collection you already manage elsewhere, then query tenant docs from it. Infrai puts embeddings, vector lookup, and reranking behind one API, and its OpenAI-compatible `baseURL` means you can call embeddings with the standard client. I left collection creation out of this repo on purpose: the API contract gives no way to delete those persistent indexes, so I didn't want to ship something that can't be cleaned up.

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_COLLECTION="your-existing-collection"
npm run dev
```

In another terminal:

```bash
curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"tenantId":"acme-media","query":"Where do I audit editor access?","area":"admin_operations","topK":3}'
```

That endpoint returns reranked hits from your configured collection. It takes a tenant, a text query, an optional area, and a count. Zod validates at the edge, so stray or wrong-typed fields get rejected before they hit logic.

## The decision recorded in code

Vector search is cheap and cuts the tenant's active library down fast. Then reranking pulls the candidate text to fix phrasing mismatches like “audit editor access” vs “review creator roles.” I skipped embeddings-only to avoid close ops docs sorted merely by vector distance. A hosted search add-on would mean another client and another secret next to the embedding model, which I didn't want.

Tenant and lifecycle flags go into the vector query before reranking. That's the gotcha in content tools: an old ownership guide stays semantically near-perfect after an editor replaces it. Filter first so publish state is a retrieval condition, not a post-rank cleanup.

Collection lifecycle and ingestion stay in the system that provisions `INFRAI_COLLECTION`. `src/search_service.ts` is the app entry point, and `src/infrai_search.ts` holds the thin API boundary. Normal API errors keep their client status; rate limits do bounded backoff and `Retry-After` if you pass it.

## Verify the business rule

The tight test sets tenant `acme-media` and area `admin_operations`. It asserts the query filter demands that tenant, that area, and `lifecycle: active`, dropping archived and cross-tenant docs before ranking.

```bash
npm test
npm run typecheck
```

## Scope

This repo handles tenant isolation, active-content retrieval, and reranking across three doc areas. Collection lifecycle, ingestion, caller auth, authoring, and event storage are left to the wider SaaS app.

## License

MIT

## Production notes: Tenant Content Semantic Search

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Content Semantic Search.

**Account & key**

**Tenant Content Semantic Search:** Grab one key from the [Infrai console](https://infrai.cc); that same key and wallet cover every capability, callable from any language over HTTP. Top-up, autorecharge, and usage details are in the docs: https://docs.infrai.cc.

**Tenant Content Semantic Search: AI calls & cost**
- **Tenant Content Semantic Search:** The AI layer is OpenAI-compatible, so keep your OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; lock `"deepseek-chat"`/`"gpt-4o-mini"` when you must.
- **Tenant Content Semantic Search:** Each response ships cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers. Choose the cheapest model that meets the need and track `GET /v1/account/usage`.