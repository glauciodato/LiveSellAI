# Usuário IAM dedicado só pro backend acessar o S3 em runtime (ler/escrever
# objetos) -- NÃO tem nenhuma permissão de gerenciar infraestrutura (criar
# bucket, RDS, etc.), diferente do usuário usado pelo Terraform Cloud.
# Serve pra rodar o backend localmente agora; quando o ECS existir (mesma
# fase), a Task Role assume esse papel em produção e esse usuário vira só
# conveniência de desenvolvimento local.
resource "aws_iam_user" "backend_app" {
  name = "${var.project_name}-backend-app-${var.environment}"

  tags = {
    Name = "${var.project_name}-backend-app-${var.environment}"
  }
}

resource "aws_iam_user_policy" "backend_app_s3" {
  name = "${var.project_name}-backend-app-s3-${var.environment}"
  user = aws_iam_user.backend_app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BackendS3ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Sid      = "BackendS3ListBucket"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.media.arn
      }
    ]
  })
}

resource "aws_iam_access_key" "backend_app" {
  user = aws_iam_user.backend_app.name
}
