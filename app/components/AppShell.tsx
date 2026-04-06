"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  title?: string;
  children: React.ReactNode;
};

const palette = {
  red: "#d9362b",
  blue: "#1f5eff",
  yellow: "#f2c230",
  black: "#111111",
  paper: "var(--paper)",
  paperStrong: "var(--paper-strong)",
  line: "var(--line)",
  textMuted: "var(--ink-muted)",
  foreground: "var(--foreground)",
};

export default function AppShell({ title = "Rachel's Project", children }: Props) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSignedIn(!!data.session);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      setTheme(storedTheme);
      if (storedTheme === "system") {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = storedTheme;
      }
      return;
    }

    setTheme("system");
    delete document.documentElement.dataset.theme;
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const applyTheme = (nextTheme: "light" | "dark" | "system") => {
    setTheme(nextTheme);
    if (nextTheme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = nextTheme;
    }
    window.localStorage.setItem("theme", nextTheme);
  };

  const NavItem = ({ href, label, kbd }: { href: string; label: string; kbd: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderRadius: 0,
          border: `2px solid ${palette.black}`,
          background: active ? palette.yellow : palette.paper,
          color: palette.foreground,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          boxShadow: active ? "8px 8px 0 rgba(17,17,17,0.95)" : "4px 4px 0 rgba(17,17,17,0.22)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: active ? "50%" : 0,
              background: active ? palette.red : palette.blue,
              border: `2px solid ${palette.black}`,
              flexShrink: 0,
            }}
          />
          {label}
        </span>

        <span
          style={{
            fontSize: 11,
            padding: "4px 7px",
            border: `2px solid ${palette.black}`,
            background: "var(--surface)",
            color: palette.foreground,
            letterSpacing: 1.2,
          }}
        >
          {kbd}
        </span>
      </Link>
    );
  };

  const actionStyle = {
    padding: "10px 12px",
    borderRadius: 0,
    border: `2px solid ${palette.black}`,
    background: "var(--surface)",
    color: palette.foreground,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    textDecoration: "none",
    boxShadow: "4px 4px 0 rgba(17,17,17,0.22)",
  };

  return (
    <div style={{ minHeight: "100vh", color: palette.foreground }}>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, transparent 0 12%, rgba(17,17,17,0.03) 12% 13%, transparent 13% 100%), linear-gradient(0deg, transparent 0 76%, rgba(17,17,17,0.035) 76% 77%, transparent 77% 100%)",
        }}
      />
      <div
        className="app-shell-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
          gap: 24,
          padding: 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        <aside
          style={{
            border: `3px solid ${palette.black}`,
            background: palette.paper,
            padding: 18,
            height: "calc(100vh - 48px)",
            position: "sticky",
            top: 24,
            overflow: "hidden",
            boxShadow: "12px 12px 0 rgba(17,17,17,0.92)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -36,
              right: -20,
              width: 118,
              height: 118,
              borderRadius: "50%",
              background: palette.red,
              border: `3px solid ${palette.black}`,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 86,
              left: -26,
              width: 80,
              height: 80,
              background: palette.blue,
              border: `3px solid ${palette.black}`,
              transform: "rotate(18deg)",
            }}
          />

          <div
            style={{
              position: "relative",
              border: `3px solid ${palette.black}`,
              background: "var(--surface)",
              padding: 16,
              marginBottom: 16,
              boxShadow: "8px 8px 0 rgba(17,17,17,0.18)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 900,
                color: palette.textMuted,
              }}
            >
              Studio
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 28,
                lineHeight: 0.95,
                fontWeight: 900,
                maxWidth: 180,
                textTransform: "uppercase",
                color: palette.foreground,
              }}
            >
              {title}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Next.js", "Supabase", "Vercel"].map((t, index) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: "5px 8px",
                    border: `2px solid ${palette.black}`,
                    background: [palette.yellow, "var(--surface)", palette.blue][index],
                    color: index === 2 ? "#ffffff" : palette.foreground,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, position: "relative" }}>
            <NavItem href="/" label="Home" kbd="H" />
            <NavItem href="/captions" label="Captions" kbd="C" />
            <NavItem href="/rate" label="Ratings" kbd="R" />
            <NavItem href="/pipeline" label="Upload" kbd="U" />
          </div>

          <div
            style={{
              marginTop: 18,
              border: `3px solid ${palette.black}`,
              background: palette.paperStrong,
              padding: 14,
              position: "relative",
            }}
          >
            <div style={{ fontSize: 12, color: palette.textMuted, textTransform: "uppercase", letterSpacing: 1.6 }}>
              Session
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: signedIn ? palette.blue : palette.red,
                    border: `2px solid ${palette.black}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: palette.foreground, fontWeight: 800, textTransform: "uppercase" }}>
                  {signedIn ? "Signed In" : "Signed Out"}
                </span>
              </div>

              {signedIn ? (
                <button onClick={signOut} style={actionStyle}>
                  Sign out
                </button>
              ) : (
                <Link href="/login" style={actionStyle}>
                  Sign in
                </Link>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {(["dark", "light", "system"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => applyTheme(option)}
                    style={{
                      ...actionStyle,
                      width: "100%",
                      padding: "9px 8px",
                      background: theme === option ? palette.yellow : "var(--surface)",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: palette.foreground,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            <span>Spring 2026</span>
            <span>v1</span>
          </div>
        </aside>

        <main
          style={{
            border: `3px solid ${palette.black}`,
            background: palette.paperStrong,
            minHeight: "calc(100vh - 48px)",
            padding: 28,
            position: "relative",
            overflow: "hidden",
            boxShadow: "14px 14px 0 rgba(17,17,17,0.92)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 180,
              height: 18,
              background: palette.red,
              borderLeft: `3px solid ${palette.black}`,
              borderBottom: `3px solid ${palette.black}`,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 26,
              bottom: 18,
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: palette.yellow,
              border: `3px solid ${palette.black}`,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 28,
              padding: "8px 12px",
              border: `2px solid ${palette.black}`,
              background: "var(--surface)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Humor Project
          </div>

          {children}
        </main>
      </div>

      <style jsx global>{`
        @media (max-width: 960px) {
          .app-shell-grid {
            grid-template-columns: 1fr !important;
          }

          .app-shell-grid aside {
            height: auto !important;
            position: relative !important;
            top: 0 !important;
          }

          .app-shell-grid main {
            min-height: auto !important;
          }
        }

        @media (max-width: 640px) {
          .app-shell-grid {
            padding: 14px !important;
            gap: 14px !important;
          }

          .app-shell-grid main,
          .app-shell-grid aside {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
