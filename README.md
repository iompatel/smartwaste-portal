# Smart Waste Management System (Web Portal)

This project is a complete **web portal** implementation with:
- Separate public, worker, and private-admin Angular builds (`frontend/`)
- Node.js + Express + MongoDB backend (`backend/`)

## Current Portal Features

- Public user portal, separately deployed Worker Console, and private Admin Console
- Firebase email-password + Google login bridge for public user accounts
- Role-based dashboards (Admin, Worker, User)
- Named routes with route guards
- Admin panel for user, worker, ticket, notification, and hire-request operations
- Ticket CRUD module with assignment and status changes
- Profile management
- Settings page (theme, logout, notifications)
- Camera / Gallery upload support for tickets
- Location integration + Google Maps preview / tracking
- Browser notifications integration
- Apple-inspired design system across auth, shell, dashboard, admin, and ticket flows

## Tech Stack

- Frontend: Angular 20 (standalone components, SCSS)
- Backend: Node.js, Express 5, MongoDB, Mongoose
- Public auth: Firebase/backend JWT bridge
- Admin auth: short-lived HttpOnly cookie, DB-backed session, and CSRF protection
- Database: MongoDB database at `MONGO_URI`

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

## Demo Accounts

- Worker: `worker@smartwaste.com` / `Worker#123` (use `/worker-console`)
- User: `user@smartwaste.com` / `User#123` (use `/login`)

Demo users are not seeded in production unless `SEED_DEMO_USERS=true`. There is no default admin
password. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` for one startup to create an admin, then
remove `SEED_ADMIN_PASSWORD` from the environment. Existing data is not overwritten.

The admin deployment must be placed behind Cloudflare Access, Tailscale, a VPN, or another
identity-aware proxy. A separate Render URL alone is still public.

The reference deployment uses `smartwaste.dpdns.org`: `admin.smartwaste.dpdns.org` for the console
and `admin-api.smartwaste.dpdns.org` for its backend. Both are proxied by Cloudflare and fronted by
`cloudflare/admin-gate`, a Worker that requires HTTP Basic auth before forwarding to Render. The
backend therefore runs with `REQUIRE_CF_ACCESS=false`; its own session auth and login throttle stay
in force behind the gate. If Cloudflare Access becomes available (it needs a payment method on the
free plan), deploy the Access application instead, set `REQUIRE_CF_ACCESS=true`, and add
`CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD`.

## Private Admin Deployment

1. Deploy `smartwaste-admin-backend` and `smartwaste-admin` from `render.yaml`.
2. Point the admin app's `API_BASE_URL` to the admin backend, and set that backend's
   `ADMIN_FRONTEND_URL` to the exact admin-app origin.
3. Give public and admin backends the same `MONGO_URI`. Their `SERVICE_MODE` values are pinned to
   `public` and `admin` in `render.yaml`.
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

Using `app.example.com`, `api.example.com`, `admin.example.com`, and `admin-api.example.com` under
one parent domain avoids third-party-cookie restrictions. Replace the `dpdns.org` hostnames in
`cloudflare/admin-gate/wrangler.toml`, the admin backend's `ADMIN_FRONTEND_URL`, and the admin
service's `API_BASE_URL` + Content Security Policy together. If the admin-backend hostname changes,
also update the admin service's Content Security Policy in `render.yaml`.

MongoDB creates the `admin_sessions` collection and its expiry index automatically. The migration
does not modify tickets, users, hire requests, or notifications. Existing admin bearer tokens are
rejected after deployment; the public backend has no admin-login endpoint, and the admin backend
accepts no public or worker bearer tokens.

Passwords created through signup or admin account management require at least 8 characters, one
uppercase letter, and one special character.

## Worker Portal Deployment

Workers cannot sign up from the public portal. An administrator creates worker accounts in
**Admin Console → Workers**, and workers sign in only at `https://worker.smartwaste.dpdns.org`.
The Worker Console is a separate Angular deployment but reuses the public API. Set the public
backend's `WORKER_FRONTEND_URL=https://worker.smartwaste.dpdns.org` so browser requests from the
worker origin pass CORS. The public frontend deliberately has no worker-login route or link.
