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

variable "allowed_db_cidr" {
  description = "CIDR com permissão de acesso ao RDS (ex: \"SEU_IP_PUBLICO/32\"). NUNCA use \"0.0.0.0/0\" aqui."
  type        = string

  validation {
    condition     = var.allowed_db_cidr != "0.0.0.0/0"
    error_message = "Não libere o Postgres pra internet inteira (0.0.0.0/0). Use seu IP público específico, terminando em /32."
  }
}

variable "db_instance_class" {
  description = "Classe da instância RDS. db.t4g.micro é a menor disponível (ARM Graviton, mais barata)."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Armazenamento em GB. 20 é o mínimo permitido pelo RDS."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Nome do banco de dados dentro da instância RDS."
  type        = string
  default     = "livesellai"
}

variable "db_username" {
  description = "Usuário administrador do Postgres."
  type        = string
  default     = "livesellai_admin"
}
