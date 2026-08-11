import { useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void | Promise<void>;
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
  iconOnly?: boolean;
}

const GOOGLE_SCRIPT_ID = "google-identity-services";

export default function GoogleSignInButton({
  onCredential,
  text = "continue_with",
  disabled = false,
  iconOnly = false,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [unavailable, setUnavailable] = useState(false);
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) {
      setUnavailable(true);
      return;
    }

    const render = () => {
      if (!window.google || !containerRef.current) return;
      containerRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        callback: (response) => {
          if (response.credential) void callbackRef.current(response.credential);
        },
      });
      window.google.accounts.id.renderButton(
        containerRef.current,
        iconOnly
          ? {
              type: "icon",
              theme: "filled_black",
              size: "medium",
              shape: "circle",
              locale: "en",
            }
          : {
              type: "standard",
              theme: "filled_black",
              size: "large",
              shape: "pill",
              text,
              logo_alignment: "left",
              locale: "en",
              width: Math.max(280, Math.floor(containerRef.current.getBoundingClientRect().width)),
            },
      );
    };

    if (window.google) {
      render();
      return;
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client?hl=en";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    script.addEventListener("error", () => setUnavailable(true), { once: true });
    return () => script?.removeEventListener("load", render);
  }, [clientId, iconOnly, text]);

  if (unavailable) {
    return (
      <button
        type="button"
        disabled
        title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in"
        style={{
          width: "100%",
          minHeight: 44,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.38)",
        }}
      >
        Continue with Google
      </button>
    );
  }

  return (
    <div
      aria-busy={disabled}
      title="Continue with Google"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: iconOnly ? "1px 0" : 0,
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: iconOnly ? 44 : "100%",
          minHeight: iconOnly ? 44 : 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: 999,
          background: iconOnly
            ? "radial-gradient(circle, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.035) 58%, transparent 72%)"
            : "rgba(15, 23, 42, 0.72)",
          border: iconOnly ? "1px solid rgba(96,165,250,0.18)" : "none",
          boxShadow: iconOnly
            ? "0 0 20px rgba(37,99,235,0.12), inset 0 0 14px rgba(96,165,250,0.05)"
            : "inset 0 0 0 1px rgba(96, 165, 250, 0.16)",
        }}
      />
    </div>
  );
}
