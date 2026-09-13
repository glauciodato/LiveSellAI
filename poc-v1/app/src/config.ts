/**
 * URL base do backend leve (Azure Function). Configurável via variável de
 * ambiente pública do Expo (embutida no bundle em tempo de build — não
 * coloque segredos aqui).
 *
 * Ver poc-v1/app/.env.example e poc-v1/backend/README.md.
 */
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:7071/api';
