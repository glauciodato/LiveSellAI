# Nomes de bucket S3 são únicos globalmente (em toda a AWS, não só na sua
# conta) -- gera um sufixo aleatório pra evitar colisão, mesmo problema que
# já tivemos com o nome da Storage Account no Azure.
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "${var.project_name}-media-${var.environment}"
  }
}

# Igual ao Azure Blob Storage: nada de acesso público direto. Todo acesso
# (leitura ou escrita) passa por URL pré-assinada (presigned URL), gerada
# pelo backend com validade curta -- mesmo padrão que já usamos com SAS
# tokens.
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Sem versionamento -- não precisamos disso numa POC, e evita custo extra
# de guardar versões antigas de vídeos grandes.
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Disabled"
  }
}

# Permite upload direto do navegador (PUT com URL pré-assinada) -- sem
# isso, o navegador bloqueia a requisição por CORS antes mesmo dela sair.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
