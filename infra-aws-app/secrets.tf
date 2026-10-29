# Senha do RDS injetada no container via Secrets Manager -- nunca em texto
# puro na task definition. O Task Execution Role lê esse segredo e injeta
# como variável de ambiente (PGPASSWORD) na hora de subir o container.
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project_name}-db-password-${var.environment}"
  # POC/dev -- sem janela de retenção, pra poder recriar o segredo na hora
  # (sem isso, deletar e recriar com o mesmo nome fica bloqueado por até 30 dias).
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-db-password-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}
