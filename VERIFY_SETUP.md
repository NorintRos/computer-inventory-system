# Setup Verification Checklist

Run through each step in order. Every check must pass before moving to Sprint 1.

---

## 1. Dependencies

```bash
npm ls --depth=0
```

Confirm ALL of the following appear without `MISSING` or `ERR`:

**Core:** express, express-handlebars, mongoose, dotenv, method-override, express-session, connect-flash, connect-mongo, dayjs

**Auth & Security:** bcrypt, jsonwebtoken, cookie-parser, cors, express-rate-limit, helmet

**File Upload:** multer, multer-gridfs-storage

**Logging & Validation:** morgan, express-validator

**Dev:** nodemon, jest, supertest, dotenv-cli, cross-env, eslint, eslint-config-airbnb-base, eslint-plugin-import, prettier, eslint-config-prettier

---

## 2. Environment Variables

```bash
node -e "require('dotenv').config(); const keys = ['PORT','NODE_ENV','MONGODB_URI','JWT_SECRET','JWT_EXPIRES_IN','COOKIE_NAME','SESSION_SECRET']; keys.forEach(k => console.log(k + ':', process.env[k] ? 'SET' : 'MISSING'));"
```

All 7 variables must show `SET`.

---

## 3. MongoDB Connection

```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { console.log('SUCCESS: MongoDB connected'); process.exit(0); }).catch(err => { console.error('FAIL:', err.message); process.exit(1); });"
```

Expected: `SUCCESS: MongoDB connected`

---

## 4. Seed Admin Account

```bash
npm run seed
```

Expected: `Admin seeded: admin / admin123`

Verify in MongoDB Atlas (or via shell):

```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const user = await mongoose.connection.db.collection('users').findOne({ username: 'admin' }); console.log(user ? 'SUCCESS: Admin found — role: ' + user.role + ', status: ' + user.status : 'FAIL: Admin not found'); process.exit(0); });"
```

Expected: `SUCCESS: Admin found — role: Admin, status: Enabled`

---

## 5. Server Starts

```bash
npm run dev
```

Console must show:

- `MongoDB connected`
- `Server running on port 3000`

No crash, no unhandled errors.

---

## 6. Handlebars Renders

Open `http://localhost:3000` in a browser.

- Page loads without a server crash.
- If `views/layouts/main.hbs` exists with basic HTML, you see rendered content (even if it's a blank shell).
- No `ENOENT` or "template not found" errors in the terminal.

---

## 7. Middleware Stack

### Morgan Logging

Hit `http://localhost:3000` and check the terminal. You should see a log line like:

```
::1 - - [14/Apr/2026:...] "GET / HTTP/1.1" 200 ...
```

### Rate Limiter

```bash
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000; done
```

First 20 requests: `200` (or `304`).
Requests 21–25: `429`.

### CORS (same-origin only)

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://evil.com" http://localhost:3000
```

Expected: `500` or no `Access-Control-Allow-Origin` header in:

```bash
curl -s -I -H "Origin: http://evil.com" http://localhost:3000 | grep -i access-control
```

Should return nothing (no CORS header granted to foreign origin).

---

## 8. Method Override

Create a temporary test route or verify concept:

```bash
curl -X POST "http://localhost:3000/test?_method=DELETE" -s -o /dev/null -w "%{http_code}"
```

If you wire a test `app.delete('/test', ...)` handler, it should receive the request. Remove after verifying.

---

## 9. Flash Messages

Verify session + flash are wired by checking no errors appear in the console when hitting any UI route. Detailed flash testing happens in Sprint 2 with actual forms.

---

## 10. Toolchain

### ESLint

```bash
npm run lint
```

Should run without config errors. File-level lint warnings are fine at this stage.

### Prettier

```bash
npm run format
```

Should format files without crashing. Verify a file was touched:

```bash
git diff --stat
```

### Jest (if keeping tests)

```bash
npm test
```

Should exit cleanly. Output like `No tests found` or `Test Suites: 0` is expected — no tests exist yet.

---

## 11. Project Structure

```bash
ls config/ middleware/ models/ routes/api/ routes/ui/ views/layouts/ views/partials/ helpers/ public/css/ public/js/ scripts/
```

All directories must exist. Missing directories will cause `require()` failures in `server.js`.

---

## 12. Git

```bash
git status
```

- `node_modules/` is NOT tracked.
- `.env` is NOT tracked.
- All project files are staged or committed.

```bash
git log --oneline
```

At least one initial commit exists.

---

## Summary

| #   | Check                        | Status |
| --- | ---------------------------- | ------ |
| 1   | Dependencies installed       | ☐      |
| 2   | Env vars set                 | ☐      |
| 3   | MongoDB connects             | ☐      |
| 4   | Admin seeded                 | ☐      |
| 5   | Server starts                | ☐      |
| 6   | Handlebars renders           | ☐      |
| 7   | Morgan / Rate Limiter / CORS | ☐      |
| 8   | Method override works        | ☐      |
| 9   | Flash messages wired         | ☐      |
| 10  | Lint / Format / Test run     | ☐      |
| 11  | All directories exist        | ☐      |
| 12  | Git clean, env excluded      | ☐      |

All 12 checks must pass for every team member before starting Sprint 1.
