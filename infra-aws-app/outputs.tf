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

output "backend_app_access_key_id" {
  description = "Access Key ID do usuário de runtime do backend (uso local/dev)."
  value       = aws_iam_access_key.backend_app.id
}

output "backend_app_secret_access_key" {
  description = "Secret Access Key do usuário de runtime do backend. Pegar com: terraform output -raw backend_app_secret_access_key"
  value       = aws_iam_access_key.backend_app.secret
  sensitive   = true
}

output "ecr_repository_url" {
  description = "URL do repositório ECR do backend (usado pelo GitHub Actions pra publicar a imagem)."
  value       = aws_ecr_repository.backend.repository_url
}

output "github_actions_role_arn" {
  description = "ARN do papel IAM que o GitHub Actions assume via OIDC pra publicar no ECR e atualizar o ECS. Configurar como secret AWS_BACKEND_DEPLOY_ROLE_ARN no repositório."
  value       = aws_iam_role.github_actions_backend_deploy.arn
}

output "ecs_cluster_name" {
  description = "Nome do cluster ECS."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Nome do serviço ECS do backend."
  value       = aws_ecs_service.backend.name
}

output "backend_alb_url" {
  description = "URL pública do backend (Application Load Balancer)."
  value       = "http://${aws_lb.backend.dns_name}"
}

output "frontend_bucket_name" {
  description = "Nome do bucket S3 do frontend (destino do `aws s3 sync` no deploy)."
  value       = aws_s3_bucket.frontend.id
}

output "frontend_cloudfront_distribution_id" {
  description = "ID da distribuição CloudFront (usado pra invalidar o cache no deploy)."
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_url" {
  description = "URL pública do frontend (domínio padrão do CloudFront)."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "github_actions_frontend_role_arn" {
  description = "ARN do papel IAM que o GitHub Actions assume via OIDC pra publicar o frontend. Configurar como secret AWS_FRONTEND_DEPLOY_ROLE_ARN no repositório."
  value       = aws_iam_role.github_actions_frontend_deploy.arn
}

output "backend_api_url" {
  description = "URL HTTPS do backend via CloudFront (usar como EXPO_PUBLIC_BACKEND_URL no deploy AWS do app, com /api no final)."
  value       = "https://${aws_cloudfront_distribution.backend_api.domain_name}"
}
