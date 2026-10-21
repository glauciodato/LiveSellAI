# Role minima pra instancia conseguir publicar metricas de CPU/GPU/memoria
# no CloudWatch (usada pelo CloudWatch Agent, ver ec2.tf). Sem isso, a
# instancia nao tem nenhuma permissao de AWS por padrao.
resource "aws_iam_role" "gpu_instance" {
  name = "${var.project_name}-${var.environment}-gpu-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-gpu-instance-role"
  }
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.gpu_instance.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "gpu_instance" {
  name = "${var.project_name}-${var.environment}-gpu-instance-profile"
  role = aws_iam_role.gpu_instance.name
}
