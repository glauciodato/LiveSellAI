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

# Bootstrap: confirma que a GPU está visível, deixa o Docker pronto pra
# puxar a imagem do avatar-service (ghcr.io/glauciodato/livesellai/avatar-service,
# já publicada via GitHub Actions), e aplica hardening básico do SO:
# atualizações de segurança automáticas + desativa autenticação por senha
# no SSH (defesa em profundidade — já vem desativado por padrão na imagem
# Ubuntu, mas deixamos explícito). Rodar o container em si fica manual por
# enquanto (ver README.md).
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -e
    echo "=== LiveSellAI dev GPU instance - bootstrap ===" > /var/log/livesellai-bootstrap.log
    nvidia-smi >> /var/log/livesellai-bootstrap.log 2>&1 || echo "AVISO: nvidia-smi falhou" >> /var/log/livesellai-bootstrap.log
    docker --version >> /var/log/livesellai-bootstrap.log 2>&1

    # Hardening: atualizações de segurança automáticas do SO
    apt-get update -y >> /var/log/livesellai-bootstrap.log 2>&1
    apt-get install -y unattended-upgrades >> /var/log/livesellai-bootstrap.log 2>&1
    dpkg-reconfigure -f noninteractive unattended-upgrades >> /var/log/livesellai-bootstrap.log 2>&1

    # Hardening: garante que login por senha no SSH está desativado (defesa
    # em profundidade, além do security group já restringir por IP)
    sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
    sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
    systemctl restart ssh >> /var/log/livesellai-bootstrap.log 2>&1

    # CloudWatch Agent: publica CPU/memória/GPU como métricas, usadas pelos
    # alarmes de uso sustentado anômalo (ver monitoring.tf)
    wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb
    dpkg -i -E /tmp/amazon-cloudwatch-agent.deb >> /var/log/livesellai-bootstrap.log 2>&1

    mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
    cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWAGENT_EOF'
    {
      "metrics": {
        "namespace": "LiveSellAI/GPUInstance",
        "metrics_collected": {
          "nvidia_gpu": {
            "measurement": ["utilization_gpu", "utilization_memory"]
          },
          "cpu": {
            "measurement": ["cpu_usage_active"],
            "totalcpu": true
          },
          "mem": {
            "measurement": ["mem_used_percent"]
          }
        }
      }
    }
    CWAGENT_EOF

    /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
      -a fetch-config -m ec2 -s \
      -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
      >> /var/log/livesellai-bootstrap.log 2>&1

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
  iam_instance_profile        = aws_iam_instance_profile.gpu_instance.name

  # IMDSv2 obrigatório (exige token assinado pra consultar o metadata
  # service) — mitiga roubo de credenciais via SSRF, um vetor de ataque
  # real e documentado contra apps rodando em EC2. hop_limit = 1 impede
  # que um container (como o avatar-service, via Docker) alcance o
  # metadata service da instância hospedeira.
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    http_endpoint               = "enabled"
  }

  root_block_device {
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  tags = {
    Name = "${var.project_name}-avatar-gpu-${var.environment}"
  }
}
