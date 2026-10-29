terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Projeto separado do infra-aws-dev de propósito: infra-aws-dev é a
  # sandbox descartável da GPU (criada/destruída com frequência);
  # infra-aws-app é a infraestrutura "de verdade" do produto (S3, RDS,
  # ECS, CloudFront), que deve persistir independente da GPU.
  cloud {
    organization = "Sellai-Live"

    workspaces {
      name = "livesellai-infra-aws-app"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
