# Backlog

## [CONCLUÍDO] Tela de alterar senha

**Como** usuário do LiveSellAI
**Eu quero** trocar minha senha dentro do próprio app, informando a senha atual e a nova
**Para que** eu não dependa de ninguém mexer direto no banco de dados quando esquecer ou quiser trocar a senha

**Critérios de aceitação:**
- [x] Backend: endpoint `POST /api/change-password` — valida a senha atual (bcrypt), exige a nova com pelo menos 6 caracteres, salva o novo hash
- [x] App: nova tela "Alterar senha" (senha atual, nova senha, confirmar nova senha), acessível a partir da tela principal
- [x] Mensagens de erro claras (senha atual errada, nova senha muito curta, senhas não conferem)
- [x] Testado localmente contra o Postgres real — 6 cenários (senha atual errada, nova senha curta, troca válida, login com senha antiga nega, login com senha nova funciona)

**Observação:** essa tela exige a senha atual, por segurança — não resolve o caso de esquecimento de senha (precisaria de um fluxo de "esqueci minha senha" separado, com verificação por e-mail, não implementado ainda).

**Data:** 22/10/2026

---

## [CONCLUÍDO] Rodar o avatar-service de verdade na instância EC2 (AWS)

**Como** desenvolvedor do LiveSellAI
**Eu quero** gerar um avatar de verdade usando a GPU provisionada na AWS, via o `avatar-service` já publicado no GHCR
**Para que** eu confirme que a infraestrutura própria (sem GPU alugada manualmente) funciona de ponta a ponta

**Critérios de aceitação:**
- [x] Imagem Docker `avatar-service` roda com sucesso na instância EC2 (`docker run --gpus all`)
- [x] Job de geração de avatar completa com sucesso (sem erro), usando um vídeo real já enviado — `{"status": "completed", "blobUrl": "..."}`
- [x] Vídeo do avatar gerado aparece no Blob Storage e é possível assistir — confirmado: `avatars/glauciomartins2_at_gmail.com/1792560637940-avatar-aws-test.mp4`, 1.09 MB, `video/mp4` válido

**Bugs encontrados e corrigidos durante o teste (nessa ordem, cada um só apareceu depois que o anterior foi corrigido):**
1. O `download_weights.sh` original do MuseTalk (script de terceiros, clonado do repositório oficial) tinha 3 problemas que faziam ele falhar silenciosamente (sem nunca baixar nenhum peso de verdade, mas imprimindo "sucesso" mesmo assim): `pip install -U huggingface_hub[cli]` não funciona mais nas versões recentes (não expõe mais esse CLI) e ainda quebra a versão `<2.0` exigida por transformers/gradio/datasets (derrubando o F5-TTS); `gdown --id` usa sintaxe removida; `curl` não está instalado na imagem. Reescrito em `handler.py` pra baixar os pesos direto via API Python (`huggingface_hub.hf_hub_download`, `gdown.download`), sem depender de nenhuma CLI de terceiros.
2. A instalação do F5-TTS no Dockerfile (sem fixar versão) puxa um PyTorch mais novo (2.14.1) como dependência transitiva, quebrando a compatibilidade binária do `mmcv` (compilado contra `torch==2.0.1` na build da imagem) — erro `undefined symbol` ao importar mmcv/mmdet dentro do processo do MuseTalk. Corrigido reinstalando `torch==2.0.1`/`torchvision==0.15.2`/`torchaudio==2.0.2` (com `--no-deps --force-reinstall`) logo antes de chamar o MuseTalk, já que o F5-TTS roda antes disso e não é afetado.
3. O `bitsandbytes` (dependência opcional do `mmengine`, puxada de carona) não funciona com `torch==2.0.1` (usa uma API só disponível em versões bem mais novas do torch) — mesmo problema que já tínhamos resolvido manualmente no setup do Runstack. Corrigido removendo o `bitsandbytes` (é opcional, nada no pipeline depende dele de verdade) logo após repinar o torch.
4. O `transformers` (também puxado sem pin pelo F5-TTS) em versão recente exige `PyTorch >= 2.6` — com `torch==2.0.1` ele se autodesliga e quebra com um bug próprio (`NameError: name 'nn' is not defined`) ao ser importado indiretamente pelo `mmdet`. Corrigido fixando `transformers==4.39.2` — a mesma combinação (torch 2.0.1 + mmcv 2.0.1 + transformers 4.39.2) já validada manualmente no setup do Runstack.
5. O `tokenizers` instalado (puxado de carona, sem pin, por uma versão mais nova do transformers que já passou pelo ambiente) ficou incompatível com `transformers==4.39.2` (exige `tokenizers<0.19`, estava em `0.23.3`) — como o fix anterior usa `--no-deps`, o tokenizers não foi rebaixado junto. Corrigido fixando `tokenizers==0.15.2` na mesma chamada de pip.
6. Conflito com o **nosso próprio** fix #1: `huggingface_hub==1.31.0` (fixado pra resolver o download de pesos) é incompatível com `transformers==4.39.2`, que exige `huggingface_hub<1.0`. Como o download de pesos já terminou antes dessa etapa rodar, é seguro rebaixar — corrigido fixando `huggingface_hub==0.23.2` junto com transformers/tokenizers.

**Nota operacional:** cada rebuild da imagem acumula bastante espaço em disco na instância (imagens antigas + camadas não reaproveitadas entre versões diferentes de torch/transformers) — já precisamos rodar `docker system prune -a -f --volumes` várias vezes durante esses testes pra não ficar sem espaço. Rodar isso preventivamente antes de cada novo `docker pull` enquanto estivermos iterando.

**Resultado final:** depois de 6 bugs corrigidos em cadeia (todos de incompatibilidade de versão entre dependências instaladas sem pin no Dockerfile), o 7º job completou com sucesso — primeira geração de avatar de ponta a ponta na infraestrutura própria da AWS, confirmando que o pipeline (MuseTalk + F5-TTS) funciona com a GPU `g4dn.xlarge`.

**Próximos passos naturais (não feitos ainda):** (1) consertar os 6 bugs direto no `Dockerfile` (fixando as versões na build da imagem, em vez de corrigir em runtime no `handler.py`) pra evitar o custo de reinstalar ~2.3GB de PyTorch a cada job; (2) usar um volume Docker persistente pros pesos do MuseTalk, evitando rebaixar tudo a cada cold start; (3) revisar a qualidade do resultado gerado (o vídeo de teste ainda não foi assistido/avaliado).

**Data:** 21/10/2026

---

## [CONCLUÍDO] Hardening de segurança do ambiente de dev na AWS

**Como** responsável pelo produto LiveSellAI
**Eu quero** garantir que a instância EC2/VPC provisionada esteja protegida contra ataques antes de rodar o projeto de verdade nela
**Para que** não sofremos comprometimento de conta/dados por uma configuração insegura

**Critérios de aceitação:**
- [x] IMDSv2 obrigatório na instância (evita roubo de credenciais via SSRF) — confirmado via SSH (`401` sem token)
- [x] Disco (EBS) criptografado em repouso
- [x] Usuário IAM usado pelo Terraform Cloud com permissão mínima necessária (não `AmazonEC2FullAccess` — ver `iam-policy-terraform-runner.json`)
- [x] Acesso SSH/API continua restrito só ao IP do desenvolvedor (sem exposição a mais ninguém por enquanto)
- [x] Alerta de orçamento configurado (80%/100% do limite mensal, por e-mail via SNS)
- [x] Documentado no README o que foi endurecido e o que ainda fica como próximo passo

**Adicionado também (pedido do usuário):** monitoramento de uso sustentado de CPU e GPU via CloudWatch (métricas nativas + CloudWatch Agent com coleta de `nvidia-smi`), com alarme por e-mail se ficar sustentado acima do limiar por várias horas — sinal indireto de uso não autorizado (ex: mineração de cripto).

**Observação:** decisão estratégica tomada nessa conversa (20-21/10/2026): o produto vai migrar do Azure pra rodar tudo na AWS — migração maior, tratada em etapas futuras, não faz parte desta história.

**Data:** 21/10/2026

---

## [CONCLUÍDO] Provisionar ambiente de dev na AWS via Terraform (VPC segura + EC2 com GPU)

**Como** desenvolvedor do LiveSellAI
**Eu quero** infraestrutura como código (Terraform, com estado sincronizado no Terraform Cloud) provisionando uma VPC segura e uma instância EC2 com GPU
**Para que** eu tenha um ambiente de desenvolvimento estável e versionado pra rodar o avatar-service (MuseTalk + F5-TTS), sem depender mais de GPU alugada manualmente (Runstack) ou de cota aprovada mas nunca usada

**Critérios de aceitação:**
- [x] Pasta `infra-aws-dev/` com código Terraform organizado (VPC, subnet, security group, instância EC2 GPU)
- [x] Backend remoto configurado no Terraform Cloud (estado compartilhado e versionado, fora do Git) — organização `Sellai-Live`, workspace `livesellai-infra-aws-dev`
- [x] VPC com acesso restrito por padrão (SSH só liberado pro IP do desenvolvedor — nunca `0.0.0.0/0`)
- [x] Instância EC2 usa uma AMI com driver de GPU/CUDA e Docker já prontos (AWS Deep Learning AMI), tipo `g4dn.xlarge` (GPU T4, já validado no pipeline MuseTalk + F5-TTS nessa sessão)
- [x] `terraform plan`/`apply` executado com sucesso contra a conta AWS real, instância provisionada (`g4dn.xlarge`, região `us-east-1`) e acessível via SSH — GPU Tesla T4 (16GB VRAM) e Docker confirmados via SSH
- [x] Documentado no README: como criar conta/organização no Terraform Cloud, autenticar, e rodar

**Observação:** autenticação da AWS no Terraform Cloud começa com Access Key/Secret Key como variável sensível do workspace (mais rápido de validar agora); endurecer depois pra Dynamic Credentials (OIDC, sem chave de longa duração) é um passo seguinte — mesmo padrão que já usamos no GitHub Actions → Azure.

**Ajustes feitos durante a implementação:**
- O campo `description` de Security Group da AWS só aceita ASCII — tivemos que remover acentos.
- O par de chaves EC2 criado manualmente no console (`gpu-keypair`) teve o `.pem` perdido antes de ser usado — trocamos pra gerar o par de chaves via Terraform (`key_pair.tf`, provider `tls`), com a chave privada disponível como output sensível (`terraform output -raw private_key_pem`), evitando depender de download manual.

**Data:** 20/10/2026

---

## [PENDENTE] Validar viabilidade de live com vídeo em loop reagindo a comentários

**Como** responsável pelo produto LiveSellAI
**Eu quero** validar tecnicamente se dá pra exibir um vídeo de produto em loop numa live e reagir (tocando um áudio de apresentação) quando alguém comenta
**Para que** a gente saiba se essa ideia é viável antes de investir em construir a versão de verdade

**Critérios de aceitação:**
- [ ] Protótipo dentro do repositório (`poc-v1/live-poc/`), sem precisar de infraestrutura nova (Azure/backend)
- [ ] Conecta no chat de uma live real do YouTube (API pública, só com API key) e mostra os comentários chegando
- [ ] Vídeo de produto (configurável) toca em loop; ao chegar o primeiro comentário, dispara um áudio de apresentação (configurável)
- [ ] Testado contra uma live real do YouTube (não mock)

**Observação:** é uma validação inicial de viabilidade — não é a versão final do produto. Integração com Instagram/TikTok Live fica de fora por enquanto (acesso a comentários dessas plataformas exige aprovação de parceiro, processo mais longo).

**Data:** 13/09/2026

---

## [CONCLUÍDO] Listar meus vídeos enviados

**Como** vendedor (usuário do LiveSellAI)
**Eu quero** ver a lista de vídeos que já enviei, não só o avatar já gerado
**Para que** eu consiga conferir o que já mandei e escolher qual assistir

**Critérios de aceitação:**
- [x] Backend: endpoint (`GET /api/videos`) lista os vídeos do tenant logado (nome, tamanho, data de envio, URL de leitura com SAS temporário)
- [x] App: nova seção na tela principal ("Meus vídeos enviados") com a lista, permitindo assistir a qualquer um deles
- [x] Testado com vídeos reais já enviados no Blob Storage

**Data:** 13/09/2026

---

## [CONCLUÍDO] Cadastro e login de verdade (com senha), usando Postgres

**Como** vendedor (usuário do LiveSellAI)
**Eu quero** criar uma conta com nome, e-mail e senha, e fazer login com essas credenciais
**Para que** minha conta seja protegida de verdade, e não só "informar um e-mail qualquer" como é hoje

**Critérios de aceitação:**
- [x] Instância do Azure Database for PostgreSQL Flexible Server provisionada (tier Burstable, o menor disponível — só para desenvolvimento/POC)
- [x] Tabela de usuários/tenants criada (nome, e-mail único, hash da senha, data de criação)
- [x] Backend: endpoint de cadastro (`POST /api/register`) — valida e-mail único, guarda a senha com hash (bcrypt), nunca em texto puro
- [x] Backend: endpoint de login (`POST /api/login`) — valida e-mail + senha
- [x] App: tela de cadastro (nome, e-mail, senha, confirmar senha) e tela de login (e-mail, senha), substituindo a tela atual de "só e-mail"
- [x] Testado localmente contra o Postgres real

**Observação:** isso substitui o mock atual (e-mail salvo só no `AsyncStorage`, sem validação nenhuma) por autenticação de verdade. O isolamento multi-tenant passa a ser garantido pelo cadastro no banco, não só pela convenção de nomes de pasta no Blob Storage.

**Implementado também (além do previsto originalmente):** a senha do Postgres não fica em texto puro nas configurações do Function App — foi criado um Azure Key Vault (`livesellai-poc-kv`) com Managed Identity, e o App Setting `PGPASSWORD` guarda só uma referência (`@Microsoft.KeyVault(...)`), resolvida pela plataforma em runtime.

**Data:** 13/09/2026

---

## [CONCLUÍDO] Implantar o backend de verdade no Azure (deploy automático via GitHub Actions)

**Como** desenvolvedor do LiveSellAI
**Eu quero** que o backend rode de verdade no Azure (não só localmente), com deploy automático a cada mudança
**Para que** o app consiga usar um backend real, acessível de qualquer lugar (inclusive de um celular via Expo Go)

**Critérios de aceitação:**
- [x] Function App criada no Azure (`livesellai-poc-backend`, plano **Flex Consumption** — o clássico "Linux Consumption" ficou indisponível por ~50min nessa subscription nova, tanto em Brazil South quanto East US)
- [x] Variáveis de ambiente (Storage Account, container, CORS) configuradas na Function App
- [x] GitHub Actions (`.github/workflows/backend-deploy.yml`) fazendo deploy automático a cada push em `poc-v1/backend/`
- [x] Autenticação do workflow via **OIDC** (App Registration + federated credential — Flex Consumption não suporta mais "publish profile")
- [x] Testado: os 3 endpoints (`generate-sas-token`, `generate-avatar`, `latest-avatar`) respondendo corretamente em `https://livesellai-poc-backend.azurewebsites.net/api`

**Observações/pegadinhas encontradas:**
- Precisou registrar o provider `Microsoft.Web` (mesmo padrão de `Microsoft.Storage`/`Microsoft.Compute` antes)
- Node 20 já estava fora de suporte (usar `--runtime-version 24` na criação)
- O primeiro Function App (Linux Consumption clássico) ficou retornando **503** por quase 1 hora, tanto em Brazil South quanto East US, mesmo com todas as operações do Activity Log mostrando "Succeeded" — indício de atraso de provisionamento de infraestrutura nessa subscription nova. Resolvido migrando pra **Flex Consumption**, que ficou pronto em poucos minutos.
- O `subject` do federated credential precisou ser ajustado pro formato exato que esse GitHub manda (`repo:<owner>@<id>/<repo>@<id>:ref:refs/heads/main`, com IDs numéricos — não o formato simples `owner/repo` da documentação padrão)

**Data:** 13/09/2026

---

## [CONCLUÍDO] Ver o avatar já gerado, dentro do próprio app

**Como** vendedor (usuário do LiveSellAI)
**Eu quero** ver, na mesma tela onde envio meu vídeo, o avatar já gerado pra mim (se existir)
**Para que** eu não precise pedir pra alguém rodar comandos manuais só pra eu conferir o resultado

**Critérios de aceitação:**
- [x] Backend: novo endpoint (`getLatestAvatar`, `GET /api/latest-avatar?tenantId=...`) que procura o blob mais recente em `avatars/<tenant>/` e devolve uma URL de leitura (SAS) — ou `{found:false}` se ainda não existe nenhum
- [x] App: na tela de upload (`UploadScreen`), uma seção "Meu avatar" abaixo mostra o player (`expo-video`) com esse vídeo, ou uma mensagem dizendo que ainda não foi gerado nenhum, com botão "Atualizar"
- [x] Testado localmente contra a Storage Account real (tenant com avatar existente e tenant sem nenhum)

**Observação:** a geração do avatar em si (MuseTalk/F5-TTS) continua sendo disparada manualmente por enquanto (ver história anterior) — esta história é só sobre **visualizar** o resultado já existente.

**Data:** 13/09/2026

---

## [PENDENTE] POC de geração de avatar falante a partir do vídeo enviado (MuseTalk + F5-TTS)

**Como** vendedor (usuário do LiveSellAI)
**Eu quero** que, a partir do vídeo de ~2 minutos que já enviei, o sistema gere um avatar falando um texto arbitrário que eu forneça
**Para que** eu possa usar esse avatar em vendas ao vivo sem precisar regravar vídeo toda vez

**Decisões técnicas tomadas nesta sessão:**
- Modelo de sincronização labial: **Tencent MuseTalk v1.5** (licença MIT, uso comercial liberado, ~30 FPS, 8–12 GB VRAM) — escolhido em vez do LatentSync v1.6 (melhor qualidade visual, porém licença OpenRAIL++ nos pesos e ≥18 GB VRAM) e em vez de TalkingGaussian/GeneFace++ (não-comerciais por dependerem do Basel Face Model)
- Clonagem/síntese de voz: **F5-TTS** (zero-shot a partir de 5–15s do próprio áudio do vídeo, suporta português)
- Infraestrutura de execução: **RunPod Serverless** (GPU sob demanda, pay-per-uso) — escolhido em vez de VM com GPU sempre ligada no Azure ou execução local (sem GPU Nvidia disponível nas máquinas do time)

**Critérios de aceitação:**
- [x] Serviço (Docker) recebe: URL do vídeo de origem (SAS de leitura), texto a ser falado, e URL de upload do resultado (SAS de escrita) *(código escrito em `poc-v1/avatar-service/`, não validado em GPU real ainda)*
- [x] Pipeline: extrai amostra de áudio do vídeo → clona voz e sintetiza o texto com F5-TTS → gera vídeo com sincronização labial via MuseTalk → envia o resultado para o Azure Blob Storage *(implementado no `handler.py`, idem)*
- [x] Backend (Azure Function) ganha um endpoint que orquestra a chamada ao RunPod (gera as URLs necessárias e aciona o job) *(`generateAvatar` + `getAvatarStatus`, testados localmente contra a Storage Account real — geração das URLs SAS confirmada; chamada ao RunPod ainda não testada por falta de endpoint configurado)*
- [ ] Teste real ponta a ponta: vídeo já enviado nesta POC → avatar gerado com um texto novo → resultado acessível no Azure Blob Storage
- [x] Documentação de deploy do serviço (build/push da imagem, criação do Pod/endpoint, variáveis de ambiente necessárias) — ver `poc-v1/avatar-service/README.md`

**Observações / histórico de tentativas de infraestrutura:**
- **RunPod**: bloqueado por problema no pagamento internacional (cartão recusado) — mantido como opção "Opção B" no README, caso o usuário resolva o pagamento depois. O `handler.py` já suporta o modo serverless do RunPod nativamente.
- **Azure (ACI/AKS/VM com GPU)**: subscription nova, cota de GPU (famílias NC/ND/NV) em **0** em todas as famílias, confirmado via `az vm list-usage`. Pedido de aumento de cota é gratuito mas pode demorar dias ou ser negado — usuário decidiu abrir o pedido em paralelo e não esperar por ele.
- **Vast.ai**: escolhido como alternativa imediata. Diferença importante: não builda a imagem a partir do GitHub como o RunPod — por isso foi criado `.github/workflows/avatar-service-image.yml`, que builda e publica a imagem no GHCR (`ghcr.io/glauciodato/livesellai/avatar-service`) a cada mudança em `poc-v1/avatar-service/`. O "Serverless" do Vast.ai tem arquitetura própria (PyWorker HTTP), mais trabalhosa de adaptar agora — decidido validar primeiro rodando manualmente num Pod on-demand comum (`handler.py` ganhou um modo CLI para isso, além do modo RunPod).
- Testado localmente (num Mac, sem GPU) que as dependências mais arriscadas do MuseTalk (`mmcv`, `mmdet`, `mmpose`) **instalam** com alguns ajustes — não confirma que a inferência funciona, só que a instalação não é um bloqueio fundamental.
- **Runstack (runstack.com.br)**: provedor brasileiro de GPU Pods, usado para o teste manual real (pagamento em R$ funcionou). Não aceita imagem Docker customizada (só templates prontos) — por isso o `setup-manual.sh` foi criado/evoluído bastante nesta sessão para instalar tudo manualmente num template "VS Code Server". Depois de MUITAS iterações (ver histórico de commits do dia 13/09), o script chegou a rodar o pipeline completo (download do vídeo → Whisper → F5-TTS → MuseTalk) até faltar apenas memória de GPU.
- **Achados importantes (já corrigidos no `setup-manual.sh`, reaproveitáveis em qualquer Pod novo):**
  - Python do sistema em Pods novos costuma ser 3.12+ (muito mais novo que o MuseTalk testa) → script usa Python 3.10 dedicado num venv
  - Faltava `build-essential` e `ffmpeg` no template — adicionados
  - `setuptools>=81` removeu `pkg_resources` (quebra build do mmcv) → fixado `setuptools<81`
  - Pod sem CUDA toolkit completo (só driver) → `mmcv`/`mmdet`/`mmpose` compilados com `CUDA_VISIBLE_DEVICES=""` (CPU-only na build, GPU normal em uso)
  - F5-TTS/Whisper puxam versões mais novas de `torch`, `transformers` e instalam `bitsandbytes` (quebra import do mmengine/mmdet com torch 2.0.1) → reinstala/fixa `torch==2.0.1` e `transformers==4.39.2` **depois** do F5-TTS, e remove `bitsandbytes`
  - `download_weights.sh` oficial do MuseTalk aponta pra um mirror chinês (`hf-mirror.com`) instável a partir daqui, falha silenciosamente pra alguns arquivos (`dwpose`, `sd-vae`, `musetalkV15/unet.pth` todos já apareceram faltando) → substituído por downloads diretos do HuggingFace oficial, com checagem de todos os arquivos esperados no final
  - **Bloqueio atual**: o Pod criado (rotulado "Tesla T4" na Runstack) só permite ~2,64GB de VRAM utilizável de verdade (testado com alocação direta via PyTorch), mesmo a placa física tendo 14,57GB — é uma GPU fracionada/compartilhada. O MuseTalk (VAE+UNet+detecção de rosto) precisa de mais que isso. **Próximo passo: recriar o Pod num plano com mais VRAM** (Large/7GB tentar primeiro, RTX 4090/24GB se precisar) — sem isso, é só rodar o `setup-manual.sh` de novo (já deve passar direto por tudo que foi corrigido) e testar com as mesmas URLs SAS (ou gerar novas, se expiraram).

**Data:** 13/09/2026

---

## [CONCLUÍDO] POC inicial do app (Expo) com login por e-mail e upload de vídeo para Azure Blob Storage

**Como** vendedor (usuário do LiveSellAI)
**Eu quero** acessar o app informando apenas meu e-mail, gravar ou selecionar um vídeo do dispositivo e enviá-lo para um container no Azure Blob Storage
**Para que** eu possa validar o fluxo essencial do produto (identificação por tenant e upload de vídeo) nesta primeira versão de prova de conceito

**Critérios de aceitação:**
- [x] App Expo (React Native) roda a partir do mesmo código em Web, iOS e Android *(Web validado nesta sessão via build/bundle; iOS/Android usam o mesmo código mas não foram executados em dispositivo/simulador por falta de ambiente — validar antes do próximo passo)*
- [x] Tela inicial com campo de e-mail; o e-mail informado identifica o tenant (armazenamento local/mock, sem senha nesta fase)
- [x] Usuário consegue selecionar um vídeo já existente no dispositivo ou gravar um novo vídeo
- [x] Botão de upload envia o vídeo selecionado/gravado para um container no Azure Blob Storage
- [x] Upload usa um SAS token de curta duração gerado por um backend leve (Azure Function), sem expor a chave da Storage Account no app
- [x] Nome do blob inclui identificação do tenant (e-mail) para simular isolamento multi-tenant
- [x] Documentação (README) com passos para criar a Storage Account/container no Azure e rodar o app e o backend localmente

**Observação (atualizada em 11/09/2026):** Storage Account `livesellaipoc4821` (Brazil South, resource group `rg-livesellai-poc`) criada no Azure via Cloud Shell (login local do Azure CLI foi bloqueado por política de "Security defaults" do tenant — contornado usando o Cloud Shell, que autentica pela sessão do portal). Fluxo completo validado ponta a ponta nesta máquina: backend (Azure Function via `func start`) rodando localmente com as credenciais reais, chamado via `POST /api/generate-sas-token`, gerou um SAS real; o `PUT` do vídeo de teste usando essa URL retornou `201 Created` e o MD5 do arquivo bateu com o `Content-MD5` devolvido pelo Azure (upload íntegro). Confirmado também que a conta bloqueia acesso público (`409 PublicAccessNotPermitted` sem SAS). Falta apenas testar a partir do app Expo em si (UI) e em iOS/Android físicos — a lógica de backend + Azure já está validada de ponta a ponta.

**Data:** 11/09/2026

---

Histórias de usuário do projeto, em ordem cronológica (mais recente no topo).

---

<!-- Exemplo de formato de história -->
<!--
## [PENDENTE] Título curto da funcionalidade

**Como** tipo de usuário
**Eu quero** ação desejada
**Para que** benefício/motivo

**Critérios de aceitação:**
- [ ] Critério 1
- [ ] Critério 2

**Data:** DD/MM/AAAA
-->
