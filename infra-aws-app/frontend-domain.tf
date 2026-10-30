# Domínio customizado pro frontend (app-dev.sellai.live), DNS gerenciado
# no Hostinger -- sem integração automática com o Terraform, então o
# processo é em duas etapas:
#   1) Esse arquivo cria só o certificado ACM e expõe o registro de
#      validação (output). O usuário adiciona esse registro no DNS do
#      Hostinger manualmente.
#   2) Depois que o registro propagar, descomentamos o resource
#      "aws_acm_certificate_validation" e as mudanças na distribuição
#      CloudFront (aliases + certificado customizado).
#
# O certificado precisa estar em us-east-1 (exigência do CloudFront,
# independente da região dos outros recursos) -- como o provider já usa
# us-east-1 por padrão, não precisou de um provider alias separado.

variable "frontend_domain_name" {
  description = "Domínio customizado do frontend (DNS gerenciado no Hostinger)."
  type        = string
  default     = "app-dev.sellai.live"
}

resource "aws_acm_certificate" "frontend" {
  domain_name       = var.frontend_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-frontend-cert-${var.environment}"
  }
}

# Confirma formalmente a validação (o registro DNS já foi criado no
# Hostinger e já propagou -- a AWS já emitiu o certificado).
resource "aws_acm_certificate_validation" "frontend" {
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [tolist(aws_acm_certificate.frontend.domain_validation_options)[0].resource_record_name]
}
