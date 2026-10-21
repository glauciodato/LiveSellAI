terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Estado remoto no Terraform Cloud (HCP Terraform) — nunca commitamos o
  # arquivo de state no Git. Troque "organization" pelo nome da sua
  # organização assim que criar a conta (ver README.md, passo 1).
  cloud {
    organization = "Sellai-Live"

    workspaces {
      name = "livesellai-infra-aws-dev"
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
