# Lisan KSA

Saudi-focused multilingual digital understanding companion.

## Project Structure
- [backend/](file:///Users/aymanshilledar/Downloads/lisan-ksa/backend) (Go + chi API server, Neon PostgreSQL, Redis, Migrations, OpenAPI)
- [frontend/](file:///Users/aymanshilledar/Downloads/lisan-ksa/frontend) (React Native + Expo mobile application)
- [prisma/](file:///Users/aymanshilledar/Downloads/lisan-ksa/prisma) (Prisma ORM schema & visual database management for Neon)

---

## 1. How to Run the Backend

Open a terminal window and run:

```bash
cd backend
go run ./cmd/api
```

### What happens automatically:
* Loads environment variables from `backend/.env`.
* Connects to your **Neon PostgreSQL** database and applies pending SQL migrations (including seed data for Saudi workplace terminology and labor guidance).
* Connects to **Redis** on port `6379` (with fail-safe in-memory rate limiting fallback).
* Connects to the **MyMemory Neural Translation Engine** by default (supporting live Arabic, Urdu, Hindi, Bengali, English translation without requiring an API key).
* Starts listening on `http://localhost:8080`.

Verify the backend:
```bash
curl http://localhost:8080/ready
```
Output:
```json
{"database":"connected","redis":"connected","status":"ready"}
```

---

## 2. Visual Database Studio (Prisma)

To view and manage your live **Neon PostgreSQL** database tables (users, glossary terms, translation history, knowledge chunks) in a visual browser UI:

```bash
npx prisma studio
```
Or:
```bash
npm run prisma:studio
```
Then open `http://localhost:5555` in your browser.

---

## 3. How to Run the Mobile Frontend

Open another terminal window and run:

```bash
cd frontend
npx expo start
```

* Scan the QR code with **Expo Go** on your phone (or press `i` for iOS simulator / `a` for Android emulator).
* The app automatically connects to the backend at `http://localhost:8080`, showing live connection badges for the API, Neon DB, and Redis, with live language selection and translation UI.

---

## 4. How to Run Redis in Docker (Optional)

From the project root:
```bash
docker compose up -d redis
```

---

## 5. Verification Commands

* **Backend tests:** `cd backend && go test -v ./...`
* **Frontend check:** `cd frontend && npm run typecheck`
* **Prisma schema validation:** `npx prisma validate`
