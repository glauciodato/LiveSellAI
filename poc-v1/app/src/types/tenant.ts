/**
 * Nesta POC, o "tenant" (conta) é identificado apenas pelo e-mail informado
 * na tela inicial. Não há senha nem cadastro completo — é um mock local
 * para simular a estrutura multi-tenant do produto final.
 */
export interface Tenant {
  email: string;
}
