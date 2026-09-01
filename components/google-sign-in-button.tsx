'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce: string;
        ux_mode: 'popup';
        auto_select: boolean;
        cancel_on_tap_outside: boolean;
        callback(response: { credential?: string }): void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: 'standard';
          theme: 'outline';
          size: 'large';
          text: 'continue_with';
          shape: 'pill';
          logo_alignment: 'left';
          width: string;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function GoogleSignInButton({
  clientId,
  loginUri,
  returnTo = '/hesap',
}: {
  clientId: string;
  loginUri: string;
  returnTo?: '/hesap' | '/olustur';
}) {
  const buttonRoot = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'submitting' | 'error'
  >('loading');

  useEffect(() => {
    let active = true;

    async function loadGoogleIdentity() {
      if (window.google) return;
      await new Promise<void>((resolve, reject) => {
        const selector = 'script[data-davetly-google-identity]';
        let script = document.querySelector<HTMLScriptElement>(selector);
        if (!script) {
          script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.dataset.davetlyGoogleIdentity = 'true';
          document.head.appendChild(script);
        }
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener(
          'error',
          () => reject(new Error('google_script_failed')),
          { once: true },
        );
      });
    }

    function submitCredential(
      credential: string,
      state: string,
      csrfToken: string,
    ) {
      if (!active || !credential || submitting.current) return;
      submitting.current = true;
      setStatus('submitting');
      const form = document.createElement('form');
      form.method = 'post';
      form.action = loginUri;
      form.style.display = 'none';
      for (const [name, value] of Object.entries({
        credential,
        state,
        g_csrf_token: csrfToken,
        returnTo,
      })) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    }

    async function initialize() {
      try {
        const [prepareResponse] = await Promise.all([
          fetch('/api/auth/google/prepare', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ returnTo }),
          }),
          loadGoogleIdentity(),
        ]);
        const prepared = (await prepareResponse.json()) as {
          state?: string;
          nonce?: string;
          csrfToken?: string;
        };
        if (
          !prepareResponse.ok ||
          !prepared.state ||
          !prepared.nonce ||
          !prepared.csrfToken
        ) {
          throw new Error('google_prepare_failed');
        }
        if (!active || !buttonRoot.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: prepared.nonce,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: ({ credential }) => {
            if (!credential) {
              setStatus('error');
              return;
            }
            submitCredential(credential, prepared.state!, prepared.csrfToken!);
          },
        });
        buttonRoot.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRoot.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: String(
            Math.min(400, Math.max(200, buttonRoot.current.clientWidth)),
          ),
        });
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [clientId, loginUri, returnTo]);

  return (
    <div
      className="relative min-h-11 w-full"
      aria-busy={status === 'loading' || status === 'submitting'}
    >
      <div
        ref={buttonRoot}
        className="flex min-h-11 w-full justify-center overflow-hidden rounded-full"
      />
      {status === 'loading' && (
        <output
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-full border border-[#dfd6d1] bg-white text-sm font-medium text-[#655b57]"
        >
          <LoaderCircle className="size-4 animate-spin" /> Google hazırlanıyor
        </output>
      )}
      {status === 'submitting' && (
        <output
          aria-live="polite"
          className="absolute inset-0 z-10 flex cursor-wait items-center justify-center gap-2 rounded-full border border-[#dfd6d1] bg-white text-sm font-medium text-[#655b57]"
        >
          <LoaderCircle className="size-4 animate-spin" /> Giriş tamamlanıyor
        </output>
      )}
      {status === 'error' && (
        <p
          role="alert"
          className="rounded-2xl bg-[#f9e9e8] px-4 py-3 text-center text-xs font-medium leading-5 text-[#963f4c]"
        >
          Google giriş düğmesi yüklenemedi. İnternet bağlantınızı kontrol edip
          sayfayı yenileyin.
        </p>
      )}
    </div>
  );
}
