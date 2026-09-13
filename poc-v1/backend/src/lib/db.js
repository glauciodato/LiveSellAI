const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

/**
 * Pool de conexões compartilhado com o Azure Database for PostgreSQL
 * Flexible Server. Reaproveitado entre invocações da Function App (o
 * processo Node do Functions fica "quente" entre chamadas).
 */
let pool;
let cachedPassword;

/**
 * Resolve a senha do Postgres sem nunca precisar guardá-la em texto puro
 * em nenhum arquivo:
 *
 * - Rodando de verdade no Azure: o App Setting `PGPASSWORD` já contém a
 *   referência `@Microsoft.KeyVault(SecretUri=...)`, que a própria
 *   plataforma do Function App resolve antes de injetar a variável de
 *   ambiente — nesse caso o valor já chega pronto.
 * - Rodando localmente (`func start`): essa resolução automática não
 *   existe, então buscamos o segredo diretamente no Key Vault usando o
 *   `DefaultAzureCredential` (aproveita o `az login` já feito na máquina).
 */
async function resolvePassword() {
  if (cachedPassword) {
    return cachedPassword;
  }

  const rawPassword = process.env.PGPASSWORD;
  if (rawPassword && !rawPassword.startsWith('@Microsoft.KeyVault')) {
    cachedPassword = rawPassword;
    return cachedPassword;
  }

  const vaultName = process.env.KEY_VAULT_NAME;
  if (!vaultName) {
    throw new Error(
      'Não foi possível obter a senha do Postgres: defina PGPASSWORD (valor direto) ' +
        'ou KEY_VAULT_NAME (pra buscar no Key Vault) em local.settings.json / App Settings.'
    );
  }

  const secretName = process.env.PG_PASSWORD_SECRET_NAME || 'pg-admin-password';
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(`https://${vaultName}.vault.azure.net`, credential);
  const secret = await client.getSecret(secretName);

  cachedPassword = secret.value;
  return cachedPassword;
}

async function getPool() {
  if (pool) {
    return pool;
  }

  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;

  if (!host || !database || !user) {
    throw new Error(
      'Configuração ausente: defina PGHOST, PGDATABASE e PGUSER ' +
        '(local.settings.json ou App Settings do Function App).'
    );
  }

  const password = await resolvePassword();

  pool = new Pool({
    host,
    port: Number(process.env.PGPORT || 5432),
    database,
    user,
    password,
    ssl:
      (process.env.PGSSLMODE || 'require') === 'disable'
        ? false
        : { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

module.exports = { getPool };
