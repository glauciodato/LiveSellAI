variable "aws_region" {
  description = "Região AWS onde o ambiente de dev é provisionado. Use a mesma região em que a cota de GPU foi aprovada."
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

variable "vpc_cidr" {
  description = "CIDR block da VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block da subnet pública (onde fica a instância GPU)."
  type        = string
  default     = "10.20.1.0/24"
}

variable "availability_zone" {
  description = "Availability zone da subnet pública."
  type        = string
  default     = "us-east-1a"
}

variable "allowed_ssh_cidr" {
  description = "CIDR com permissão de acesso SSH à instância (ex: \"SEU_IP_PUBLICO/32\"). NUNCA use \"0.0.0.0/0\" aqui."
  type        = string

  validation {
    condition     = var.allowed_ssh_cidr != "0.0.0.0/0"
    error_message = "Não libere SSH pra internet inteira (0.0.0.0/0). Use seu IP público específico, terminando em /32."
  }
}

variable "instance_type" {
  description = "Tipo da instância EC2 com GPU. g4dn.xlarge = 1x NVIDIA T4 (16GB VRAM) — já validado no pipeline MuseTalk + F5-TTS nessa sessão."
  type        = string
  default     = "g4dn.xlarge"
}

variable "root_volume_size_gb" {
  description = "Tamanho do disco raiz em GB — os modelos de IA (MuseTalk, F5-TTS, Whisper) ocupam bastante espaço."
  type        = number
  default     = 150
}

variable "budget_alert_email" {
  description = "E-mail que recebe o alerta se o gasto mensal da AWS passar de 80%/100% do limite definido. Gasto anômalo é um sinal indireto comum de comprometimento da conta."
  type        = string
}

variable "monthly_budget_limit_usd" {
  description = "Limite mensal de gasto (USD) pra disparar o alerta de orçamento."
  type        = number
  default     = 50
}

variable "sustained_usage_hours" {
  description = "Quantas horas seguidas de uso acima do limiar disparam o alerta de CPU/GPU sustentado."
  type        = number
  default     = 3
}

variable "cpu_alarm_threshold_percent" {
  description = "Limiar de CPU (%) média por hora considerado suspeito se sustentado (jobs legítimos são rajadas curtas de segundos, não horas)."
  type        = number
  default     = 15
}

variable "gpu_alarm_threshold_percent" {
  description = "Limiar de GPU (%) média por hora considerado suspeito se sustentado."
  type        = number
  default     = 15
}
