const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../lib/db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;
// Hash "de mentira" fixo, usado só quando o e-mail não existe, pra que o
// tempo de resposta não revele se o e-mail está cadastrado ou não.
const DUMMY_HASH = '$2a$10$rqOelKr9Rvac0UKnjbnYxeuj7eJ.qgN0sUXDdnSzQD1HRjz0Hfsom';

/**
 * POST /api/register
 * { "name": "Fulano", "email": "fulano@empresa.com", "password": "..." }
 */
router.post('/register', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!name) {
    return res.status(400).json({ error: 'Informe seu nome.' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const pool = getPool();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
    }
    console.error('Erro ao cadastrar usuário', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

/**
 * POST /api/login
 * { "email": "fulano@empresa.com", "password": "..." }
 */
router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    res.status(200).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('Erro ao fazer login', err);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

/**
 * POST /api/change-password
 * { "email": "...", "currentPassword": "...", "newPassword": "..." }
 */
router.post('/change-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (!email || !currentPassword) {
    return res.status(400).json({ error: 'Informe e-mail e senha atual.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      user ? user.password_hash : DUMMY_HASH
    );

    if (!user || !currentPasswordMatches) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newPasswordHash,
      user.id,
    ]);

    res.status(200).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('Erro ao trocar senha', err);
    res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
});

module.exports = router;
