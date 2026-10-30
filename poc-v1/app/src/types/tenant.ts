/**
 * Um tenant/conta cadastrada de verdade no backend (Postgres), com nome,
 * e-mail e senha (com hash) — substitui o mock antigo que só guardava o
 * e-mail informado, sem nenhuma validação.
 */
export interface Tenant {
  id: number;
  name: string;
  email: string;
  /** false pra contas criadas via Google que ainda não definiram uma senha. */
  hasPassword: boolean;
  /** Foto de perfil do Google, se a conta tiver entrado por lá; null caso contrário. */
  avatarUrl: string | null;
}
