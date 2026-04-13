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

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=<your MongoDB connection string>
JWT_SECRET=<random 64-byte hex string>
JWT_EXPIRES_IN=8h
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
