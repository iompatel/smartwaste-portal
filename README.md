# Smart Waste Management System (Web Portal)

This project is a complete **web portal** implementation with:
- One shared Angular application deployed in fixed citizen, worker, and admin modes (`frontend/`)
- Node.js + Express + MongoDB backend (`backend/`)

## Current Portal Features

- Public user portal, separately deployed Worker Console, and private Admin Console
- Firebase email-password + Google login bridge for public user accounts
- Role-based dashboards (Admin, Worker, User)
- Named routes with route guards
- Admin panel for user, worker, ticket, notification, and hire-request operations
- Separate Users and Workers sections with account creation, detail views, updates, and deletion
- Downloadable user and worker PDF registers with a Smart Waste Corporation seal and work totals
- Filterable account activity for sign-in, sign-out, worker duty changes, and ticket lifecycle events
- Admin Google Maps fleet view with location uploads and refresh every three seconds
- Ticket CRUD module with assignment and status changes
- Tracked ticket lifecycle (`pending → assigned → accepted → in progress → completed`)
- Online worker heartbeat, hybrid auto/admin dispatch, and SLA-overdue indicators
- In-app completion OTP with required after-photo proof
- Ticket-scoped user/worker/admin chat and in-app notifications
- Privacy-scoped worker live location with a free OpenStreetMap view during active work
- Post-completion worker ratings, reviews, filters, and repeat requests
- Profile management
- Settings page (theme, logout, notifications)
- Camera / Gallery upload support for tickets
- Location integration + Google Maps preview / tracking
- Browser notifications integration
- Environmental operations design system (forest/teal/lime) across auth, shell, dashboard, admin, and ticket flows

## Tech Stack

- Frontend: Angular 22 (standalone components, Tailwind CSS v4)
- Backend: Node.js, Express 5, MongoDB, Mongoose
- Public auth: Firebase/backend JWT bridge
- Admin auth: short-lived HttpOnly cookie, DB-backed session, and CSRF protection
- Database: MongoDB at `MONGO_URI`, with one optional startup-selected auxiliary store:
  Cloudflare D1 or `WORKER_LOCATION_MONGO_URI`

## Firebase Setup

1. Enable **Email/Password**:
   - Firebase Console -> Authentication -> Sign-in method -> Email/Password -> Enable
2. Add Firebase app config in:
   - `frontend/src/environments/environment.ts`
   - `frontend/src/environments/environment.prod.ts`
3. Provide Firebase Admin credentials through one of the variables documented in
   `backend/.env.example`.
4. Copy backend env:
   - `cp backend/.env.example backend/.env`
5. Confirm env values:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `PUBLIC_FRONTEND_URL`
   - `ADMIN_FRONTEND_URL`

## MongoDB Setup

Use any local MongoDB instance. Example options:

### Option 1: Homebrew service

```bash
brew services start mongodb-community
```

### Option 2: Local `mongod`

```bash
mongod --dbpath ~/data/db
```

Default backend URI:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/smart_waste_portal
```

### Optional auxiliary database for live GPS and chat

The main database keeps users, tickets, messages, notifications, reviews, and hire requests.
Live worker GPS pings can use a separate MongoDB database because they are independent,
high-write, short-lived records:

```bash
MONGO_URI=mongodb+srv://USER:PASSWORD@PRIMARY/smart_waste_portal
WORKER_LOCATION_MONGO_URI=mongodb+srv://USER:PASSWORD@LOCATIONS/smart_waste_locations
```

Cloudflare D1 is authoritative when all three `CF_*` variables are configured; otherwise
`WORKER_LOCATION_MONGO_URI` is authoritative when set. The backend refuses to start if the configured
store is unavailable, rather than silently writing to another database. When neither is configured,
the primary MongoDB is used. `/api/ready` reports the selected store and returns 503 when it is
unavailable.

MongoDB Atlas Free clusters (formerly M0) can host this setup. Atlas currently limits each Free
cluster to 0.5 GB including indexes and 100 operations/second, with one Free cluster per Atlas
project. Multiple logical databases on one cluster share those limits and do not create extra
capacity. A second Atlas project can host the location cluster, subject to Atlas account and
organization policies. Keep both clusters in the same region as Render to avoid added latency.
See the official [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

This split gives the location workload a separate free quota; it does not make every request faster.
Free tiers are suitable for demos and low traffic, not a production SLA. Configure
`FIREBASE_STORAGE_BUCKET` to move ticket/profile images out of MongoDB; the backend creates download
tokens and removes owned files when records are replaced or deleted.

Do not split tickets, users, and assignments across databases: those flows depend on each other and
would become slower and lose simple atomic updates. The compound indexes declared by the backend
provide the main speed improvement for those collections.

## Run Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Backend runs on `http://localhost:4000`.

## Run Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:4200`.

Run the private admin build separately:

```bash
cd frontend
npm run start:admin
```

Admin runs on `http://localhost:4300`.

Run the worker build separately:

```bash
cd frontend
npm run start:worker
```

Worker Console runs on `http://localhost:4400`.

Login routes:

- User: `http://localhost:4200/login`
- Worker: `http://localhost:4400/worker-console`
- Admin: `http://localhost:4300/admin-console`

## Build Frontend

```bash
cd frontend
npm run build
npm run build:admin
npm run build:worker
```

## API Quick Check

```bash
curl http://localhost:4000/api/health
```

Expected response includes:

```json
{
  "status": "ok"
}
```

Database readiness is available separately at `http://localhost:4000/api/ready` and returns
`503` while MongoDB is disconnected.

## Creating Accounts

- Citizens create their own accounts from the public **Create resident account** form.
- Workers are created by an administrator from **Admin Console → Accounts**.
- There is no default admin password. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` for one
  startup to create an admin, then remove `SEED_ADMIN_PASSWORD` from the environment. Existing data
  is not overwritten.

The admin deployment must be placed behind Cloudflare Access, Tailscale, a VPN, or another
identity-aware proxy. A separate Render URL alone is still public.

The reference deployment uses `smartwaste.dpdns.org`: `admin.smartwaste.dpdns.org` serves the
console and proxies `/api/*` to the admin backend on the same authenticated hostname.
`admin-api.smartwaste.dpdns.org` remains available for diagnostics. Both are proxied by Cloudflare
and fronted by `cloudflare/admin-gate`, a Worker that requires HTTP Basic auth before forwarding. The
backend therefore runs with `REQUIRE_CF_ACCESS=false`; its own session auth and login throttle stay
in force behind the gate. If Cloudflare Access becomes available (it needs a payment method on the
free plan), deploy the Access application instead, set `REQUIRE_CF_ACCESS=true`, and add
`CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD`.

## Private Admin Deployment

1. Deploy `smartwaste-admin-backend` and `smartwaste-admin` from `render.yaml`.
2. Point the admin app's `API_BASE_URL` to `https://admin.example.com/api`, and set the backend's
   `ADMIN_FRONTEND_URL` to the exact admin-app origin.
3. Give public and admin backends the same database, D1, Firebase Admin, and storage settings. Their
   `SERVICE_MODE` values are pinned to `public` and `admin` in `render.yaml`.
4. Set `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` on the admin backend for its first
   startup.
5. Confirm the admin account exists, then remove `SEED_ADMIN_PASSWORD` from Render.
6. Gate the admin hostnames at the edge. Both are proxied records in Cloudflare; deploy the Worker
   with `cd cloudflare/admin-gate && npx wrangler deploy`, then set its secrets with
   `npx wrangler secret put BASIC_PASS` and `npx wrangler secret put EDGE_SECRET` (use
   `openssl rand -base64 32`). The Worker routes must match the custom domains, and it strips the
   Basic credential before forwarding to Render.
   To make the Render origin unusable directly, also set `ADMIN_EDGE_SECRET_HASH` on the admin
   backend to the SHA-256 hex of the same `EDGE_SECRET` value. The backend then returns 404 for any
   request that did not come through the Worker (`/api/health` stays open for health checks).
   To use Cloudflare Access instead, create one Access application for both hostnames with MFA,
   set the backend's `REQUIRE_CF_ACCESS=true`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD`, remove
   the Worker routes, and remove `ADMIN_EDGE_SECRET_HASH`. The backend verifies Cloudflare's signed
   assertion, so its direct Render origin cannot bypass Access.

Using `app.example.com`, `api.example.com`, and `admin.example.com` under one parent domain avoids
third-party-cookie restrictions. Replace the `dpdns.org` hostnames in
`cloudflare/admin-gate/wrangler.toml`, the admin backend's `ADMIN_FRONTEND_URL`, and the admin
service's `API_BASE_URL` + Content Security Policy together. If the admin-backend hostname changes,
also update the admin service's Content Security Policy in `render.yaml`.

MongoDB creates the `admin_sessions` collection and its expiry index automatically. The migration
also creates `ticket_messages`, `reviews`, and `worker_locations` automatically. Existing ticket and user documents need
no manual MongoDB edits: Mongoose supplies defaults, assigned legacy tickets are moved into the
tracked lifecycle, and active legacy tickets receive a completion code on public-backend startup.
Existing admin bearer tokens are rejected after deployment; the public backend has no admin-login
endpoint, and the admin backend accepts no public or worker bearer tokens.

Worker live location is stored only as the latest GPS point in `worker_locations`. It is visible
to the assigned requester and worker while a ticket is accepted or in progress. Administrators can
view online workers' latest shared location in the fleet map. Each captured GPS fix
expires automatically after two minutes. Workers must explicitly go online and grant browser
location permission; no location history is retained.

## Admin accounts, activity, and reports

Use **Admin Console → Users** and **Workers** to create, view, edit, or delete accounts.
Worker creation accepts an optional unique numeric worker ID, name, email, phone, address,
gender, password, and password confirmation. An ID is generated when left blank. Account IDs
cannot be changed after creation. Password changes invalidate existing sessions.

**Account activity** records user and worker logins/logouts, worker online/offline transitions,
and ticket creation, acceptance, start, completion, and cancellation from this update onward.
Filter by role, account ID, event, and date; open an event to view its captured ticket and
participant details. Passwords, authentication tokens, and completion OTPs are excluded.
Earlier events cannot be reconstructed automatically. Activity records remain after account deletion.

**PDF reports** downloads a user or worker account register with the corporation seal, report ID,
issuer, page numbers, contact details, and completed/open ticket totals. Optional dates filter
account registration dates; ticket totals cover the selected accounts' complete history.

**Live worker map** refreshes every three seconds and hides offline or expired GPS fixes.
Set `GOOGLE_MAPS_API_KEY` on the admin frontend build to enable interactive fleet markers and
following a selected worker. Enable Maps JavaScript API and restrict the browser key to the admin
hostname. `render.yaml` provides the variable and required map CSP sources. With no key, the page
uses a Google Maps preview for the selected worker. Local builds can set the variable before
running `npm run build:admin`; no key is stored in source control.

Passwords created through signup or admin account management require at least 8 characters, one
uppercase letter, and one special character.

## Worker Portal Deployment

Workers cannot sign up from the public portal. An administrator creates worker accounts in
**Admin Console → Workers**, and workers sign in only at `https://worker.smartwaste.dpdns.org`.
The Worker Console is a separate Angular deployment but reuses the public API. Set the public
backend's `WORKER_FRONTEND_URL=https://worker.smartwaste.dpdns.org` so browser requests from the
worker origin pass CORS. The public frontend deliberately has no worker-login route or link.

Render's card-free account tier permits only two custom domains, already used by the admin app and
API. The worker hostname therefore uses the free `cloudflare/worker-portal` proxy: create a proxied
`worker` CNAME pointing to `smartwaste-worker.onrender.com`, then deploy it with
`cd cloudflare/worker-portal && npx wrangler deploy`. This proxy has no edge password; each worker
authenticates with the account created for them by an administrator.
