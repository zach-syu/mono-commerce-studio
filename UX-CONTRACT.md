# Mono Studio behavior contract

Visual values are in DESIGN.md and src/styles.css.

| Capability | Canonical owner | Behavior and evidence |
|---|---|---|
| Form | src/components/ui.tsx Field/Input/BusyScope | Actual PitayaInput, explicit labels and hints, inline validation; pending work disables inputs and preserves values |
| Select/Listbox | src/components/ui.tsx Select | Actual PitayaSelect with option-object adapter, searchable combobox, linked labels, listbox/option roles and keyboard navigation |
| Table Selection | Product library selection state | Visible item checkbox; selected items persist across search; no destructive bulk operation |
| Scrollbar | src/styles.css | Stable gutter, minimum target sizes, no hidden scrollbars |
| Notification | App status and shared Alert | Live region for completion; persistent actionable error; no fake percent |
| Create/Edit | App workflow state | Back preserves edits; changing source invalidates stale copy/results; edits require regeneration |

Drafts and product library save in IndexedDB and are labeled local. Download bundles include copy JSON, actual dimensions, source, prompts, model and artifacts. Generation mode is explicit. Demo mode never claims live AI. Real provider failures remain errors and never switch to demo silently. Supabase owns remote auth, storage, persisted jobs, and model calls when configured. Keys never go into browser storage or frontend bundles.

Export constraints: image file sniffing, PNG/JPEG/WebP only, max 7MB, dimensions capped for safe canvas decoding; no image is sent to a cloud provider in demo. Actual output pixels are measured; resolution choices describe final composition dimensions and do not imply native model detail. Content from user/model is rendered as text, never raw HTML. Claims are based only on supplied facts and require merchant review. Empty copy selection blocks generation. Failed artifact generation supports retry without dropping successful results.


Pitaya UI integration: use the package components through shared adapters. Checkbox has a native focusable input and Space toggles it; the app overrides only the package's `display:none` input treatment and adds focus indication. Dialogs remain native `<dialog>` because the package modal does not implement focus trapping. Settings and image preview retain Escape and focus restoration.

Busy-work invariant: a pending copy/generation/sync operation cannot replace product identity or edit the request inputs. BusyScope disables step 0–2 fields and custom controls; sidebar product navigation and `openProject` are blocked while busy. Step 3 keeps cancellation and completed partial downloads reachable. Only artifact count equal to the requested output count is called fully complete; cancellation/failure with outputs is labeled partially complete.

Provider labeling: the header says 真實模型, not a fixed Vertex claim. The Settings panel reports `googleProvider` and individual readiness from backend health. Readiness means configured, not a proven successful call. Actual artifact and copy provenance retain provider/model from the response. An offline health result clears stale readiness.

Storyboard v2: copy sections include an editable role and visual goal; selected roles drive different artwork templates and photo strategies. Changing provider mode preserves edited copy. Free planning and previews run locally with no model requests. Every paid action requires a fresh explicit consent; the backend also requires `allowPaid: true`. Tests set `MONO_DISABLE_LIVE=1` and refuse a backend without that guard. Generation caches the hero scene for Banner reuse; packshots, crops, benefits and specs retain original photography.

Analytics: only the eight allowlisted workflow event names are emitted by the shared analytics module. No product names, facts, prompts, photos, access codes, or error text enter analytics properties. Failure to record an event never blocks the user workflow.
