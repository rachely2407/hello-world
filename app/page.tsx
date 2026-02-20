"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSignedIn(!!data.session);
    };
    init();
  }, []);

  return (
    <AppShell title="Rachel's Project">
      <div
        style={{
          height: "100%",
          minHeight: "calc(100vh - 48px - 48px)",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 86,
              letterSpacing: 10,
              fontWeight: 900,
              color: "rgba(255,255,255,0.92)",
              textShadow: "0 0 18px rgba(255,255,255,0.18)",
              marginBottom: 18,
              lineHeight: 0.95,
            }}
          >
            HELLO WORLD
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              href="/captions"
              style={{
                padding: "12px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Continue to Captions
            </Link>

            {signedIn ? (
              <Link
                href="/rate"
                style={{
                  padding: "12px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.02)",
                  color: "rgba(255,255,255,0.92)",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                Go to Ratings
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  padding: "12px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.02)",
                  color: "rgba(255,255,255,0.92)",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}