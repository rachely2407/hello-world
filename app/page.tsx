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

  const actionStyle = {
    padding: "14px 18px",
    border: "2px solid #111111",
    background: "var(--surface)",
    color: "var(--foreground)",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    boxShadow: "6px 6px 0 rgba(17,17,17,0.2)",
  };

  return (
    <AppShell title="Rachel's Project">
      <div
        style={{
          minHeight: "calc(100vh - 104px)",
          display: "grid",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            maxWidth: 980,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) 280px",
            gap: 28,
            alignItems: "start",
          }}
        >
          <div style={{ position: "relative", paddingTop: 18 }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 220,
                height: 18,
                background: "#d9362b",
                border: "3px solid #111111",
              }}
            />
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                border: "2px solid #111111",
                background: "#f2c230",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Bauhaus Humor Lab
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: "clamp(3.6rem, 10vw, 7rem)",
                letterSpacing: 3,
                fontWeight: 900,
                color: "var(--foreground)",
                marginBottom: 18,
                lineHeight: 0.88,
                textTransform: "uppercase",
                maxWidth: 620,
              }}
            >
              Meme
              <br />
              The
              <br />
              World
            </div>

            <div
              style={{
                maxWidth: 540,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--text-muted)",
                marginBottom: 24,
              }}
            >
              Caption images, rate the strongest jokes, and move media through the pipeline inside a sharper editorial interface.
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/captions" style={{ ...actionStyle, background: "#1f5eff", color: "#ffffff" }}>
                Continue to Captions
              </Link>

              {signedIn ? (
                <Link href="/rate" style={{ ...actionStyle, background: "var(--surface)" }}>
                  Go to Ratings
                </Link>
              ) : (
                <Link href="/login" style={{ ...actionStyle, background: "var(--surface)" }}>
                  Sign in
                </Link>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              alignSelf: "stretch",
            }}
          >
            <div
              style={{
                minHeight: 220,
                border: "3px solid #111111",
                background: "var(--surface)",
                padding: 18,
                boxShadow: "10px 10px 0 rgba(17,17,17,0.18)",
                position: "relative",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 18,
                  right: 18,
                  width: 66,
                  height: 66,
                  borderRadius: "50%",
                  background: "#d9362b",
                  border: "3px solid #111111",
                }}
              />
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Program
              </div>
              <div style={{ marginTop: 18, fontSize: 18, fontWeight: 900, lineHeight: 1.15, textTransform: "uppercase", maxWidth: 140, color: "var(--foreground)" }}>
                Upload. Caption. Vote.
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
