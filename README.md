# Smart Waste Management System (Web Portal)

This project is a complete **web portal** implementation with:
- Angular frontend (`frontend/`)
- Node.js + Express + MongoDB backend (`backend/`)

## Current Portal Features

- User/worker login, separate Admin Console login, Signup, and Forgot Password
- Firebase email-password login + Google login bridge
- Role-based dashboards (Admin, Worker, User)
- Named routes with route guards
- Admin panel for user, worker, ticket, notification, and hire-request operations
- Ticket CRUD module with assignment and status changes
- Profile management
- Settings page (theme, logout, notifications)
- Camera / Gallery upload support for tickets
- Location integration + Google Maps preview / tracking
- Browser notifications integration
- Restored glass-style UI theme across auth, shell, dashboard, admin, and ticket flows

## Tech Stack

- Frontend: Angular 20 (standalone components, SCSS)
- Backend: Node.js, Express 5, MongoDB, Mongoose
- Auth: Firebase Authentication + backend JWT session bridge
- Database: MongoDB database at `MONGO_URI`

## Firebase Setup

1. Enable **Email/Password**:
   - Firebase Console -> Authentication -> Sign-in method -> Email/Password -> Enable
2. Add Firebase app config in:
   - `frontend/src/environments/environment.ts`
   - `frontend/src/environments/environment.prod.ts`
3. Add Firebase service account JSON:
   - Copy `backend/firebase-service-account.example.json` to `backend/firebase-service-account.json`
   - Paste real service account values
4. Copy backend env:
   - `cp backend/.env.example backend/.env`
5. Confirm env values:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT_PATH`

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

Admin Console runs at `http://localhost:4200/admin-console`. Public user and worker login remains
at `http://localhost:4200/login`.

## Build Frontend

```bash
cd frontend
npm run build
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

- Admin: `admin@smartwaste.com` / `Admin#123` (use `/admin-console`)
- Worker: `worker@smartwaste.com` / `Worker#123`
- User: `user@smartwaste.com` / `User#123`

Passwords created through signup or the Admin Console require at least 8 characters, one uppercase
letter, and one special character.
