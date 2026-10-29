const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { getPool } = require('../lib/db');
const { corsHeaders, jsonResponse } = require('../lib/azureBlob');

/**
 * Login de um usuário/tenant já cadastrado.
 *
 * POST /api/login
 * { "email": "fulano@empresa.com", "password": "..." }
 *
 * Resposta (200):
 * { "id": 1, "name": "Fulano", "email": "fulano@empresa.com" }
 *
 * Resposta (401): { "error": "E-mail ou senha inválidos." }
 * (mensagem genérica de propósito, pra não revelar se o e-mail existe ou não)
 */
app.http('login', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'login',
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

    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');

    if (!email || !password) {
      return jsonResponse(400, { error: 'Informe e-mail e senha.' });
    }

    try {
      const pool = await getPool();
      const result = await pool.query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [email]
      );

      const user = result.rows[0];
      // Hash "de mentira" fixo, usado só quando o e-mail não existe, pra que o
      // tempo de resposta não revele se o e-mail está cadastrado ou não.
      const DUMMY_HASH = '$2a$10$rqOelKr9Rvac0UKnjbnYxeuj7eJ.qgN0sUXDdnSzQD1HRjz0Hfsom';
      const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

      if (!user || !passwordMatches) {
        return jsonResponse(401, { error: 'E-mail ou senha inválidos.' });
      }

      return jsonResponse(200, { id: user.id, name: user.name, email: user.email });
    } catch (err) {
      context.error('Erro ao fazer login', err);
      return jsonResponse(500, { error: 'Erro ao fazer login.' });
    }
  },
});
