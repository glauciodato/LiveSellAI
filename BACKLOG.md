# Backlog

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

**Observação:** upload real contra uma Storage Account do Azure ainda não foi testado ponta a ponta nesta sessão (nenhuma conta Azure foi provisionada aqui) — validar com `poc-v1/infra/create-storage.sh` + `az login` antes de considerar o fluxo 100% ponta a ponta.

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
