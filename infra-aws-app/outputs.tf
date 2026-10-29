output "bucket_name" {
  description = "Nome do bucket S3 (usar no backend pra gerar presigned URLs)."
  value       = aws_s3_bucket.media.id
}

output "bucket_arn" {
  description = "ARN do bucket S3."
  value       = aws_s3_bucket.media.arn
}

output "bucket_region" {
  description = "Região do bucket."
  value       = var.aws_region
}

output "db_endpoint" {
  description = "Endereço do RDS (host:porta) pra conectar."
  value       = aws_db_instance.main.endpoint
}

output "db_name" {
  description = "Nome do banco de dados."
  value       = aws_db_instance.main.db_name
}

output "db_username" {
  description = "Usuário administrador do Postgres."
  value       = aws_db_instance.main.username
}

output "db_password" {
  description = "Senha gerada automaticamente. Pegar com: terraform output -raw db_password"
  value       = random_password.db.result
  sensitive   = true
}
