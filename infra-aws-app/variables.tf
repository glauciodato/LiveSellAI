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

variable "github_repo" {
  description = <<-EOT
    Identificador do repositório GitHub autorizado a assumir o papel de deploy
    via OIDC, no formato exato que o GitHub usa no claim "sub" do token --
    "owner@ownerId/repo@repoId" (inclui IDs numéricos imutáveis, não só os
    nomes, pra resistir a sequestro de confiança em caso de rename/transferência
    de repo). Descoberto via um passo de debug no workflow que imprimia o
    claim "sub" real -- o formato simples "owner/repo" NÃO bate mais.
  EOT
  type        = string
  default     = "glauciodato@12037247/LiveSellAI@1366580158"
}

variable "google_client_id" {
  description = "Client ID do OAuth do Google (tipo Web, Google Cloud Console) -- usado pelo backend pra validar o ID token e pelo frontend pra iniciar o login. Não é segredo, mas vazio quebra o login com Google (backend responde 500)."
  type        = string
  default     = ""
}

variable "backend_image_tag" {
  description = "Tag da imagem no ECR usada na task definition do backend. Atualizada a cada deploy pelo GitHub Actions."
  type        = string
  default     = "latest"
}
