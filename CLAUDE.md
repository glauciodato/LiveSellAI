# Instruções do Projeto

## Fluxo de trabalho obrigatório

Antes de implementar qualquer funcionalidade, correção de bug ou mudança de código
solicitada pelo usuário, siga sempre esta ordem:

1. **Registre a história de usuário no `BACKLOG.md`**, em português, usando este formato:

   ```
   ## [PENDENTE] Título curto da funcionalidade

   **Como** tipo de usuário
   **Eu quero** ação desejada
   **Para que** benefício/motivo

   **Critérios de aceitação:**
   - [ ] Critério 1
   - [ ] Critério 2

   **Data:** DD/MM/AAAA
   ```

   Adicione a nova entrada no topo do arquivo (logo abaixo do cabeçalho `# Backlog`).

2. **Só depois de registrar a história**, comece a implementação do código.

3. **Ao concluir a tarefa**, volte no `BACKLOG.md` e mude `[PENDENTE]` para `[CONCLUÍDO]`
   na história correspondente.

4. Ao final, sugira um commit com uma mensagem descritiva que referencie a história
   (ex: `feat: adiciona login de usuário (ref: história "Login de usuário")`).

## Convenções do projeto

<!-- Adicione aqui: estilo de código, como rodar testes, comandos de build, etc. -->
