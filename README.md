# Computer Inventory System

A web-based inventory management system for tracking computers, peripherals, and transactions across an organization. Built with Node.js, Express, MongoDB, and Handlebars.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Database | MongoDB Atlas (Mongoose) |
| View Engine | Handlebars (express-handlebars) |
| Auth | JWT + bcrypt |
| Session/Flash | express-session + connect-mongo + connect-flash |
| Validation | express-validator |
| File Uploads | multer + multer-gridfs-storage (GridFS) |
| HTTP Security | Helmet + express-rate-limit |

---

## Project Structure

```
computer-inventory-system/
├── config/
│   ├── cors.js          # Same-origin CORS policy
│   ├── db.js            # MongoDB connection
│   ├── gridfs.js        # GridFSBucket singleton
│   ├── session.js       # Session config (MongoStore, 8h cookie)
│   └── upload.js        # Multer + GridFS storage setup
├── helpers/
│   └── hbs.js           # Handlebars helpers
├── middleware/
│   ├── apiKey.js        # x-api-key header validation
│   ├── apiResponse.js   # Standardized JSON response helpers
│   ├── auth.js          # JWT verification (header or cookie)
│   ├── errorHandler.js  # Global error handler
│   ├── rateLimiter.js   # 20 req/min per IP
│   ├── rbac.js          # Role-based access control
│   ├── uiAuth.js        # UI-specific auth (redirect on failure)
│   └── validateRequest.js
├── models/
│   ├── ApiKey.js
│   ├── Item.js
│   ├── Transaction.js
│   └── User.js
├── routes/
│   ├── api/             # JSON API routes
│   │   ├── auth.js      # POST /api/auth/login
│   │   ├── files.js     # GET /api/files/:id (GridFS download)
│   │   ├── items.js     # CRUD + history
│   │   ├── keys.js      # API key management
│   │   ├── transactions.js
│   │   └── users.js
│   └── ui/              # Server-rendered Handlebars routes
│       ├── auth.js
│       ├── history.js
│       ├── index.js     # Dashboard
│       ├── items.js
│       ├── keys.js
│       ├── reports.js
│       ├── transactions.js
│       └── users.js
├── views/
│   ├── layouts/main.hbs
│   ├── partials/        # navbar, footer, flash
│   ├── auth/login.hbs
│   ├── dashboard.hbs
│   ├── items/           # form, index
│   ├── keys/index.hbs
│   ├── transactions/    # checkout, checkin, index
│   ├── history/         # index, item
│   ├── reports/index.hbs
│   └── users/index.hbs
├── tests/
│   ├── auth.test.js
│   ├── gridfs.test.js
│   ├── items.test.js
│   ├── keys.test.js
│   └── transactions.test.js
├── scripts/
│   └── seed.js          # Seeds admin account and demo data
├── public/
│   ├── css/style.css
│   └── js/main.js
└── server.js
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

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Minimum required variables:

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

Generate secure secrets:

```bash
node -e "const c = require('crypto'); console.log(c.randomBytes(64).toString('hex'));"
```

### 3. Seed the database

```bash
npm run seed
```

Default admin credentials: `admin` / `admin123` — change after first login.

Demo accounts:

| Username | Password | Role | Purpose |
|---|---|---|---|
| `demo_tech` | `demo123` | Technician | Shows assigned laptop activity |
| `demo_helpdesk` | `demo123` | Technician | Shows helpdesk desktop assignment |
| `tech1` | `tech123` | Technician | technician first test |
The seed creates demo inventory records (`DEMO-*`) across all statuses plus transaction history for checkout/checkin timelines and reports.

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
| `npm run seed` | Seed admin account and demo records |
| `npm test` | Run Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Run Prettier |

---

## API

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Returns JWT + sets httpOnly cookie |

### Users (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/users` | Create user |
| PATCH | `/api/users/:id/role` | Update role |
| PATCH | `/api/users/:id/status` | Enable / Disable user |

Disabling a user automatically revokes all their API keys.

### Items

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/items` | JWT **or** API key | List items (supports `?status=`, `?category=`, `?brand=`) |
| GET | `/api/items/:id` | JWT | Get single item |
| POST | `/api/items` | JWT | Create item |
| PUT | `/api/items/:id` | JWT | Update item |
| DELETE | `/api/items/:id` | JWT (Admin) | Soft delete |
| GET | `/api/items/:id/history` | JWT | Full transaction history |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/transactions/checkout` | Assign item to user (multipart, optional file) |
| POST | `/api/transactions/checkin` | Return item (multipart, optional file) |

Items in `Maintenance` or `Retired` status cannot be checked out.

### API Keys (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/keys` | Generate key — raw value shown **once** |
| GET | `/api/keys` | List active keys (no secret material) |
| DELETE | `/api/keys/:id` | Revoke key |

Use the `x-api-key` header for programmatic access. Only `GET /api/items` accepts API key auth; all other endpoints require JWT.

### Files

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/files/:id` | Stream a GridFS file (JWT required) |

---

## Security

- **CORS**: Same-origin only.
- **Rate limiting**: 20 requests per minute per IP (returns `429` when exceeded).
- **Helmet**: Secure HTTP headers.
- **Sessions**: Stored in MongoDB, 8-hour expiry.
- **Passwords**: bcrypt (cost factor 10) — never stored or returned in plaintext.
- **JWT**: httpOnly cookie prevents XSS access.
- **API keys**: SHA-256 hashed — raw value shown once, never retrievable.
- **RBAC**: User creation, key management, and item deletion are Admin-only.

---

## Handlebars Helpers

| Helper | Example | Description |
|---|---|---|
| `eq` | `{{#if (eq status "Available")}}` | Strict equality |
| `formatDate` | `{{formatDate date "MMM D, YYYY"}}` | Format a date |
| `timeAgo` | `{{timeAgo createdAt}}` | Relative time ("3 days ago") |
| `statusBadge` | `{{statusBadge status}}` | CSS badge class |
| `json` | `{{json this}}` | JSON stringify (debug) |
| `select` | `{{#select value}}` | Pre-select a dropdown option |
