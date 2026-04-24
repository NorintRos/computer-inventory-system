# Computer Inventory System

A web-based inventory management system for tracking computers, peripherals, keys, and transactions across an organization. Built with Node.js, Express, MongoDB, and Handlebars.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MongoDB (Mongoose) |
| View Engine | Handlebars (express-handlebars) |
| Auth | JWT + bcrypt |
| Session/Flash | express-session + connect-mongo + connect-flash |
| Validation | express-validator |
| File Uploads | multer + multer-gridfs-storage |

---

## Project Structure

```
computer-inventory-system/
├── config/
│   ├── cors.js          # Same-origin CORS policy
│   ├── db.js            # MongoDB connection
│   └── session.js       # Session config (MongoStore, 8h cookie)
├── helpers/
│   └── hbs.js           # Handlebars helpers (formatDate, timeAgo, statusBadge, eq, select)
├── middleware/
│   ├── errorHandler.js  # Global error handler
│   └── rateLimiter.js   # 20 req/min rate limit
├── models/              # Mongoose models (populated in Sprint 1+)
├── routes/
│   ├── api/             # JSON API routes (/api/auth, /api/users, /api/items, /api/keys, /api/transactions)
│   └── ui/              # Server-rendered UI routes (/, /auth, /items, /users, /keys, /transactions, /history, /reports)
├── scripts/
│   └── seed.js          # Seeds the default admin account
├── views/
│   ├── layouts/         # Handlebars layout templates
│   └── partials/        # Reusable Handlebars partials
├── public/
│   ├── css/             # Static stylesheets
│   └── js/              # Static client-side scripts
└── server.js            # App entry point
```

---

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (or local MongoDB instance)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and edit it (or create `.env` manually):

```bash
cp .env.example .env
```

On Windows PowerShell: `Copy-Item .env.example .env`

Fill in `.env` in the project root (minimum: **`MONGODB_URI`**, **`JWT_SECRET`**, **`SESSION_SECRET`** for the full app):

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=<your MongoDB connection string>
JWT_SECRET=<random 64-byte hex string>
JWT_EXPIRES_IN=8h
JWT_COOKIE_NAME=cis_token
COOKIE_NAME=cis_session
SESSION_SECRET=<random 64-byte hex string>
```

Generate secure secrets with:

```bash
node -e "const c = require('crypto'); console.log(c.randomBytes(64).toString('hex'));"
```

### 3. Seed the admin account

```bash
npm run seed
```

Default credentials: `admin` / `admin123` — change after first login.

### 4. Start the server

```bash
npm run dev     # development (nodemon)
npm start       # production
```

Server runs at `http://localhost:3000`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm start` | Start in production mode |
| `npm run seed` | Seed default admin account |
| `npm test` | Run Jest test suite |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Run Prettier |

---

## Security

- **CORS**: Same-origin only — cross-origin requests are rejected
- **Rate limiting**: 20 requests per minute per IP (returns `429` when exceeded)
- **Helmet**: Sets secure HTTP headers
- **Sessions**: Stored in MongoDB, 8-hour expiry
- **Passwords**: Hashed with bcrypt (cost factor 10)
- **Auth**: JWT stored in a cookie (`cis_session`)

### API keys (Member C)

Programmatic access can use the `x-api-key` header. Keys are created via the JSON API (JWT required).

| Endpoint | Description |
|---|---|
| `POST /api/keys` | Create a key. The response includes the **raw key once**; only a bcrypt hash and SHA-256 lookup digest are stored. |
| `GET /api/keys` | List **active** keys (no secret material). Admins see all active keys; other users see their own. |
| `DELETE /api/keys/:id` | Revoke a key (`active: false`). Owner or Admin. |

**Items API:** `GET /api/items` accepts either a JWT (`Authorization: Bearer …`, or cookie `cis_token` by default — override with `JWT_COOKIE_NAME`) **or** a valid `x-api-key`.

**Disabled users:** Keys whose owner has `status: Disabled` are rejected when used (treated as invalid).

---

## Handlebars Helpers

| Helper | Usage | Description |
|---|---|---|
| `eq` | `{{#if (eq status "Available")}}` | Strict equality check |
| `formatDate` | `{{formatDate date "MMM D, YYYY"}}` | Format a date |
| `timeAgo` | `{{timeAgo createdAt}}` | Relative time ("3 days ago") |
| `statusBadge` | `{{statusBadge status}}` | Returns a CSS badge class |
| `json` | `{{json this}}` | JSON stringify (debug) |
| `select` | `{{#select value}}` | Pre-selects a dropdown option |
