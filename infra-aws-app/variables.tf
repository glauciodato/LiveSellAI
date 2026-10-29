variable "aws_region" {
  description = "Região AWS onde a infraestrutura da aplicação é provisionada. Mesma região da GPU (infra-aws-dev) por padrão."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Nome do ambiente, usado em tags e nomes de recursos."
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Prefixo usado no nome dos recursos."
  type        = string
  default     = "livesellai"
}

variable "cors_allowed_origins" {
  description = "Origens permitidas pro CORS do bucket S3 (upload direto do navegador). \"*\" por enquanto, igual ao CORS_ALLOWED_ORIGIN do backend atual no Azure -- restringir depois que o frontend estiver migrado pro domínio final."
  type        = list(string)
  default     = ["*"]
}
