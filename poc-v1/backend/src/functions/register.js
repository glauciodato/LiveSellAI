const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { getPool } = require('../lib/db');
const { corsHeaders, jsonResponse } = require('../lib/azureBlob');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

/**
 * Cadastro de um novo usuário/tenant.
 *
 * POST /api/register
 * { "name": "Fulano", "email": "fulano@empresa.com", "password": "..." }
 *
 * Resposta (201):
 * { "id": 1, "name": "Fulano", "email": "fulano@empresa.com" }
 */
app.http('register', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'register',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: 'Corpo da requisição inválido (JSON esperado).' });
    }

    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!name) {
      return jsonResponse(400, { error: 'Informe seu nome.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse(400, { error: 'E-mail inválido.' });
    }
    if (password.length < 6) {
      return jsonResponse(400, { error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
      const pool = await getPool();
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, passwordHash]
      );

      return jsonResponse(201, result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        // unique_violation (email já cadastrado)
        return jsonResponse(409, { error: 'Já existe uma conta com esse e-mail.' });
      }
      context.error('Erro ao cadastrar usuário', err);
      return jsonResponse(500, { error: 'Erro ao cadastrar usuário.' });
    }
  },
});
