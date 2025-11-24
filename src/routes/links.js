const express = require('express');
const router = express.Router();
const db = require('../db');
const { isValidCode, isValidUrl, isValidEmail } = require('../validators');

// GET /api/links?email=someone@example.com
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;

    let result;
    if (email) {
      result = await db.query(
        'SELECT id, code, target_url AS url, email, total_clicks, last_clicked, created_at FROM links WHERE email = $1 ORDER BY created_at DESC',
        [email]
      );
    } else {
      // fallback: all links (probably not used in UI now)
      result = await db.query(
        'SELECT id, code, target_url AS url, email, total_clicks, last_clicked, created_at FROM links ORDER BY created_at DESC'
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/links error', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// POST /api/links  { url, code?, email }
router.post('/', async (req, res) => {
  const { url, code, email } = req.body;

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  let finalCode = code;

  if (finalCode) {
    if (!isValidCode(finalCode)) {
      return res
        .status(400)
        .json({ error: 'Custom code must be 6–8 alphanumeric characters' });
    }
  } else {
    // auto-generate code (simple example)
    finalCode = Math.random().toString(36).slice(2, 10);
  }

  try {
    const insert = await db.query(
      `INSERT INTO links (code, target_url, email)
       VALUES ($1, $2, $3)
       RETURNING id, code, target_url AS url, email, total_clicks, last_clicked, created_at`,
      [finalCode, url, email]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error('POST /api/links error', err);

    // 23505 = unique_violation in Postgres — means code already exists
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Custom code already in use' });
    }

    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/links/:code -> link details
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const r = await db.query(
      'SELECT id, code, target_url AS url, email, total_clicks, last_clicked, created_at FROM links WHERE code=$1',
      [code]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('GET /api/links/:code error', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// DELETE /api/links/:code
router.delete('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const r = await db.query('DELETE FROM links WHERE code=$1', [code]);
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/links/:code error', err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
