const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { getPool } = require('../lib/db');
const { corsHeaders, jsonResponse } = require('../lib/azureBlob');

const SALT_ROUNDS = 10;

/**
 * Troca a senha de um usuário já cadastrado. Exige a senha atual pra evitar
 * que qualquer um troque a senha de uma conta só sabendo o e-mail.
 *
 * POST /api/change-password
 * { "email": "fulano@empresa.com", "currentPassword": "...", "newPassword": "..." }
 *
 * Resposta (200): { "id": 1, "name": "Fulano", "email": "fulano@empresa.com" }
 * Resposta (401): { "error": "Senha atual incorreta." }
 */
app.http('changePassword', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'change-password',
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
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');

    if (!email || !currentPassword) {
      return jsonResponse(400, { error: 'Informe e-mail e senha atual.' });
    }
    if (newPassword.length < 6) {
      return jsonResponse(400, { error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    try {
      const pool = await getPool();
      const result = await pool.query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [email]
      );

      const user = result.rows[0];
      const DUMMY_HASH = '$2a$10$rqOelKr9Rvac0UKnjbnYxeuj7eJ.qgN0sUXDdnSzQD1HRjz0Hfsom';
      const currentPasswordMatches = await bcrypt.compare(
        currentPassword,
        user ? user.password_hash : DUMMY_HASH
      );

      if (!user || !currentPasswordMatches) {
        return jsonResponse(401, { error: 'Senha atual incorreta.' });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        newPasswordHash,
        user.id,
      ]);

      return jsonResponse(200, { id: user.id, name: user.name, email: user.email });
    } catch (err) {
      context.error('Erro ao trocar senha', err);
      return jsonResponse(500, { error: 'Erro ao trocar senha.' });
    }
  },
});
