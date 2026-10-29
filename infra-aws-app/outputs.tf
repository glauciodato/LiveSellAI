output "bucket_name" {
  description = "Nome do bucket S3 (usar no backend pra gerar presigned URLs)."
  value       = aws_s3_bucket.media.id
}

output "bucket_arn" {
  description = "ARN do bucket S3."
  value       = aws_s3_bucket.media.arn
}

output "bucket_region" {
  description = "Região do bucket."
  value       = var.aws_region
}
