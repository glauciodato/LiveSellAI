# infra-aws-app

Infraestrutura "de verdade" da aplicação LiveSellAI na AWS — separada do
`infra-aws-dev` (que é só a sandbox descartável da GPU). Essa pasta vai
crescer nas próximas fases da migração (RDS, ECS Fargate, CloudFront);
por enquanto só tem o **S3** (Fase 1 do plano de migração, ver
`BACKLOG.md`).

## Pré-requisitos (se já fez isso no `infra-aws-dev`, pode pular)

- Conta no [Terraform Cloud](https://app.terraform.io) (organização `Sellai-Live`, já existe)
- `terraform login` já feito na sua máquina (mesmo token de antes)
- Usuário IAM `terraform-cloud-dev` já existe na AWS (criado durante o `infra-aws-dev`)

## Passo 1 — Dar ao usuário IAM permissão de S3

Esse projeto usa o **mesmo usuário IAM** (`terraform-cloud-dev`), só com
uma política **adicional** anexada (além da que ele já tem pro
`infra-aws-dev`):

1. Console da AWS → **IAM** → **Policies** → **Create policy**
2. Aba **JSON** → cola o conteúdo de `iam-policy-terraform-runner.json` deste diretório
3. Nome: `livesellai-app-infra`
4. **Create policy**
5. Vai em **IAM** → **Users** → `terraform-cloud-dev` → **Add permissions** → **Attach policies directly**
6. Busca `livesellai-app-infra` → marca → **Add permissions**

Agora esse usuário tem duas políticas: `livesellai-dev-infra` (EC2/VPC, do
projeto `infra-aws-dev`) e `livesellai-app-infra` (S3, esse projeto).

## Passo 2 — Configurar as credenciais no workspace do Terraform Cloud

Cada workspace do Terraform Cloud tem suas próprias variáveis — mesmo
sendo o mesmo usuário IAM, precisa configurar de novo aqui:

1. `terraform init` (abaixo, no Passo 4) cria o workspace
   `livesellai-infra-aws-app` automaticamente na organização `Sellai-Live`
2. Abre esse workspace no [app.terraform.io](https://app.terraform.io)
3. **Variables** → **Workspace variables** → **Add variable**, categoria
   **"Environment variable"**, marcando **Sensitive**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

   (os mesmos valores do usuário `terraform-cloud-dev` que você já tem
   guardado — não precisa gerar uma chave nova)

## Passo 3 — Variáveis (opcional)

Todas as variáveis têm valor padrão razoável pra essa fase — não precisa
criar `terraform.tfvars` a menos que queira mudar algo (ex: região).

## Passo 4 — Inicializar, planejar e aplicar

```bash
terraform init
terraform plan
terraform apply
```

## Passo 5 — Testar de verdade

```bash
terraform output bucket_name
```

Teste manual rápido (gera uma presigned URL e sobe um arquivo) — rode um
script Node local com o AWS SDK, ou use o AWS CLI se tiver configurado:

```bash
echo "teste" > /tmp/teste.txt
aws s3 cp /tmp/teste.txt s3://$(terraform output -raw bucket_name)/tenants/teste/teste.txt
aws s3 ls s3://$(terraform output -raw bucket_name)/tenants/teste/
```

## Estrutura de pastas dentro do bucket

Mesma convenção que já usamos no Azure Blob Storage:

```
tenants/<tenant-sanitizado>/<timestamp>-<arquivo>.mp4   # vídeos enviados
avatars/<tenant-sanitizado>/<timestamp>-<arquivo>.mp4   # avatares gerados
```

## Próximas fases (ainda não feitas)

- RDS Postgres
- Backend em ECS Fargate (vai gerar presigned URLs pra esse bucket, igual
  o backend atual gera SAS tokens pro Azure Blob Storage)
- Frontend em S3 + CloudFront
- Corte final + desligar os recursos do Azure
