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
      <div style={{ minHeight: "calc(100vh - 120px)", display: "grid", placeItems: "center", padding: 24 }}>
        <div
          style={{
            width: 560,
            maxWidth: "100%",
            border: "3px solid #111111",
            background: "var(--surface)",
            padding: 26,
            textAlign: "left",
            position: "relative",
            boxShadow: "12px 12px 0 rgba(17,17,17,0.18)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -22,
              right: 24,
              width: 78,
              height: 78,
              borderRadius: "50%",
              background: "#d9362b",
              border: "3px solid #111111",
            }}
          />
          <div style={{ display: "inline-block", padding: "7px 10px", border: "2px solid #111111", background: "#f2c230", fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>
            Access
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: "clamp(2.2rem, 7vw, 3.6rem)",
              letterSpacing: 2,
              fontWeight: 900,
              marginBottom: 10,
              lineHeight: 0.92,
              textTransform: "uppercase",
              maxWidth: 320,
              color: "var(--foreground)",
            }}
          >
            Login
          </div>

          <div style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: 14, lineHeight: 1.5, maxWidth: 360 }}>
            Sign in to vote on captions and upload new images to the pipeline.
          </div>

          <button
            onClick={signInWithGoogle}
            style={{
              padding: "14px 18px",
              border: "2px solid #111111",
              background: "#1f5eff",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              boxShadow: "6px 6px 0 rgba(17,17,17,0.22)",
            }}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </AppShell>
  );
}
