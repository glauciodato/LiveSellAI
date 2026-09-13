/**
 * Um tenant/conta cadastrada de verdade no backend (Postgres), com nome,
 * e-mail e senha (com hash) — substitui o mock antigo que só guardava o
 * e-mail informado, sem nenhuma validação.
 */
export interface Tenant {
  id: number;
  name: string;
  email: string;
}
