const { Pool } = require('pg');

/**
 * Pool de conexões com o RDS Postgres. Bem mais simples que o equivalente
 * no backend do Azure (poc-v1/backend/src/lib/db.js) -- lá precisávamos
 * resolver a senha do Key Vault manualmente, porque a resolução automática
 * de "@Microsoft.KeyVault(...)" só existe rodando dentro do Azure Functions
 * de verdade. Aqui no ECS, o próprio Fargate já resolve o segredo do AWS
 * Secrets Manager e injeta como variável de ambiente comum ANTES do
 * container iniciar -- então process.env.PGPASSWORD já chega pronto.
 */
let pool;

function getPool() {
  if (pool) {
    return pool;
  }

  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      'Configuração ausente: defina PGHOST, PGDATABASE, PGUSER e PGPASSWORD (.env local, ou variáveis/secrets da task definition do ECS).'
    );
  }

  pool = new Pool({
    host,
    port: Number(process.env.PGPORT || 5432),
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

module.exports = { getPool };
