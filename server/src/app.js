const express = require('express');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// `db` is injected (mysql2 pool in prod, a fake in unit tests)
function createApp(db) {
  const app = express();
  app.use(express.json());

  // Health: 200 only if the DB answers
  app.get('/api/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'down' });
    }
  });

  app.get('/api/events', async (req, res, next) => {
    try {
      const [rows] = await db.query(
        `SELECT e.id, e.title, e.location, e.event_date, e.capacity,
                (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered
         FROM events e ORDER BY e.event_date`
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  app.post('/api/events/:id/register', async (req, res, next) => {
    const id = Number(req.params.id);
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();

    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid event id' });
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email' });

    try {
      const [rows] = await db.query(
        `SELECT e.capacity,
                (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered
         FROM events e WHERE e.id = ?`, [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
      if (rows[0].registered >= rows[0].capacity) return res.status(409).json({ error: 'Event is full' });

      await db.query('INSERT INTO registrations (event_id, name, email) VALUES (?, ?, ?)', [id, name, email]);
      res.status(201).json({ message: 'Registered' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered' });
      next(err);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

module.exports = { createApp };