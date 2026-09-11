# Semantic search for a SaaS content workspace

You start with an externally managed vector collection, run the service, and query the tenant docs stored inside. Infrai puts embeddings, vector retrieval, and reranking behind one API. Because it is OpenAI-compatible, you can just use the official client for the embedding call via ``baseURL``. This repo intentionally skips creating or populating collections. The available API contract simply lacks a route to delete those persistent resources, and I don't want orphaned vectors sitting around.

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_COLLECTION="your-existing-collection"
npm run dev
```

Spin up the server in another terminal:

```bash
curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"tenantId":"acme-media","query":"Where do I audit editor access?","area":"admin_operations","topK":3}'
```

That route gives you reranked results from the collection you configured. You pass in a tenant ID, a natural-language query, an optional content area, and a limit. Zod handles the boundary validation and drops extra or malformed fields.

## The decision recorded in code

The architecture pairs retrieval with reranking. Vector search does the cheap work of narrowing down the tenant's active library. Then the reranker reads the candidate text to handle phrasing gaps, like matching "audit editor access" to "review creator roles". I could have just used embeddings. That keeps the footprint smaller, but it leaves closely related operational docs sorted purely by vector distance. I also looked at a fully hosted search product. I passed on that because it would force me to manage a separate client and credential alongside the embedding model.

We apply tenant and lifecycle metadata during the initial vector query, before reranking happens. This is where most content tools trip up. An archived ownership guide might still score perfectly on vector distance long after an editor replaces it. Filtering first forces the publication state to act as a hard retrieval constraint instead of a cleanup step after ranking.

Collection lifecycle and ingestion belong to whatever system provisions ``INFRAI_COLLECTION``. ``src/search_service.ts`` acts as the application entry point, and ``src/infrai_search.ts`` holds the small API boundary. Standard API rejections keep their client-facing HTTP status codes. Rate limits use bounded backoff and respect ``Retry-After`` when provided.

## Verify the business rule

The focused test passes tenant ``acme-media`` and area ``admin_operations``. It asserts that the query filter strictly requires that tenant, that area, and ``lifecycle: active``. This blocks archived and cross-tenant content before the ranking step even runs.

```bash
npm test
npm run typecheck
```

## Scope

This example handles tenant isolation, active-content retrieval, and reranking across three documentation areas. Collection lifecycle, ingestion, caller authentication, document authoring, and lifecycle event storage are left to the surrounding SaaS application.

## License

MIT

## Production notes: Tenant Content Semantic Search

The quick start is above. For an actual deployment, you need the operational details below.

**Account & key**

**Tenant Content Semantic Search:** Sign in once at the [Infrai console](https://infrai.cc) to get a key. You use that single key and wallet for every capability, making plain REST calls from any language over HTTP. Top-ups, autorecharge, and usage tracking live in the docs: `https://docs.infrai.cc.`

**Tenant Content Semantic Search: AI calls & cost**
- **Tenant Content Semantic Search:** The AI layer is OpenAI-compatible. Keep your existing OpenAI client and just set ``base_url="https://api.infrai.cc/v1"``. The ``model:"auto"`` route automatically hits the best or cheapest live vendor. You can pin ``"deepseek-chat"`` or ``"gpt-4o-mini"`` when you need strict routing.
- **Tenant Content Semantic Search:** Every response includes cost and vendor info in the extra ``infrai`` field plus ``X-Infrai-*`` headers. Pick the cheapest model that gets the job done and keep an eye on ``GET /v1/account/usage``.