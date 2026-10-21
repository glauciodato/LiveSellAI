output "instance_id" {
  description = "ID da instância EC2 provisionada."
  value       = aws_instance.avatar_gpu_dev.id
}

output "instance_public_ip" {
  description = "IP público da instância (muda se a instância for recriada/reiniciada, já que não usamos Elastic IP nesta fase de dev)."
  value       = aws_instance.avatar_gpu_dev.public_ip
}

output "ssh_command" {
  description = "Comando pronto pra conectar via SSH."
  value       = "ssh -i ${var.key_pair_name}.pem ubuntu@${aws_instance.avatar_gpu_dev.public_ip}"
}

output "ami_used" {
  description = "AMI efetivamente usada (útil pra conferir qual versão da Deep Learning AMI foi resolvida)."
  value       = data.aws_ami.deep_learning_gpu.id
}
