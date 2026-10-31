# ApplyPilot

ApplyPilot is a job-search management app that tracks applications and status changes. Gmail can automatically import supported job-portal email updates, and an optional browser extension captures a job page that the user explicitly selects.

## Architecture

```text
React + TypeScript + Vite
        │ JSON + HTTP-only session cookie + CSRF token
        ▼
Express + TypeScript + Zod + Prisma
        │
        ▼
SQLite (local development) / PostgreSQL (production)
```

The API uses route/controller/service boundaries. User identity comes from a hashed, revocable server-side session, not a client-provided user ID. Passwords are bcrypt-hashed, state-changing requests require CSRF validation, and all private application queries are user-scoped.

### Decisions and scope

- Local development and tests use persistent SQLite. Production uses PostgreSQL with a separate checked-in Prisma schema and migration history. Prisma's database driver adapters use explicit connection-pool settings in production.
- Opaque random session tokens are stored only as SHA-256 hashes. Cookies use HTTP-only, SameSite=Lax settings; enable `COOKIE_SECURE=true` behind HTTPS.
- Dashboard conversion definitions: interview conversion = applications ever transitioned to Interview or Offer / total created applications; interview-to-offer conversion = applications ever transitioned to Offer / applications ever transitioned to Interview or Offer. These cohort-agnostic definitions are MVP metrics.
- Application creation and status changes write history in the same database transaction.
- Gmail uses Google's read-only Gmail OAuth scope. Refresh tokens are encrypted at rest using an administrator-provided 32-byte key. The importer never asks for job-portal credentials. Email matching intentionally ignores messages where the sender, status, or job details are ambiguous.

## Requirements

- Node.js 20.19+ and npm 10+

## Setup (PowerShell)

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open <http://localhost:5173> for the public overview, account registration/sign-in, and dashboard. API: <http://localhost:4000>; health check: <http://localhost:4000/health>. Local SQLite DB: `apps/api/prisma/dev.db`.

The API development, test, and production schemas are separate because Prisma database providers are selected in the schema. `npm run db:generate` and `npm run db:migrate` target local SQLite. `npm run db:generate:postgres` and `npm run db:deploy` target PostgreSQL. The production database URL must be a PostgreSQL connection string; set `DATABASE_POOL_MAX` to the connection budget for each running service.

### Optional AI features

Resume ATS estimates and the interview-prep coach use an administrator-configured OpenAI-compatible chat-completions API. Set `AI_BASE_URL` (the provider API base URL, such as `https://api.openai.com/v1`), `AI_API_KEY`, and `AI_MODEL` in the ignored `.env`, then restart the API. Leave both the base URL and key empty to disable AI features. The key stays server-side. When a user requests analysis or chat, the API sends extracted resume text or interview notes and linked job context to that provider. Resume scoring is an estimate for guidance, not a hiring prediction. Scanned PDFs without selectable text are not supported.

### Automatic application tracking

#### Gmail inbox sync

1. In Google Cloud Console, create a project, enable the Gmail API, configure the OAuth consent screen, and add your account as a test user while the app is in testing.
2. Create an OAuth client ID for a web application. Add the exact value of `GOOGLE_OAUTH_REDIRECT_URL` as an authorized redirect URI (local default: `http://localhost:4000/api/v1/integrations/gmail/callback`).
3. Configure the read-only Gmail API scope `https://www.googleapis.com/auth/gmail.readonly` in the OAuth consent screen. Google may require consent-screen verification before this scope can be used broadly in production.
4. Put the OAuth client ID and secret in the ignored local `.env`. Generate a random 32-byte encryption key and base64 encode it, for example in PowerShell:

   ```powershell
   $bytes = [byte[]]::new(32)
   [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   [Convert]::ToBase64String($bytes)
   ```

   Set the output as `OAUTH_TOKEN_ENCRYPTION_KEY`. Keep the key backed up securely; without it, saved Gmail connections cannot be decrypted. Never commit it.
5. Restart the API, sign in to ApplyPilot, and choose **Connect Gmail** on the dashboard. Review and approve Google's read-only consent screen.
6. Choose **Sync now** for the first import. Thereafter the server checks connected Gmail accounts every `GMAIL_SYNC_INTERVAL_MINUTES` (10 minutes by default). It checks up to 100 recent matching messages within `GMAIL_LOOKBACK_DAYS` (60 days by default). The API displays how many jobs were created, statuses updated, and messages that could not be matched automatically.
7. Disconnect Gmail from the dashboard to revoke Google access and remove the encrypted local token. Previously imported applications are kept.

Email import currently recognizes notification senders from Naukri, LinkedIn, and Internshala. It only creates jobs when both role and company can be confidently extracted from an application email. Later status emails update a unique matching job; ambiguous or incomplete messages are counted as unmatched, not guessed or imported. Email bodies are not retained, and there is not yet a manual review screen for unmatched messages. Portal notification coverage and formats vary. Emails from employer career sites are not yet imported.

#### Optional browser extension

1. Start ApplyPilot and sign in in Chrome.
2. Open a job page or a specific application/status page on Naukri, LinkedIn, or Internshala.
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the repository's `apps/extension` folder.
4. Open the ApplyPilot extension popup on the portal page. Review/edit the detected company and role, choose the current status, and select **Capture in ApplyPilot**.
5. The extension sends the selected record to your signed-in ApplyPilot tab, where the normal CSRF-protected API saves it. Capturing the same job URL again updates the existing record and adds a status-history event.

The extension reads only the active page after you click it. It does not collect portal passwords, browse other pages, or run background scraping. Chrome may show the permission to read the current tab because it uses `activeTab`.

## Quality checks

```powershell
npm run typecheck
npm test
npm run build
```

## Deployment (Vercel + Render)

The root `vercel.json` builds the frontend and proxies `/api/*` to the Render API. This same-origin proxy is required for the app's HTTP-only session cookies. The root `render.yaml` defines a free Render web service and PostgreSQL database in Singapore.

1. In Render, create a Blueprint from this GitHub repository and apply `render.yaml`.
2. Set the Render API service's `WEB_ORIGIN` to the exact production Vercel origin (for example, `https://your-project.vercel.app`).
3. Import the repository into Vercel and set the project root directory to `apps/web`. The web app's `vercel.json` proxies `/api/*` to the Render API and rewrites client-side routes to `index.html`. The root `vercel.json` provides equivalent settings if you deploy the repository root instead.
4. Deploy the Vercel project. No `VITE_API_URL` setting is needed; production uses the same-origin `/api/v1` proxy.
5. To enable Gmail in production, set the OAuth client credentials, a persistent 32-byte `OAUTH_TOKEN_ENCRYPTION_KEY`, and `GOOGLE_OAUTH_REDIRECT_URL` in Render's environment settings. Add the exact callback URL to the Google OAuth client. Configure optional AI credentials there as well; never put production secrets in Vercel's frontend variables.

**Free-tier warning:** Render free web services can sleep after inactivity, and free PostgreSQL databases expire after 30 days. After the additional 14-day grace period, Render deletes the database and its data. Free databases also have no backups. Use this setup only for a temporary demo; upgrade the database before storing data you need to keep. The deployed database starts empty; local SQLite records are not copied.

## API

All routes are under `/api/v1`. Responses are `{ "data": ... }` or `{ "error": { "code": ..., "message": ... } }`.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/auth/csrf` | No | Issue/read CSRF token |
| POST | `/auth/register` | CSRF | Register + session (`201`) |
| POST | `/auth/login` | CSRF | Log in (`200`) |
| POST | `/auth/logout` | Yes + CSRF | Revoke session (`204`) |
| GET | `/auth/me` | Yes | Current account |
| GET | `/applications` | Yes | Paginated list (`page`, `pageSize`, `status`, `q`) |
| POST | `/applications` | Yes + CSRF | Create application + event (`201`) |
| POST | `/applications/import` | Yes + CSRF | Fetch public job-page details from `{ "url": "https://..." }` |
| POST | `/applications/capture` | Yes + CSRF | Create/update a portal-page capture |
| GET | `/applications/:id` | Yes | Application and timeline |
| PATCH | `/applications/:id` | Yes + CSRF | Edit application |
| PATCH | `/applications/:id/status` | Yes + CSRF | Change status + history |
| DELETE | `/applications/:id` | Yes + CSRF | Delete application (`204`) |
| GET | `/dashboard` | Yes | Record-derived dashboard totals |
| POST | `/integrations/gmail/connect` | Yes + CSRF | Start Google read-only OAuth |
| GET | `/integrations/gmail/callback` | Yes + valid OAuth state | Finish Gmail connection for the signed-in user |
| GET | `/integrations/gmail/status` | Yes | Gmail connection status |
| POST | `/integrations/gmail/sync` | Yes + CSRF | Run inbox sync immediately |
| DELETE | `/integrations/gmail` | Yes + CSRF | Revoke and remove Gmail connection |
| GET | `/toolkit/resumes` | Yes | List private resumes and tailored-for descriptions |
| POST | `/toolkit/resumes` | Yes + CSRF | Upload private PDF/DOCX resume |
| PATCH | `/toolkit/resumes/:id` | Yes + CSRF | Update the resume's tailored-for description |
| POST | `/toolkit/resumes/:id/ats-score` | Yes + CSRF | Generate an AI ATS estimate and recommendations |
| POST | `/toolkit/interview-preps/:id/chat` | Yes + CSRF | Ask the AI coach using that prep's notes and linked job context |

Validation uses Zod. Foreign-owned and nonexistent records both return `404`.
The application form can import a public HTTPS job page and prefill details exposed through page metadata or Schema.org `JobPosting` data. Review the fields before saving. The importer does not sign in to job portals, and some portals may block automated page access. Requests are restricted to public IP addresses, HTTPS, a small response size, short timeouts, and a limited number of redirects.

## Production-readiness checklist

- [x] Persistent schema and versioned initial migration
- [x] Password hashing, session expiry/revocation, CSRF, auth rate limits
- [x] User-scoped application access and transactional status history
- [x] Request validation, security headers, centralized errors
- [x] API integration tests for auth, persistence, history, and cross-user access
- [x] Upgrade to Prisma 7.10.1 and resolve the Prisma CLI transitive `deepmerge-ts` audit advisories
- [ ] PostgreSQL migration, production pooling, CI/deployment, backup/restore
- [ ] Email verification, password reset, account export/deletion
- [x] Private resume storage, document text extraction, configurable AI adapter
- [ ] Background worker, durable AI analysis history, interviews, notifications
- [ ] E2E and accessibility coverage, monitoring, production domain/TLS

This milestone is not production-deployable until remaining infrastructure and product requirements are completed.
