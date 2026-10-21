# Alerta de orçamento: gasto anômalo é um sinal indireto comum de
# comprometimento (ex: alguém usando a conta pra minerar cripto numa
# instância que você nem sabia que existia). Avisa por e-mail em 80% e
# 100% do limite mensal definido.
resource "aws_budgets_budget" "monthly_cost_alert" {
  name         = "${var.project_name}-${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
