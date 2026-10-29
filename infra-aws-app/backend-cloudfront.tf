# CloudFront na frente do ALB do backend -- resolve o bloqueio de "mixed
# content" do navegador (o frontend roda em HTTPS no CloudFront, não pode
# chamar um backend em HTTP puro). Aproveita o certificado HTTPS automático
# do domínio *.cloudfront.net, sem precisar de domínio customizado nem
# certificado próprio (mesmo truque usado pro frontend).
#
# Tráfego CloudFront -> ALB continua em HTTP simples (origem "http-only");
# só o trecho navegador -> CloudFront é HTTPS. Aceitável pra POC.

resource "aws_cloudfront_distribution" "backend_api" {
  enabled     = true
  comment     = "${var.project_name} backend API (HTTPS na frente do ALB)"
  price_class = "PriceClass_100"

  origin {
    domain_name = aws_lb.backend.dns_name
    origin_id   = "alb-backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-backend"
    viewer_protocol_policy = "redirect-to-https"

    # API dinâmica -- sem cache, repassa tudo (headers/cookies/query string) pro ALB.
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # AWS managed: CachingDisabled
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AWS managed: AllViewer
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-backend-api-${var.environment}"
  }
}
