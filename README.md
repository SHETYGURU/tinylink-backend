
# TinyLink Backend

TinyLink is a minimal URL-shortening API built with **Node.js**, **Express**, and **PostgreSQL**.

The backend:

- Creates short links with **auto-generated** or **custom** codes
- Stores links per **email** (so each user only sees their own links)
- Tracks **total clicks** and **last clicked timestamp**
- Redirects `/:code` to the original URL
- Enforces **globally unique custom codes**
- Exposes a simple JSON API for the React frontend



## 🏗 Tech Stack

- **Node.js** + **Express**
- **PostgreSQL** (with `pg` + `Pool`)
- **helmet** (security headers)
- **express-rate-limit**
- **cors**
- Deployed on: **Railway**



## 📁 Project Structure (backend)

```text
backend/
├── migrations/
│   └── schema.sql
├── src/ or ./
│   ├── index.js        # Express app entry point
│   ├── db.js           # PostgreSQL connection (Pool)
│   ├── routes/
│   │   └── links.js    # /api/links routes (CRUD)
│   └── validators.js   # URL + code validation
├── .env
├── .env.example
├── package.json
└── package-lock.json
````

> Your exact folder names can vary slightly (e.g. `src/index.js` vs `index.js`), but the logic is the same.

---

## 🗄 Database Schema

Migration file: `migrations/schema.sql` (or similar).

```sql
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  email TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  last_clicked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Optional check constraint for code pattern
ALTER TABLE links
  ADD CONSTRAINT IF NOT EXISTS code_format CHECK (code ~ '^[A-Za-z0-9]{6,8}$');

CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);
CREATE INDEX IF NOT EXISTS idx_links_email ON links(email);
```

* **`code`** – short code used in URLs; must be unique and match `^[A-Za-z0-9]{6,8}$`.
* **`email`** – owner of the link (used to filter which links a user sees).
* **`total_clicks`** / **`last_clicked`** – updated when short URL is visited.
* **`created_at`** – timestamp when the record was created.

---

## 🔧 Local Setup

### 1. Install dependencies

From the `backend` folder:

```bash
npm install
```

### 2. Configure `.env`

Create `.env` in **backend**:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:root@localhost:5432/tinylink
BASE_URL=http://localhost:4000
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Adjust user/password/port as needed for your local PostgreSQL.

### 3. Create database + run migrations

In `psql` or another tool:

```sql
CREATE DATABASE tinylink;
```

Then from the `backend` folder:

```bash
psql "postgresql://postgres:root@localhost:5432/tinylink" -f migrations/schema.sql
```

(Change `postgres:root` and port if needed.)

### 4. Start the backend

```bash
npm run dev
# or
node index.js
```

The API will listen on `http://localhost:4000` (or `PORT` from `.env`).

---

## 🧠 Core Files

### `db.js`

Handles PostgreSQL connection. Example (Railway-compatible):

```js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
```

### `validators.js`

```js
function isValidCode(code) {
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

function isValidUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { isValidCode, isValidUrl, isValidEmail };
```

### `index.js`

Main Express app:

```js
const express = require('express');
const app = express();
require('dotenv').config();
const links = require('./routes/links');
const db = require('./db');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

app.use(helmet());
app.use(express.json());

// CORS
const allowedOrigin =
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: allowedOrigin,
  })
);

// Basic rate limit
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

// Health check
app.get('/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, version: '1.0' });
  } catch (err) {
    console.error('Healthz error', err);
    res.status(500).json({ ok: false });
  }
});

// API routes
app.use('/api/links', links);

// Redirect route: GET /:code
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  const r = await db.query('SELECT target_url FROM links WHERE code=$1', [code]);
  if (r.rowCount === 0) return res.status(404).send('Not found');

  const target = r.rows[0].target_url;

  // update counters
  await db.query(
    'UPDATE links SET total_clicks = total_clicks + 1, last_clicked = now() WHERE code=$1',
    [code]
  );

  res.redirect(302, target);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`TinyLink API listening on ${port}`));
```

---

## 🌐 API Endpoints

### `GET /healthz`

Health check.

**Response:**

```json
{ "ok": true, "version": "1.0" }
```

---

### `POST /api/links`

Create a new short link.

**Request body:**

```json
{
  "url": "https://example.com/very/long/path",
  "code": "abc123",        // optional custom code
  "email": "user@example.com"
}
```

Rules:

* `url` must be a valid `http` or `https` URL.
* `email` is **required** and must be a valid email.
* `code`:

  * optional,
  * if provided must match `^[A-Za-z0-9]{6,8}$`,
  * must be **globally unique** (across all users).
* If `code` already exists → return an error.

**Possible responses:**

* `201 Created`

  ```json
  {
    "code": "9IAadC",
    "url": "https://example.com/very/long/path",
    "email": "user@example.com",
    "total_clicks": 0,
    "last_clicked": null,
    "created_at": "2025-11-21T15:53:06.969Z"
  }
  ```

* `400 Bad Request` (validation error, invalid URL, invalid code, missing email, etc.)

* `409 Conflict` (custom code already exists, depending on implementation)

* `500` on server error.

---

### `GET /api/links`

List links, filtered by email.

**Query params:**

* `email` (required by your frontend design)

Example:

```http
GET /api/links?email=user@example.com
```

**Response:**

```json
[
  {
    "code": "9IAadC",
    "url": "https://example.com",
    "email": "user@example.com",
    "total_clicks": 3,
    "last_clicked": "2025-11-22T10:11:12.345Z",
    "created_at": "2025-11-21T15:53:06.969Z"
  },
  ...
]
```

---

### `DELETE /api/links/:code`

Delete a link by its short code.

Example:

```http
DELETE /api/links/9IAadC
```

**Response:**

* `204 No Content` (deleted)
* `404 Not Found` (no such code)
* `500` on server error.

---

### `GET /:code` (Redirect)

Short URL entrypoint.

Example:

```text
GET /9IAadC
```

If the code exists:

* Increment `total_clicks`
* Set `last_clicked = now()`
* `302` redirect to `target_url`.

If not:

* `404 Not Found`

---

## 🚀 Deploying on Railway

1. Create a **Railway project**.

2. Add:

   * A **Node service** for the backend (this repo’s `backend`).
   * A **Postgres plugin** (or use an existing database).

3. Set **service variables** (on the backend service):

```env
DATABASE_URL=<your Railway postgres url>
BASE_URL=https://tinylink-backend-production.up.railway.app
FRONTEND_ORIGIN=https://tinylinksite.netlify.app
NODE_ENV=production
PORT=3000   # or leave to Railway default; just ensure you use process.env.PORT
```

4. Make sure `db.js` uses:

```js
ssl: { rejectUnauthorized: false }
```

for production (Railway Postgres typically requires SSL).

5. Deploy.
   After deployment, test:

```text
https://tinylink-backend-production.up.railway.app/healthz
```

You should get:

```json
{ "ok": true, "version": "1.0" }
```

---

## 🐞 Troubleshooting

* **“Application failed to respond” on Railway**

  * Check Railway **logs**.
  * Common issues:

    * `DATABASE_URL is not set` → missing env var.
    * SSL errors → set `ssl: { rejectUnauthorized: false }` in `db.js`.
    * Migration mismatch (e.g. column `email` doesn’t exist) → re-run migrations on the Railway DB.

* **CORS errors (`No 'Access-Control-Allow-Origin' header`)**

  * Ensure `FRONTEND_ORIGIN` matches your frontend origin exactly:

    * `https://tinylinksite.netlify.app` ✅
    * **No** trailing slash, **no** quotes.

---

## 🧪 Quick Manual Tests with curl

Assuming backend at `http://localhost:4000`:

```bash
# health
curl http://localhost:4000/healthz

# create a link
curl -X POST http://localhost:4000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","email":"user@example.com"}'

# list links for email
curl "http://localhost:4000/api/links?email=user@example.com"

# delete a link
curl -X DELETE http://localhost:4000/api/links/9IAadC
```

---

