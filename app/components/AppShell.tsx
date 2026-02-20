"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  title?: string;
  children: React.ReactNode;
};

export default function AppShell({ title = "Rachel's Project", children }: Props) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

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

  const signOut = async () => {
    await supabase.auth.signOut();
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
          padding: "12px 12px",
          borderRadius: 16,
          border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.10)",
          background: active
            ? "linear-gradient(135deg, rgba(59,130,246,0.20), rgba(239,68,68,0.18))"
            : "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.92)",
          textDecoration: "none",
          fontSize: 14,
          boxShadow: active ? "0 18px 50px rgba(0,0,0,0.35)" : "none",
          transition: "transform 140ms ease, background 140ms ease, border-color 140ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0px)";
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
              boxShadow: active ? "0 0 16px rgba(255,255,255,0.25)" : "none",
            }}
          />
          {label}
        </span>

        <span
          style={{
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.25)",
            color: "rgba(255,255,255,0.75)",
            letterSpacing: 0.6,
          }}
        >
          {kbd}
        </span>
      </Link>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1100px 600px at 18% 10%, rgba(59,130,246,0.35), rgba(0,0,0,0) 60%), radial-gradient(900px 520px at 82% 16%, rgba(239,68,68,0.30), rgba(0,0,0,0) 62%), radial-gradient(700px 520px at 65% 85%, rgba(99,102,241,0.18), rgba(0,0,0,0) 60%), linear-gradient(180deg, #070816, #04040a 55%, #020207)",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Ambient “grid + noise” overlay */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(600px 600px at 55% 20%, rgba(0,0,0,1), rgba(0,0,0,0) 70%)",
          opacity: 0.35,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E\")",
          opacity: 0.08,
          mixBlendMode: "overlay",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 22,
          padding: 22,
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            borderRadius: 26,
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            boxShadow:
              "0 18px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05) inset",
            padding: 18,
            height: "calc(100vh - 44px)",
            position: "sticky",
            top: 22,
            overflow: "hidden",
          }}
        >
          {/* “ticket stub” header */}
          <div
            style={{
              borderRadius: 20,
              padding: 14,
              border: "1px dashed rgba(255,255,255,0.18)",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(239,68,68,0.16))",
              position: "relative",
              marginBottom: 14,
            }}
          >
            {/* punch holes */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: -10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                borderRadius: 999,
                background: "rgba(0,0,0,0.75)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: -10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                borderRadius: 999,
                background: "rgba(0,0,0,0.75)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />

            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 800,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {title}
            </div>

            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Next.js", "Supabase", "Vercel"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.22)",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <NavItem href="/" label="Home" kbd="H" />
            <NavItem href="/captions" label="Captions" kbd="C" />
            <NavItem href="/rate" label="Ratings" kbd="R" />
            <NavItem href="/pipeline" label="Upload" kbd="U" />
          </div>

          <div style={{ height: 16 }} />

          {/* “status strip” */}
          <div
            style={{
              marginTop: 12,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.28)",
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Session</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: signedIn ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                    boxShadow: signedIn ? "0 0 16px rgba(34,197,94,0.25)" : "0 0 16px rgba(239,68,68,0.25)",
                  }}
                />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
                  {signedIn ? "Signed in" : "Signed out"}
                </span>
              </div>

              {signedIn ? (
                <button
                  onClick={signOut}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.92)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.92)",
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* bottom “badge” */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "rgba(255,255,255,0.55)",
              fontSize: 12,
              padding: "0 6px",
            }}
          >
            <span style={{ letterSpacing: 1.2 }}>SPRING 2026</span>
            <span style={{ letterSpacing: 1.2 }}>v1</span>
          </div>
        </aside>

        {/* Main */}
        <main
          style={{
            borderRadius: 26,
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)), radial-gradient(950px 520px at 20% 20%, rgba(59,130,246,0.18), rgba(0,0,0,0) 62%), radial-gradient(950px 520px at 75% 30%, rgba(239,68,68,0.14), rgba(0,0,0,0) 64%)",
            minHeight: "calc(100vh - 44px)",
            padding: 28,
            boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* floating “ribbon” top-right */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 18,
              right: -70,
              transform: "rotate(18deg)",
              padding: "10px 90px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(59,130,246,0.16))",
              color: "rgba(255,255,255,0.70)",
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
            }}
          >
            HUMOR PROJECT
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}