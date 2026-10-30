# Roadmap

Lista de features em fases, pensada como um "menu" de onde puxar a próxima
história pro `BACKLOG.md`. Isso aqui não é compromisso de prazo nem ordem
rígida — é referência de visão de produto. Quando um item daqui vira
trabalho de verdade, ele sai aqui (marcado `→ BACKLOG`) e vira uma história
formal no `BACKLOG.md`, seguindo o fluxo normal do projeto (`CLAUDE.md`).

**Princípio norteador (do usuário, 30/10/2026):** nascer pequeno (tipo
Nubank), um recurso de cada vez, bem devagar — não tentar construir tudo de
uma vez só porque a inspiração mostra um produto completo.

## Inspiração

[Manual da Syntopia](https://syntopia.ai/docs/sections/00/index.html) —
plataforma de "host digital" pra live comercial 24/7 (Taobao/Douyin/TikTok).
Pilares: treino de avatar a partir de vídeo gravado, clonagem de voz a
partir de áudio gravado, transmissão "ao vivo" rodando localmente numa GPU
do usuário (conectada à plataforma via câmera/microfone virtual — não é
geração remota na nuvem), roteiro por produto (manual ou gerado por IA via
DeepSeek), e uma camada grande de operação/SOP (checklist pré-live, troca
de turno, proteção contra banimento) que é bem específica da realidade de
live comercial chinesa — não necessariamente aplicável à gente.

**Diferença importante de arquitetura:** a Syntopia faz o usuário instalar
um cliente pesado numa máquina com GPU própria e conecta numa plataforma de
terceiro via truque de câmera/microfone virtual. O SellAI roda na nuvem
(GPU na AWS) e a ideia é transmitir **pela nossa própria plataforma**, não
imitando câmera numa live de terceiro — é um problema de arquitetura
diferente, mais parecido com um player de vídeo ao vivo que a gente
controla de ponta a ponta.

## O que já existe (conferido em 30/10/2026, não é "a fazer")

- **Avatar (MuseTalk)**: gera vídeo com lip-sync a partir de um vídeo de
  origem + texto — já funciona de ponta a ponta na GPU da AWS
  (`avatar-service-aws/`). Falta só expor como botão no app (hoje é CLI
  manual).
- **Clonagem de voz (F5-TTS)**: **já acontece automaticamente** dentro do
  mesmo pipeline — extrai um trecho do próprio vídeo de origem, transcreve
  com Whisper, e usa isso como referência pro F5-TTS clonar a voz. Não é um
  passo separado de "upload de áudio" como na Syntopia.
- Qualidade conhecida como não-ideal (boca borrada, voz robotizada em
  PT-BR) — ver histórico no `BACKLOG.md`, pausado, não investigado nesta
  fase.

---

## Fase 1 — ligar o motor que já existe (foco atual)

**Checklist de onboarding adaptado da Syntopia (30/10/2026)** — a inspiração
original tem 7 passos pensados pra injetar o avatar numa live de terceiro
(Douyin/Taobao) via câmera/microfone virtual. Adaptado pro nosso modelo
(plataforma própria):

0. **→ BACKLOG** Home com o checklist abaixo (UI/UX, sem automação) — ver
   história "Home com checklist de onboarding" no `BACKLOG.md`
1. Clonar um avatar
2. Clonar uma voz (hoje é automático, a partir do vídeo do passo 1 — pode
   virar um passo "de verdade" depois, com upload de áudio dedicado pra
   melhor qualidade)
3. Criar o script
4. Conectar um LLM (gerar variações do script com IA — já temos acesso à
   API da Claude, não precisa de outro provedor tipo o DeepSeek deles)
5. Testar a transmissão (adaptado de "instalar áudio virtual" — não
   precisamos desse truque, mas faz sentido ter um passo de preview antes
   de ir ao vivo de verdade)
6. Entrar ao vivo
7. Compartilhar o link da live (adaptado de "adicionar o link da
   transmissão" — na Syntopia é colar o link de uma plataforma de
   terceiro; pra gente é o oposto, é distribuir o NOSSO link)

Dentro desse checklist, a ordem de construção é uma de cada vez:

1. **Botão "Clonar avatar" no app** — upload do vídeo de treino, mostra o
   resultado. Por enquanto só a porta de entrada (UI); o processamento em
   si continua manual por trás até virar uma história de infra separada
   (disparar/acompanhar o job remotamente, o que exige resolver a GPU
   instável/SSH quebrado primeiro).
2. **Tela de "Clonar voz"** — por enquanto informativa (explica que já
   acontece automático a partir do vídeo do passo 1).
3. **Gerenciar avatares gerados** — listar, trocar o "avatar ativo", talvez
   permitir apagar. Já tem endpoints parciais (`latest-avatar`, `videos`) —
   avaliar o que falta pra virar uma tela de verdade.
4. **"Live" v0 (sem geração em tempo real ainda)** — uma página que toca em
   loop um vídeo de avatar já gerado, com visual de "ao vivo" (like contador
   de espectadores, chat decorativo). Serve pra validar a experiência de
   produto antes de resolver o problema caro (geração em tempo real).
5. **Spike técnico: geração em tempo real** — antes de construir, avaliar
   se dá pra rodar MuseTalk+F5-TTS com latência baixa o suficiente pra
   parecer ao vivo, ou se vale mais a pena usar um serviço de terceiro
   especializado em avatar real-time (ex: HeyGen Interactive Avatar, Tavus,
   D-ID streaming) em vez de construir do zero. Decisão de arquitetura, não
   implementação ainda.
6. **Transmissão ao vivo de verdade** — depende da decisão do item 5.

## Fase 2 — crescimento (depois que a Fase 1 rodar de ponta a ponta)

- Integração com chat ao vivo (reagir a comentários em tempo real — já tem
  um protótipo não confirmado em `poc-v1/live-poc/`, pensado pro YouTube)
- Roteiro organizado por produto (como a Syntopia faz), não só texto livre
- Geração de texto via IA pra variar o que o avatar fala (equivalente ao
  DeepSeek deles — já temos acesso à API da Claude/Anthropic, não precisa
  de outro provedor)
- Catálogo/múltiplos produtos numa mesma sessão de venda

## Fase 3 — escala e operação

- Múltiplos avatares/hosts por conta
- Agendamento de sessões de live
- Métricas/analytics (visualizações, engajamento, conversão)
- Avaliar integração com plataformas externas de live (Instagram, YouTube,
  TikTok) — só se fizer sentido pro negócio, não é dado como certo

## Ideias descartadas (ou fora de escopo por enquanto)

- SOPs operacionais de live comercial chinesa (checklist anti-banimento,
  troca de turno, "bodyguard") — específico de uma realidade de mercado
  (Taobao/Douyin) que não é a nossa
- Cliente desktop pesado rodando GPU local do usuário — nossa arquitetura é
  GPU na nuvem (AWS), não faz sentido pedir pro usuário ter uma RTX própria
