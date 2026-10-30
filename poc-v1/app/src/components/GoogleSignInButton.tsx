import { useEffect, useRef } from 'react';
import { Platform, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { GOOGLE_CLIENT_ID } from '../config';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptLoadingPromise: Promise<void> | null = null;

/** Carrega o script do Google Identity Services uma única vez (cacheado entre montagens). */
function loadGsiScript(): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google.'));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Botão "Continuar com Google" — só funciona na Web (Google Identity
 * Services é uma biblioteca JS de navegador). Em iOS/Android nativo não
 * renderiza nada; login nativo exigiria uma biblioteca e client IDs à
 * parte (fora do escopo atual, que roda só na Web).
 */
export default function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const containerRef = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const buttonWidth = Math.round(Math.max(200, Math.min(344, windowWidth - 104)));

  useEffect(() => {
    if (Platform.OS !== 'web' || !GOOGLE_CLIENT_ID) {
      return;
    }

    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        const node = findNodeHandle(containerRef.current) as unknown as HTMLElement | null;
        if (!node || !window.google) return;

        node.innerHTML = '';

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });

        window.google.accounts.id.renderButton(node, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: buttonWidth,
          text: 'continue_with',
          locale: 'pt-BR',
        });
      })
      .catch((err) => {
        console.warn('Não foi possível carregar o login com Google:', err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buttonWidth, onCredential]);

  if (Platform.OS !== 'web' || !GOOGLE_CLIENT_ID) {
    return null;
  }

  return <View ref={containerRef} style={{ width: '100%', alignItems: 'center' }} />;
}
