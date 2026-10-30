# ECS Fargate rodando o backend-aws atrás de um Application Load Balancer.
# Usa as mesmas subnets públicas do RDS (sem NAT Gateway -- custo extra
# desnecessário pra POC); tasks recebem IP público próprio.

# Diferente do RDS/ALB, o ECS não cria essa role sozinho quando a chamada
# vem da API/Terraform (só quando alguém acessa o console do ECS pela
# primeira vez) -- precisa criar explicitamente, senão o CreateService falha
# com "Unable to assume the service linked role".
resource "aws_iam_service_linked_role" "ecs" {
  aws_service_name = "ecs.amazonaws.com"
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "disabled" # custo extra, não precisa pra POC
  }

  tags = {
    Name = "${var.project_name}-ecs-cluster-${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-backend-logs-${var.environment}"
  }
}

# --- Security groups -------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-${var.environment}"
  description = "ALB publico do backend"
  vpc_id      = aws_vpc.app.id

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP publico"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all_outbound" {
  security_group_id = aws_security_group.alb.id
  description       = "Todo trafego de saida liberado"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-tasks-${var.environment}"
  description = "Tasks do backend -- so aceita trafego do ALB"
  vpc_id      = aws_vpc.app.id

  tags = {
    Name = "${var.project_name}-ecs-tasks-sg-${var.environment}"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs_tasks.id
  description                  = "Apenas trafego do ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_tasks_all_outbound" {
  security_group_id = aws_security_group.ecs_tasks.id
  description       = "Todo trafego de saida liberado"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Libera o RDS pras tasks do ECS, além do IP do desenvolvedor já liberado em rds.tf.
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Postgres a partir das tasks do backend no ECS"
  referenced_security_group_id = aws_security_group.ecs_tasks.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# --- IAM: Task Execution Role (infra da task -- pull da imagem, logs, segredo) ---

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.project_name}-ecs-task-execution-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json

  tags = {
    Name = "${var.project_name}-ecs-task-execution-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${var.project_name}-ecs-task-execution-secrets-${var.environment}"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadDbPasswordSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.db_password.arn
      }
    ]
  })
}

# --- IAM: Task Role (permissões em runtime da aplicação -- S3) -------------

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-ecs-task-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json

  tags = {
    Name = "${var.project_name}-ecs-task-${var.environment}"
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${var.project_name}-ecs-task-s3-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BackendS3ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Sid      = "BackendS3ListBucket"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.media.arn
      }
    ]
  })
}

# --- Task definition ---------------------------------------------------------

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      essential = true

      portMappings = [
        { containerPort = 8080, protocol = "tcp" }
      ]

      environment = [
        { name = "PORT", value = "8080" },
        { name = "CORS_ALLOWED_ORIGIN", value = "*" },
        { name = "PGHOST", value = split(":", aws_db_instance.main.endpoint)[0] },
        { name = "PGPORT", value = "5432" },
        { name = "PGDATABASE", value = var.db_name },
        { name = "PGUSER", value = var.db_username },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.media.id },
        { name = "UPLOAD_URL_EXPIRY_MINUTES", value = "15" },
        { name = "READ_URL_EXPIRY_MINUTES", value = "60" },
        { name = "GOOGLE_CLIENT_ID", value = var.google_client_id },
      ]

      secrets = [
        { name = "PGPASSWORD", valueFrom = aws_secretsmanager_secret.db_password.arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-backend-taskdef-${var.environment}"
  }
}

# --- Application Load Balancer ----------------------------------------------

resource "aws_lb" "backend" {
  name               = "${var.project_name}-backend-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.app_a.id, aws_subnet.app_b.id]

  tags = {
    Name = "${var.project_name}-backend-alb-${var.environment}"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-${var.environment}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.app.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
  }

  tags = {
    Name = "${var.project_name}-backend-tg-${var.environment}"
  }
}

resource "aws_lb_listener" "backend_http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# --- Service -------------------------------------------------------------

resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.app_a.id, aws_subnet.app_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true # subnets públicas, sem NAT Gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.backend_http, aws_iam_service_linked_role.ecs]

  tags = {
    Name = "${var.project_name}-backend-svc-${var.environment}"
  }
}
