"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setTimeout(() => {
        router.replace("/");
      }, 5000);
    };

    checkAuth();
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "70vh",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 520,
          padding: 40,
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.12)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)), radial-gradient(800px 400px at 20% 20%, rgba(59,130,246,0.18), rgba(0,0,0,0) 60%), radial-gradient(800px 400px at 80% 40%, rgba(239,68,68,0.16), rgba(0,0,0,0) 60%)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: 42,
            letterSpacing: 2,
            marginBottom: 20,
            background:
              "linear-gradient(90deg, #3b82f6, #ef4444)",
            WebkitBackgroundClip: "text",
            color: "transparent",
            fontWeight: 800,
          }}
        >
          Signed In
        </h1>

        <p
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.75)",
            marginBottom: 30,
          }}
        >
          Authentication successful 🎉
        </p>

        <div
          style={{
            height: 6,
            width: "100%",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background:
                "linear-gradient(90deg, #3b82f6, #ef4444)",
              animation: "progress 5s linear forwards",
            }}
          />
        </div>

        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            letterSpacing: 1,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Redirecting to home in 5 seconds...
        </p>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}