# Smart Waste Management System (Web Portal)

This project is a complete **web portal** implementation with:
- Separate public and private-admin Angular builds (`frontend/`)
- Node.js + Express + MongoDB backend (`backend/`)

## Current Portal Features

- Public User/Worker portal and separately deployed private Admin Console
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

Login routes:

- User: `http://localhost:4200/login`
- Worker: `http://localhost:4200/worker-console`
- Admin: `http://localhost:4300/admin-console`

## Build Frontend

```bash
cd frontend
npm run build
npm run build:admin
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

## Private Admin Deployment

1. Deploy `smartwaste-admin-backend` and `smartwaste-admin` from `render.yaml`.
2. Point the admin app's `API_BASE_URL` to the admin backend, and set that backend's
   `ADMIN_FRONTEND_URL` to the exact admin-app origin.
3. Give public and admin backends the same `MONGO_URI`. Their `SERVICE_MODE` values are pinned to
   `public` and `admin` in `render.yaml`.
4. Set `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` on the admin backend for its first
   startup.
5. Confirm the admin account exists, then remove `SEED_ADMIN_PASSWORD` from Render.
6. Create Cloudflare Access applications for both admin hostnames with MFA. Set the admin backend's
   `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` values from that Access application. The backend
   verifies Cloudflare's signed assertion, so its direct Render origin cannot bypass Access.

Using `app.example.com`, `api.example.com`, `admin.example.com`, and `admin-api.example.com` under
one parent domain avoids third-party-cookie restrictions. If the admin-backend hostname changes,
also update the admin service's Content Security Policy in `render.yaml`.

MongoDB creates the `admin_sessions` collection and its expiry index automatically. The migration
does not modify tickets, users, hire requests, or notifications. Existing admin bearer tokens are
rejected after deployment; the public backend has no admin-login endpoint, and the admin backend
accepts no public or worker bearer tokens.

Passwords created through signup or admin account management require at least 8 characters, one
uppercase letter, and one special character.
