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
app.use(
  cors({
    origin: "https://tinylink.vercel.app",
    credentials: true,
  })
);
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

app.get('/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, version: '1.0' });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/links', links);

// Redirect route
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  const r = await db.query('SELECT target_url FROM links WHERE code=$1', [code]);
  if (r.rowCount === 0) return res.status(404).send('Not found');
  const target = r.rows[0].target_url;
  // update counters
  await db.query('UPDATE links SET total_clicks = total_clicks + 1, last_clicked = now() WHERE code=$1', [code]);
  res.redirect(302, target);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`TinyLink API listening on ${port}`));
