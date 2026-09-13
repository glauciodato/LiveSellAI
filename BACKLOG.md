# Backlog

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
