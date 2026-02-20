"use client";

import AppShell from "@/app/components/AppShell";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  return (
    <AppShell title="Rachel's Project">
      <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <div
          style={{
            width: 520,
            maxWidth: "100%",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            padding: 22,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 44,
              letterSpacing: 6,
              fontWeight: 900,
              marginBottom: 10,
              textShadow: "0 0 14px rgba(255,255,255,0.12)",
            }}
          >
            LOGIN
          </div>

          <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16, fontSize: 13 }}>
            Sign in to vote and upload images.
          </div>

          <button
            onClick={signInWithGoogle}
            style={{
              padding: "12px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </AppShell>
  );
}