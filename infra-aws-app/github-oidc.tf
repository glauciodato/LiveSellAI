# Permite o GitHub Actions publicar a imagem do backend no ECR e atualizar
# o serviço ECS sem guardar nenhuma credencial de longa duração no repo --
# login federado via OIDC, mesmo princípio já usado pro deploy do backend
# Azure (AZURE_CLIENT_ID + federated credential).
resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # A AWS valida a cadeia de certificados por conta própria pro provedor da
  # GitHub -- esse thumbprint é só um valor de compatibilidade exigido pela
  # API, não é mais usado de fato na validação.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name = "${var.project_name}-github-oidc-${var.environment}"
  }
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Restringe a QUALQUER branch/tag/ambiente desse repositório específico
    # -- nenhum outro repo (nem fork) consegue assumir esse papel.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions_backend_deploy" {
  name               = "${var.project_name}-gha-backend-deploy-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json

  tags = {
    Name = "${var.project_name}-gha-backend-deploy-${var.environment}"
  }
}

resource "aws_iam_role_policy" "github_actions_backend_deploy" {
  name = "${var.project_name}-gha-backend-deploy-${var.environment}"
  role = aws_iam_role.github_actions_backend_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "EcrPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = aws_ecr_repository.backend.arn
      },
      {
        Sid    = "EcsForceNewDeployment"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
        ]
        Resource = aws_ecs_service.backend.id
      }
    ]
  })
}
