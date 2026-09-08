# Deployment scope

All final resources belong to the user's personal workspace.

| Service | Final target | Verification |
|---|---|---|
| GitHub | `zach-syu/mono-commerce-studio` | Connector profile confirmed the requested personal email; repo is public |
| Vercel | `zach-syus-projects/mono-commerce-studio` | Isolated CLI login confirmed the requested personal email and exact team |
| Supabase | `xldnmcjjeqpzlhcpruyd` | User explicitly selected the connected personal project; independent `mono_` tables and private bucket |
| PostHog | Personal organization `zach-syu`, project `598391` | Profile email verified; capture accepted and query returned the verification event |

Production URL: https://mono-commerce-studio-ashy.vercel.app

The first frontend upload was made under the pre-existing company CLI session before the user clarified the account requirement. The personal deployment replaced it successfully. The temporary company project was deleted after its exact project ID and ownership were verified; no pre-existing company project was changed.

The user chose to keep the cloud deployment in demo mode. Actual Gemini Developer API calls are tested locally. Vertex interfaces remain implemented; no claim is made that the existing Gemini key can authenticate to Vertex. Veo live calls still require standard Vertex credentials.

Frontend build variables are public API URL and PostHog ingestion configuration only. No Google key, workspace access code, Vercel auth token or Supabase service-role key is uploaded in the frontend source.

Supabase deployed handler owns workspace access checks, only reads rows belonging to the derived token hash, and keeps assets private. Production CORS must include the production origin above. CORS does not replace authentication.

Local Vercel CLI authentication and deployment linking are intentionally separate from source code. The repo ignores `.vercel`, `.env*` except `.env.example`, and `.local-data`. A new operator should log into their own account, verify scope, and relink before deploying.
