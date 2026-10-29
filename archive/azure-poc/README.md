# Arquivo: infraestrutura Azure da POC (descontinuada)

Este diretório guarda, como referência histórica, o código e os workflows
usados quando a POC do LiveSellAI rodava na **Azure** (Function App,
Static Web App, Postgres Flexible Server, Key Vault, Storage Account).

Em 29/10/2026 o produto foi migrado por completo pra **AWS** (ver
`BACKLOG.md`, histórias "Migração Fase 1" a "Fase 6"). Os recursos do
Azure foram desligados e este código **não é mais implantado em lugar
nenhum** -- fica só pra consulta, caso seja preciso entender uma decisão
antiga ou recuperar algum trecho de lógica.

## O que tem aqui

- `backend/` -- backend original em Azure Functions (Node.js). Substituído
  por `backend-aws/` (Express.js, rodando em ECS Fargate).
- `infra/` -- scripts (`az` CLI / PowerShell via Cloud Shell) usados pra
  criar a Storage Account do Azure. Substituído pelo Terraform em
  `infra-aws-app/`.
- `workflows/` -- os dois workflows do GitHub Actions que faziam deploy
  pro Azure (`app-deploy.yml` pro Static Web Apps, `backend-deploy.yml`
  pra Function App). Movidos pra fora de `.github/workflows/` de
  propósito -- o GitHub só executa workflows que estão literalmente
  dentro de `.github/workflows/`, então eles ficam inertes aqui.

## Equivalência Azure → AWS

| Azure (descontinuado) | AWS (atual) |
|---|---|
| Function App | ECS Fargate (`backend-aws/`, `infra-aws-app/ecs.tf`) |
| Static Web App | S3 + CloudFront (`infra-aws-app/frontend.tf`) |
| Postgres Flexible Server | RDS (`infra-aws-app/rds.tf`) |
| Blob Storage | S3 (`infra-aws-app/s3.tf`) |
| Key Vault | Secrets Manager (`infra-aws-app/secrets.tf`) |
