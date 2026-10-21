# infra-aws-dev

Ambiente de desenvolvimento na AWS, provisionado via Terraform com estado
sincronizado no **Terraform Cloud** (HCP Terraform): uma VPC isolada e uma
instância EC2 com GPU (`g4dn.xlarge`, NVIDIA T4) pronta pra rodar o
`avatar-service` (MuseTalk + F5-TTS) sem depender mais de GPU alugada
manualmente (Runstack) como fizemos antes.

## O que isso provisiona

- 1 VPC dedicada (`10.20.0.0/16`), sem NAT Gateway (economiza custo — a
  instância fica numa subnet pública, mas só é acessível de fora pelo seu
  próprio IP)
- 1 security group restrito: só libera SSH (porta 22) e a porta da API do
  avatar-service (8000), ambas apenas pro IP que você configurar — nunca
  pra internet inteira
- 1 instância EC2 `g4dn.xlarge`, usando a **AWS Deep Learning Base GPU AMI**
  (já vem com driver NVIDIA, CUDA e Docker com suporte a GPU configurados —
  evita repetir os patches manuais que tivemos no Runstack)

## Passo 1 — Criar conta no Terraform Cloud

1. Acesse [app.terraform.io/signup](https://app.terraform.io/signup) e crie
   uma conta (gratuita pro uso que vamos fazer aqui)
2. Crie uma **organização** (qualquer nome, ex: `livesellai`)
3. Anote o nome da organização — você vai colocar ele em `providers.tf`,
   no lugar de `SUBSTITUA_PELO_NOME_DA_SUA_ORGANIZACAO_NO_TERRAFORM_CLOUD`

## Passo 2 — Autenticar o Terraform CLI local com o Terraform Cloud

```bash
terraform login
```

Isso abre o navegador, pede confirmação, e gera um token salvo localmente em
`~/.terraform.d/credentials.tfrc.json` (não precisa colar nada manualmente).

## Passo 3 — Chave SSH (gerada automaticamente pelo Terraform)

Não precisa criar um key pair manualmente no console da AWS — o próprio
Terraform gera o par de chaves (`key_pair.tf`, provider `tls`) e expõe a
chave privada como output sensível. Depois do `apply` (passo 6), salve a
chave assim:

```bash
terraform output -raw private_key_pem > livesellai-dev.pem
chmod 400 livesellai-dev.pem
```

(Já tentamos usar um key pair pré-existente e perdemos o `.pem` — gerar
pelo Terraform evita repetir isso: se perder a chave de novo, é só rodar
o comando acima de novo a qualquer momento, o Terraform Cloud guarda o
valor no state.)

## Passo 4 — Dar à AWS as credenciais que o Terraform Cloud vai usar

Como estamos usando o bloco `cloud` (execução remota), quem roda o
`terraform apply` de fato é a infraestrutura do Terraform Cloud, não a sua
máquina — então ele precisa das próprias credenciais da AWS, configuradas
como variáveis do workspace (não aqui no código):

1. No Terraform Cloud, vá em **Workspaces** → o workspace
   `livesellai-infra-aws-dev` será criado automaticamente no primeiro
   `terraform init` (passo 6) — depois disso, abra ele
2. Vá em **Variables** → **Workspace variables** → **Add variable**
3. Adicione como **variáveis de ambiente** (não Terraform variables),
   marcando **Sensitive**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

   (de um usuário/role IAM com permissão de criar VPC, EC2, security group —
   pra uma conta de dev, `AmazonEC2FullReadOnlyAccess` não basta, precisa de
   permissão de escrita em EC2/VPC)

> **Nota de segurança:** isso usa uma chave de acesso de longa duração —
> aceitável pra validar agora, mas o ideal depois é trocar por **Dynamic
> Credentials** (OIDC, sem chave fixa), o mesmo padrão que já usamos no
> GitHub Actions → Azure neste projeto. Fica registrado como próximo passo
> de endurecimento no `BACKLOG.md`.

## Passo 5 — Preencher as variáveis

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edite `terraform.tfvars`:
- `allowed_ssh_cidr`: seu IP público + `/32` (descubra em
  [whatismyip.com](https://www.whatismyip.com/))
- `aws_region`: confirme que é a mesma região onde sua cota de GPU foi
  aprovada (ver caso de suporte da AWS)

`terraform.tfvars` é gitignored — nunca vai pro commit.

## Passo 6 — Inicializar, planejar e aplicar

```bash
terraform init    # conecta no workspace do Terraform Cloud, cria se não existir
terraform plan    # mostra o que vai ser criado, roda remotamente no Terraform Cloud
terraform apply   # cria de verdade (pede confirmação)
```

Ao final, salve a chave privada (ver Passo 3) e confira o IP/comando SSH:

```bash
terraform output instance_public_ip
terraform output ssh_command
```

## Depois de provisionado

```bash
ssh -i livesellai-dev.pem ubuntu@<ip-público>

# Confere se a GPU está visível
nvidia-smi

# Roda o avatar-service (imagem já publicada via GitHub Actions nesta sessão)
docker run --gpus all -p 8000:8000 ghcr.io/glauciodato/livesellai/avatar-service
```

## Destruir o ambiente (pra não gerar custo quando não estiver usando)

```bash
terraform destroy
```

A instância GPU é cobrada por hora rodando — destrua quando não estiver em
uso e recrie (`terraform apply`) quando for testar de novo. Como não
usamos Elastic IP, o IP público muda a cada recriação (normal, é só
conferir de novo com `terraform output`).

## Limitações desta primeira fase

- Autenticação da AWS no Terraform Cloud via chave de acesso estática
  (ver nota de segurança no Passo 4) — endurecer pra Dynamic Credentials
  depois.
- Sem Elastic IP — o IP muda a cada `apply`/`destroy`.
- Bootstrap da instância só confirma que a GPU está visível
  (`/var/log/livesellai-bootstrap.log`) — subir o `avatar-service` ainda é
  manual via SSH (ver acima). Automatizar isso (user data completo, ou
  Docker Compose) é um próximo passo natural.
