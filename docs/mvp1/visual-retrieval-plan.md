# Visual retrieval implementation and qualification

**R10** Words retrieve objects visible in stored image pixels even when omitted from all text.
**R11** A new photograph retrieves likely recorded locations with stored visual evidence.
The first whole-image slice gives both journeys the same encoder and index. Qualification remains open for both requirements. Ordinary search, exact identifiers and text-semantic search remain available on the Search page.

## Qualify on household fixtures

Collect opt-in originals across households, rooms and bins. Include crowded and partly occluded objects, small objects, similar items in different locations, varied light and angles, and older photographs. Use genuinely new photographs for the photo queries. Include absent items, inaccessible locations and ambiguous duplicates. Check that the names in the R10 cohort are absent from captions, aliases, notes, filenames and document text. Label acceptable record and box IDs plus the visible region. Split tuning and held-out data by household or object instance so closely related photos do not cross the split.

Run ordinary search, text-semantic search, full-image vectors, and full-image plus bounded regions on identical cohorts. Report Recall@1/5, no-match precision and false positives on absent items, ambiguity, coverage, latency, indexing throughput, memory and cost. Agree on the pass thresholds from the design before opening the held-out set. The four-image OpenCLIP study provides feasibility evidence for the encoder. Its shared scene/crop queries and small gallery leave household accuracy and abstention unqualified. [Experiment and measurements](../../scripts/visual-retrieval/README.md).

## Index and enforce source eligibility

1. Add a distinct pgvector index keyed by attachment, original content hash, region, and model generation. Pin weights, encoder dimensions, and preprocessing per generation. Use Kept's durable jobs for bounded, idempotent indexing. Backfill into a new generation and switch once measured coverage is acceptable.
2. Scope candidate generation and evidence to the caller's authorized locations and currently visible, eligible attachments. Use Kept's RLS and narrowly scoped search functions, honoring role, attachment visibility, trash and review state. Check eligibility before reading bytes or handing them to a provider, before committing an index row, and before returning results or issuing signed media URLs. Any external inference requires the existing explicit opt-in.
3. Use deletion, replacement and moves to invalidate the old source generation. Jobs recheck hash, attachment and location on commit, so an in-flight index cannot resurrect old results. Cross-location moves re-evaluate authorization at the destination. Revocation filters results, coverage, counts and new media URLs immediately on the server. Use the current canonical containment path in results. Rebuild derived vectors from surviving originals after restore.
4. Bound image bytes, decoded pixels, regions and per-account processing. Use a private, principal-scoped temporary object for query photos, with a proposed 15-minute maximum lifetime and deletion after encoding or cancellation. Keep a short-lived query vector for retry within that lifetime. Exclude query photos and vectors from inventory, backups, export, analytics, logs and model training. Expire them on schedule and invalidate them on access revocation.

## Whole-image interfaces

| Interface | First slice |
| --- | --- |
| `POST /api/v1/visual-search/input` | Accepts raw JPEG, PNG or WebP up to 8 MiB and 20 megapixels with optional comma-separated `locationIds`. Returns `{inputId, expiresAt}`. The server encodes the bytes in memory and retains only the vector, bound to the signed-in user, session and authorized locations for at most 15 minutes. |
| `DELETE /api/v1/visual-search/input/:id` | Clears the caller's input immediately. Repeat calls return 204. |
| `POST /api/v1/visual-search` | Accepts exactly one of `text` or `inputId`, optional `locationIds` and a limit of 1–20. Returns `{outcome, coverage, matches}`. Photo queries can narrow the scope bound at upload. The current generation indexes and queries whole images. |
| `GET /api/v1/visual-search/status` | Returns `generation` and scoped `ready`, `pending`, `failed` and `paused` counts. An unconfigured server returns a null generation. |
| `POST /api/v1/admin/visual-search/reindex` | A signed-in location owner or admin submits `{locationId}`. Each audited call enqueues a bounded batch for the configured generation and returns `{queued}`. |

A match includes the record and location IDs, current containment path, source attachment and file, capture date and the cosine score used for ranking. The browser shows possible matches and recorded locations. It requests a fresh display URL from Kept's existing authorized media route when someone opens evidence. Results keep the best photo for each record. The page handles no close match, incomplete indexing, ambiguity and unavailable inference. Photo search applies location scope, and the usual search filters continue to apply to ordinary results. Searching creates no inventory records.

The ranking checks for close alternatives across distinct recorded paths before
applying the result limit. When several results are requested, one result can
show the strongest close alternative even if one box would otherwise fill the
list. A limit of one still reports ambiguity and returns the leading record.
Canceling a photo query stops the search and releases the temporary input when
the upload returns its handle.

## Run the first slice

Start the [pinned loopback OpenCLIP sidecar](../../scripts/visual-retrieval/README.md#opt-in-local-encoder) and opt in on the server and worker. A location owner or admin can enqueue existing eligible photos with the scoped reindex route. Newly attached eligible photos use the durable jobs. The Search page adds **Find in photos** for the description in its search box and **Search with a photo** for a new query image when a generation is configured.

Whole-image indexing currently covers eligible JPEG, PNG and WebP photo attachments. It skips documents, drafts, in-review attachments and sources outside the size limits. Viewers cannot query vectors derived from originals. In a cross-location move or photo replacement, live source checks make the previous vector ineligible. Reindex the destination if a replacement vector is pending. Temporary photo queries use process memory and can expire sooner if the process restarts. Use the same application process for upload and search in a multi-replica setup.

## First-slice evidence

The disposable Fastify and PostgreSQL integration indexed five out of five COIL-20 photos in distinct fixture boxes. The search words were absent from the associated records and ordinary lexical search returned no matching record. Photo queries used separately captured turntable exposures. The portable corpus includes similar cups and toy vehicles in different recorded locations. [Encoder setup and corpus commands](../../scripts/visual-retrieval/README.md#real-encoder-smoke-with-independent-image-exposures).

| Measure | Caption-omitted text | Independently exposed photo |
| --- | --- | --- |
| Recall@1 | 5/6 | 5/5 |
| Recall@5 | 6/6 | 5/5 |
| Absent queries without a match | 2/2 | 1/2 |
| API round trip on `e2f8d94c` | 34.7–95.3 ms | 66.0–113.8 ms including upload and encoding |

The five-photo upload, attachment and indexing path took 0.84–1.42 seconds in two focused runs. The encoder process used about 589 MiB resident memory on Apple Silicon after the small smoke run. The 375 px Chromium check used the built app and its running durable worker. One attachment became searchable 1.02–1.47 seconds after the attach request across two runs. Both browser query modes returned the same recorded box, an authorized signed preview loaded, and the query handle was released.

The absent cat figurine returned the rubber duck as a false positive. The small turntable corpus does not qualify household accuracy, abstention, throughput or latency at scale. Keep G3 and G6 pending. Assess the provisional scores on the approved independent household cohorts before applying them to pilot acceptance. [Approved NFC design and implementation plan](../kept_nfc_software_design.docx).
