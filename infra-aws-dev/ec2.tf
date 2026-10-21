# AMI oficial da AWS com driver NVIDIA, CUDA, Docker e nvidia-container-toolkit
# já instalados e configurados — evita repetir toda a novela de patches
# manuais que tivemos no Runstack (VRAM, PyTorch, mmcv, etc.).
data "aws_ami" "deep_learning_gpu" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Bootstrap mínimo: só confirma que a GPU está visível e deixa o Docker
# pronto pra puxar a imagem do avatar-service (ghcr.io/glauciodato/livesellai/avatar-service,
# já publicada via GitHub Actions). Rodar o container em si fica manual por
# enquanto (ver README.md).
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -e
    echo "=== LiveSellAI dev GPU instance - bootstrap ===" > /var/log/livesellai-bootstrap.log
    nvidia-smi >> /var/log/livesellai-bootstrap.log 2>&1 || echo "AVISO: nvidia-smi falhou" >> /var/log/livesellai-bootstrap.log
    docker --version >> /var/log/livesellai-bootstrap.log 2>&1
    echo "Bootstrap concluído." >> /var/log/livesellai-bootstrap.log
  EOF
}

resource "aws_instance" "avatar_gpu_dev" {
  ami                         = data.aws_ami.deep_learning_gpu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.gpu_instance.id]
  key_name                    = aws_key_pair.generated.key_name
  associate_public_ip_address = true
  user_data                   = local.user_data

  root_block_device {
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-avatar-gpu-${var.environment}"
  }
}
