# Security Review: MVP PoC

## Scope

Targeted security-boundary audit of the prototype's application source and deployment configuration, within the requested repository.

- Scan mode: repository
- Target kind: directory_snapshot
- Target ID: target_sha256_18d7ae2c5235cd6fad23a744784cdc0ac14aca51a3d4ce46664cc6b64d39166e
- Snapshot digest: codex-security-snapshot/v1:sha256:5ce868bd1648087cc08dd46f581563b33c9ec04afe087a38f6846eeb6b691d41
- Inventory strategy: directory
- Included paths: .
- Excluded paths: none
- Runtime or test status: Local functional and remote isolation evidence exists from development; this scan validates source paths without production attack traffic.
- Artifacts reviewed: src/lib/api.ts, src/lib/analytics.ts, src/lib/storage.ts, src/lib/images.ts, src/lib/render.ts, src/components/ui.tsx, server/dev.ts, server/file-store.ts, supabase/functions/_shared/handler.ts, supabase/functions/_shared/providers.ts, supabase/functions/_shared/validation.ts, supabase/functions/_shared/types.ts, supabase/functions/_shared/supabase-store.ts, supabase/functions/_shared/memory-store.ts, supabase/functions/mono-api/index.ts, supabase/functions/mono-api/deno.json, supabase/migrations/20260908040436_mono_private_workspace.sql, supabase/config.toml, .env.example, .vercelignore, .gitignore, vercel.json, .github/workflows/ci.yml

Limitations and exclusions:
- No independent security worker was available because worker usage was exhausted.
- This is not a compliance certification, external penetration test, or exhaustive review of all third-party dependencies.
- Generated report/media artifacts and dependency internals were not fully audited.
- Excluded public/report/\*\*: Generated report and media attachments were not audited as implementation.
- Excluded node_modules/\*\*: Third-party dependency internals and legal/regulatory compliance were not fully reviewed.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 2 |
| Severity mix | medium: 1, low: 1 |
| Confidence mix | high: 2 |
| Coverage | partial |
| Validation mode | static_source_trace |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

A public Vercel React/Pitaya client communicates with a Supabase Edge Function. Random 256-bit browser capabilities identify private workspaces; server-side service credentials access private mono tables and storage. Optional paid Google generation is separately gated by a server access code. Local mode uses the same handler with private filesystem persistence.

### Assets

- Google API and OAuth credentials consumed only by providers.ts on the backend.
- Supabase service-role credential supplied to the Edge Function entrypoint.
- Private product photos, facts and job outputs scoped by owner_hash.
- Shared Supabase storage/database capacity and optional model spend.

### Trust Boundaries

- Browser input -\> handler exact field validation and random capability hashing at handler.ts:57-59.
- Handler -\> owner-scoped Supabase queries and private object paths in supabase-store.ts.
- Handler -\> fixed Google hosts and server-only credentials in providers.ts.
- Browser -\> public PostHog ingestion token; analytics.ts allowlists non-content event properties.

### Attacker Capabilities

- An unauthenticated internet caller can reach public routes and choose any syntactically valid workspace token.
- A caller cannot derive another random token or access Google keys from frontend code.
- A malicious API client can omit Origin and rotate tokens independently of the normal UI.

### Security Objectives

- Never ship model or service-role credentials to the browser.
- Only the matching workspace capability may read a workspace's photos and records.
- Preserve shared storage and request budgets even when caller-controlled identifiers change.
- Reject invalid requests before persisting external side effects.

### Assumptions

- The normal operator controls backend environment variables and the frontend build configuration.
- Cloud is intentionally demo mode; Google real generation is currently local, as selected by the user.
- Local .env files are ignored by Git and Vercel; the directory owner remains a trusted actor.
- No formal organization-specific security standard was supplied.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Public callers can rotate workspace tokens to bypass persistence rate limits](#finding-1) | medium | high | inline below |
| [Invalid product metadata can leave an unreferenced uploaded image](#finding-2) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Public callers can rotate workspace tokens to bypass persistence rate limits

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The route accepts arbitrary 64-character tokens, hashes them without registration, and only indexes a local Map by that hash before persistent writes. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | supabase/functions/_shared/handler.ts:27-31, supabase/functions/_shared/handler.ts:141-143 |

#### Summary

An internet caller can choose a new workspace token for each request and repeatedly create files or records in Supabase. The only rate counter is per caller-selected owner and per process, so shared storage and database use are not durably bounded.

#### Root Cause

The service conflates a caller-generated workspace capability with a durable abuse-control identity. Each new owner hash begins a new counter and the counter disappears with the runtime.

**Caller chooses its own rate-bucket identity** — `supabase/functions/_shared/handler.ts:57-59`

Any syntactically valid random token is accepted. Its hash becomes the owner and rate-map key; a fresh token therefore creates a fresh bucket.

```typescript
      const token = request.headers.get('x-workspace-token') || '';
      if (!/^[0-9a-f]{64}$/.test(token)) throw new ApiError(401, 'WORKSPACE_REQUIRED', '缺少有效的私人工作區識別碼。');
      const owner = await ownerFromToken(token); rate(owner);
```

**Only owner-local process memory bounds requests** — `supabase/functions/_shared/handler.ts:27-31`

The counter is not shared across owners or Edge isolates. Token rotation or a new runtime bypasses this limit.

```typescript
  function rate(owner: string) {
    const time = now(); let entry = rates.get(owner);
    if (!entry || time - entry.time > 60_000) { entry = {time, count: 0}; rates.set(owner, entry); }
    if (++entry.count > 90) throw new ApiError(429, 'RATE_LIMITED', '操作太頻繁，請稍後再試。', true);
    if (rates.size > 5000) for (const [key,v] of rates) if (time - v.time > 60_000) rates.delete(key);
```

**Public route persists image bytes** — `supabase/functions/_shared/handler.ts:141-143`

After the capability syntax check, this route writes image bytes to the private bucket; privacy protection does not prevent resource allocation.

```typescript
      if (route === '/assets' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['dataUrl']);const image=parseImage(input.dataUrl);
        const id=await asset(owner,image.bytes,image.mimeType);return json({id,mimeType:image.mimeType,bytes:image.bytes.length},201);
```

#### Validation

The complete path accepts attacker-selected tokens, generates fresh owner buckets, and reaches store.assetPut without any account or aggregate persistent budget.

Validation method: static source trace

**Caller chooses its own rate-bucket identity** — `supabase/functions/_shared/handler.ts:57-59`

Any syntactically valid random token is accepted. Its hash becomes the owner and rate-map key; a fresh token therefore creates a fresh bucket.

```typescript
      const token = request.headers.get('x-workspace-token') || '';
      if (!/^[0-9a-f]{64}$/.test(token)) throw new ApiError(401, 'WORKSPACE_REQUIRED', '缺少有效的私人工作區識別碼。');
      const owner = await ownerFromToken(token); rate(owner);
```

**Only owner-local process memory bounds requests** — `supabase/functions/_shared/handler.ts:27-31`

The counter is not shared across owners or Edge isolates. Token rotation or a new runtime bypasses this limit.

```typescript
  function rate(owner: string) {
    const time = now(); let entry = rates.get(owner);
    if (!entry || time - entry.time > 60_000) { entry = {time, count: 0}; rates.set(owner, entry); }
    if (++entry.count > 90) throw new ApiError(429, 'RATE_LIMITED', '操作太頻繁，請稍後再試。', true);
    if (rates.size > 5000) for (const [key,v] of rates) if (time - v.time > 60_000) rates.delete(key);
```

**Public route persists image bytes** — `supabase/functions/_shared/handler.ts:141-143`

After the capability syntax check, this route writes image bytes to the private bucket; privacy protection does not prevent resource allocation.

```typescript
      if (route === '/assets' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['dataUrl']);const image=parseImage(input.dataUrl);
        const id=await asset(owner,image.bytes,image.mimeType);return json({id,mimeType:image.mimeType,bytes:image.bytes.length},201);
```

Limitations:
- No high-volume traffic was sent to production.
- This does not enable reading another workspace or bypass the live-model access code.

#### Dataflow

x-workspace-token -\> SHA-256 owner -\> process-local per-owner rate Map -\> private Storage upload

- **Source:** caller-selected workspace token and image bytes

- **Sink:** Supabase private Storage and mono records

- **Outcome:** Unbounded aggregate persistence despite per-owner request limits

**Caller chooses its own rate-bucket identity** — `supabase/functions/_shared/handler.ts:57-59`

Any syntactically valid random token is accepted. Its hash becomes the owner and rate-map key; a fresh token therefore creates a fresh bucket.

```typescript
      const token = request.headers.get('x-workspace-token') || '';
      if (!/^[0-9a-f]{64}$/.test(token)) throw new ApiError(401, 'WORKSPACE_REQUIRED', '缺少有效的私人工作區識別碼。');
      const owner = await ownerFromToken(token); rate(owner);
```

**Only owner-local process memory bounds requests** — `supabase/functions/_shared/handler.ts:27-31`

The counter is not shared across owners or Edge isolates. Token rotation or a new runtime bypasses this limit.

```typescript
  function rate(owner: string) {
    const time = now(); let entry = rates.get(owner);
    if (!entry || time - entry.time > 60_000) { entry = {time, count: 0}; rates.set(owner, entry); }
    if (++entry.count > 90) throw new ApiError(429, 'RATE_LIMITED', '操作太頻繁，請稍後再試。', true);
    if (rates.size > 5000) for (const [key,v] of rates) if (time - v.time > 60_000) rates.delete(key);
```

**Public route persists image bytes** — `supabase/functions/_shared/handler.ts:141-143`

After the capability syntax check, this route writes image bytes to the private bucket; privacy protection does not prevent resource allocation.

```typescript
      if (route === '/assets' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['dataUrl']);const image=parseImage(input.dataUrl);
        const id=await asset(owner,image.bytes,image.mimeType);return json({id,mimeType:image.mimeType,bytes:image.bytes.length},201);
```

#### Reachability

The Edge Function is public and its custom check accepts any correctly shaped token. CORS can be omitted by a non-browser client.

- **Attacker:** Unauthenticated internet API client

- **Entry point:** POST /assets and /products

- **Outcome:** Storage/database resource consumption

#### Severity

**Medium** — A public, unauthenticated caller can consume shared paid storage or availability. Existing 7 MB per-image and live-code gates limit individual requests and model billing, but do not cap aggregate demo writes.

Additional runtime or deployment evidence could raise or lower this severity.

Impact assessment:
- **Level:** medium
- **Why:** The affected asset is shared service capacity and cost, not cross-workspace confidentiality.

Likelihood assessment:
- **Level:** high
- **Why:** No account or secret is needed for demo persistence writes.

#### Remediation

Add durable shared request and byte budgets that cannot be reset by changing a workspace token, and use stable authenticated identities before opening a multi-user service.

Tests:
- Rotating tokens cannot exceed a shared daily persistence budget.
- Independent Edge isolates share the same quota and retain counts after restart.

Preventive controls:
- Keep per-file limits and paid-model access gating in addition to aggregate quotas.

<a id="finding-2"></a>

### [2] Invalid product metadata can leave an unreferenced uploaded image

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The sourceAsset upload precedes uuid and safeJson validation in the same handler. |
| Category | incomplete-cleanup |
| CWE | CWE-459 |
| Affected lines | supabase/functions/_shared/handler.ts:158-161 |

#### Summary

POST /products uploads the source image before validating the optional product ID and metadata. A request can therefore return an error after already writing a file that has no product record.

#### Root Cause

Validation and persistent side effects are interleaved. The handler performs the source upload before all later request fields have been accepted and has no rollback for that validation failure.

**Source upload precedes complete validation** — `supabase/functions/_shared/handler.ts:152-162`

A valid sourceDataUrl is uploaded on line 158. A malformed id or metadata then throws before the product record can retain sourceAssetId.

```typescript
      if (route === '/products' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['id','name','category','description','facts','sourceDataUrl','sourceAssetId','metadata']);
        const name=str(input.name,'name',150);const category=str(input.category,'category',100,'general');const description=str(input.description,'description',3000,'');
        const facts=input.facts===undefined?[]:input.facts;if(!Array.isArray(facts)||facts.length>20)throw new ApiError(400,'INVALID_INPUT','商品事實最多 20 項。');
        let sourceAssetId=input.sourceAssetId?uuid(input.sourceAssetId,'sourceAssetId'):undefined;
        if(sourceAssetId && !await store.assetGet(owner,sourceAssetId))throw new ApiError(404,'NOT_FOUND','找不到商品來源素材。');
        if(input.sourceDataUrl){const image=parseImage(input.sourceDataUrl);sourceAssetId=await asset(owner,image.bytes,image.mimeType);}
        const old=input.id?await store.get('products',owner,uuid(input.id)):null;
        const row=old || record(owner,{});if(input.id)row.id=uuid(input.id);
        row.payload={name,category,description,facts:facts.map(v=>str(v,'fact',3000)),...(sourceAssetId?{sourceAssetId}:{}),metadata:input.metadata?safeJson(input.metadata):{}};row.updatedAt=iso();await store.put('products',row);
        return json({product:await publicRow(row)},old?200:201);
```

#### Validation

A valid source image with invalid metadata or an invalid product UUID reaches assetPut first and fails at the subsequent uuid/safeJson check.

Validation method: static source trace

**Source upload precedes complete validation** — `supabase/functions/_shared/handler.ts:152-162`

A valid sourceDataUrl is uploaded on line 158. A malformed id or metadata then throws before the product record can retain sourceAssetId.

```typescript
      if (route === '/products' && request.method === 'POST') {
        const input=await readJson(request);exactKeys(input,['id','name','category','description','facts','sourceDataUrl','sourceAssetId','metadata']);
        const name=str(input.name,'name',150);const category=str(input.category,'category',100,'general');const description=str(input.description,'description',3000,'');
        const facts=input.facts===undefined?[]:input.facts;if(!Array.isArray(facts)||facts.length>20)throw new ApiError(400,'INVALID_INPUT','商品事實最多 20 項。');
        let sourceAssetId=input.sourceAssetId?uuid(input.sourceAssetId,'sourceAssetId'):undefined;
        if(sourceAssetId && !await store.assetGet(owner,sourceAssetId))throw new ApiError(404,'NOT_FOUND','找不到商品來源素材。');
        if(input.sourceDataUrl){const image=parseImage(input.sourceDataUrl);sourceAssetId=await asset(owner,image.bytes,image.mimeType);}
        const old=input.id?await store.get('products',owner,uuid(input.id)):null;
        const row=old || record(owner,{});if(input.id)row.id=uuid(input.id);
        row.payload={name,category,description,facts:facts.map(v=>str(v,'fact',3000)),...(sourceAssetId?{sourceAssetId}:{}),metadata:input.metadata?safeJson(input.metadata):{}};row.updatedAt=iso();await store.put('products',row);
        return json({product:await publicRow(row)},old?200:201);
```

Limitations:
- No deliberately orphaning request was sent to the production bucket.

#### Dataflow

sourceDataUrl -\> parseImage -\> assetPut -\> uuid/safeJson throws -\> error response without product

- **Source:** image plus invalid later fields

- **Sink:** private object Storage

- **Outcome:** An orphaned image remains without a successful product record

#### Reachability

The public product endpoint is reachable by any valid workspace capability.

- **Attacker:** API caller using its own workspace

- **Entry point:** POST /products

- **Outcome:** Orphaned storage objects

#### Severity

**Low** — The caller can allocate orphaned storage through invalid requests. The impact is bounded per request and overlaps shared storage pressure, with no data disclosure.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Validate all fields before uploading, and clean up newly uploaded objects when subsequent persistence fails.

Tests:
- A request with valid source bytes and invalid metadata creates no asset.
- A product-save failure cleans up its new upload or records it for controlled retry.

Preventive controls:
- Separate validation, allocation and commit phases for persistent operations.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Model keys, service role and frontend configuration | not recorded | No issue found | Provider keys are consumed only server-side; .vercelignore excludes env files and server sources. Public PostHog ingestion token is deliberately client-visible. |
| Workspace ownership, storage and database access | not recorded | No issue found | All database/object access derives owner_hash from a 256-bit token and checks it on reads; SQL revokes anon/authenticated data access. |
| Public API resource allocation | not recorded | Reported | Caller-selected tokens define an in-memory rate bucket; public write routes persist data without a shared quota. |
| Upload validation and side-effect ordering | not recorded | Reported | Product source image is persisted before optional metadata and product ID validation. |

## Open Questions And Follow Up

- Dependency audit reports five moderate package entries; exploit reachability in the selected Pitaya component paths has not been demonstrated.
- Production needs a deliberate account/session recovery and per-user quota design before multi-user expansion.
