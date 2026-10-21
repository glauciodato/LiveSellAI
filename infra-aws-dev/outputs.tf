output "instance_id" {
  description = "ID da instância EC2 provisionada."
  value       = aws_instance.avatar_gpu_dev.id
}

output "instance_public_ip" {
  description = "IP público da instância (muda se a instância for recriada/reiniciada, já que não usamos Elastic IP nesta fase de dev)."
  value       = aws_instance.avatar_gpu_dev.public_ip
}

output "ssh_command" {
  description = "Comando pronto pra conectar via SSH (depois de salvar a chave privada — ver output private_key_pem)."
  value       = "ssh -i livesellai-dev.pem ubuntu@${aws_instance.avatar_gpu_dev.public_ip}"
}

output "private_key_pem" {
  description = "Chave privada SSH gerada pelo Terraform. Salve com: terraform output -raw private_key_pem > livesellai-dev.pem && chmod 400 livesellai-dev.pem"
  value       = tls_private_key.ssh.private_key_pem
  sensitive   = true
}

output "ami_used" {
  description = "AMI efetivamente usada (útil pra conferir qual versão da Deep Learning AMI foi resolvida)."
  value       = data.aws_ami.deep_learning_gpu.id
}
