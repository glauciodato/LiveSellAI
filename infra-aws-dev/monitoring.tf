# Deteccao de uso continuo anomalo (sinal indireto de comprometimento, tipo
# alguem minerando cripto ou rodando algo sem autorizacao na instancia).
# As cargas legitimas desse projeto (gerar um avatar) sao rajadas curtas
# (~18s cada, ja validado) — uso sustentado por horas e sempre suspeito
# pra essa instancia especificamente.

resource "aws_sns_topic" "security_alerts" {
  name = "${var.project_name}-${var.environment}-security-alerts"
}

resource "aws_sns_topic_subscription" "security_alerts_email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

# CPU: metrica nativa da EC2, nao precisa de agente.
resource "aws_cloudwatch_metric_alarm" "cpu_sustained_high" {
  alarm_name          = "${var.project_name}-${var.environment}-cpu-sustained-high"
  alarm_description   = "CPU com uso sustentado alto por varias horas seguidas - pode indicar uso nao autorizado da instancia."
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = aws_instance.avatar_gpu_dev.id }
  statistic           = "Average"
  period              = 3600 # 1 hora
  evaluation_periods  = var.sustained_usage_hours
  threshold           = var.cpu_alarm_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
  ok_actions          = [aws_sns_topic.security_alerts.arn]
}

# GPU: metrica customizada, publicada pelo CloudWatch Agent via nvidia-smi
# (ver configuracao em ec2.tf/user_data).
resource "aws_cloudwatch_metric_alarm" "gpu_sustained_high" {
  alarm_name          = "${var.project_name}-${var.environment}-gpu-sustained-high"
  alarm_description   = "GPU com uso sustentado alto por varias horas seguidas - pode indicar uso nao autorizado da instancia."
  namespace           = "LiveSellAI/GPUInstance"
  metric_name         = "utilization_gpu"
  dimensions          = { InstanceId = aws_instance.avatar_gpu_dev.id }
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = var.sustained_usage_hours
  threshold           = var.gpu_alarm_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
  ok_actions          = [aws_sns_topic.security_alerts.arn]
}
