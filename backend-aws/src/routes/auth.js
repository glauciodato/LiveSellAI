const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { getPool } = require('../lib/db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;
// Hash "de mentira" fixo, usado só quando o e-mail não existe, pra que o
// tempo de resposta não revele se o e-mail está cadastrado ou não.
const DUMMY_HASH = '$2a$10$rqOelKr9Rvac0UKnjbnYxeuj7eJ.qgN0sUXDdnSzQD1HRjz0Hfsom';

const googleClient = new OAuth2Client();

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
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, avatar_url',
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      hasPassword: true,
    });
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
      'SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    // ?? em vez de só checar `user` -- contas criadas via Google não têm
    // password_hash (é NULL), e bcrypt.compare quebra se receber null.
    const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      hasPassword: user.password_hash !== null,
    });
  } catch (err) {
    console.error('Erro ao fazer login', err);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

/**
 * POST /api/change-password
 * { "email": "...", "currentPassword": "...", "newPassword": "..." }
 *
 * Contas criadas via Google não têm senha ainda (password_hash NULL) --
 * nesse caso não existe "senha atual" pra conferir, então o campo é
 * ignorado e a nova senha é definida direto (primeira senha da conta).
 * Contas que já têm senha continuam exigindo a senha atual, como sempre.
 */
router.post('/change-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      // Mantém o tempo de resposta parecido com o caso de senha errada,
      // pra não dar pista de que o e-mail não existe.
      await bcrypt.compare(currentPassword || 'x', DUMMY_HASH);
      return res.status(401).json({ error: 'Não foi possível trocar a senha.' });
    }

    if (user.password_hash !== null) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Informe sua senha atual.' });
      }
      const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password_hash);
      if (!currentPasswordMatches) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newPasswordHash,
      user.id,
    ]);

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      hasPassword: true,
    });
  } catch (err) {
    console.error('Erro ao trocar senha', err);
    res.status(500).json({ error: 'Erro ao trocar senha.' });
  }
});

/**
 * POST /api/auth/google
 * { "idToken": "<JWT emitido pelo Google Identity Services no navegador>" }
 *
 * Cria a conta na primeira vez (sem senha -- password_hash fica NULL) ou
 * autentica direto se já existir um cadastro com esse e-mail verificado.
 */
router.post('/auth/google', async (req, res) => {
  const idToken = String(req.body?.idToken ?? '');

  if (!idToken) {
    return res.status(400).json({ error: 'Token do Google ausente.' });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error('GOOGLE_CLIENT_ID não configurado no backend');
    return res.status(500).json({ error: 'Login com Google não está configurado.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Token do Google inválido ou expirado.' });
  }

  if (!payload?.email_verified) {
    return res.status(401).json({ error: 'O e-mail da conta do Google não está verificado.' });
  }

  const email = payload.email.toLowerCase();
  const name = payload.name || email;
  const avatarUrl = payload.picture || null;

  try {
    const pool = getPool();
    const existing = await pool.query(
      'SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows[0]) {
      let user = existing.rows[0];
      // Mantém a foto do Google atualizada a cada login, caso o usuário troque.
      if (avatarUrl && avatarUrl !== user.avatar_url) {
        const updated = await pool.query(
          'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, name, email, password_hash, avatar_url',
          [avatarUrl, user.id]
        );
        user = updated.rows[0];
      }
      return res.status(200).json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        hasPassword: user.password_hash !== null,
      });
    }

    const created = await pool.query(
      'INSERT INTO users (name, email, password_hash, avatar_url) VALUES ($1, $2, NULL, $3) RETURNING id, name, email, avatar_url',
      [name, email, avatarUrl]
    );

    const user = created.rows[0];
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      hasPassword: false,
    });
  } catch (err) {
    if (err.code === '23505') {
      // corrida rara: criada entre o SELECT e o INSERT -- tenta de novo como login.
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = $1',
        [email]
      );
      if (result.rows[0]) {
        const user = result.rows[0];
        return res.status(200).json({
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url,
          hasPassword: user.password_hash !== null,
        });
      }
    }
    console.error('Erro ao autenticar com Google', err);
    res.status(500).json({ error: 'Erro ao autenticar com Google.' });
  }
});

module.exports = router;
