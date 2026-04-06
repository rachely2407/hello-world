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
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: "100%",
          padding: 32,
          border: "3px solid #111111",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "14px 14px 0 rgba(17,17,17,0.2)",
          textAlign: "left",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -26,
            right: 28,
            width: 92,
            height: 92,
            borderRadius: "50%",
            background: "#1f5eff",
            border: "3px solid #111111",
          }}
        />
        <h1
          style={{
            fontSize: "clamp(2.4rem, 8vw, 4rem)",
            letterSpacing: 2,
            marginBottom: 16,
            color: "#111111",
            fontWeight: 900,
            lineHeight: 0.9,
            textTransform: "uppercase",
            marginTop: 0,
          }}
        >
          Signed In
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "rgba(17,17,17,0.72)",
            marginBottom: 26,
          }}
        >
          Authentication successful.
        </p>

        <div
          style={{
            height: 18,
            width: "100%",
            border: "3px solid #111111",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background: "linear-gradient(90deg, #d9362b 0 33%, #f2c230 33% 66%, #1f5eff 66% 100%)",
              animation: "progress 5s linear forwards",
            }}
          />
        </div>

        <p
          style={{
            marginTop: 18,
            fontSize: 12,
            letterSpacing: 1.4,
            color: "rgba(17,17,17,0.6)",
            textTransform: "uppercase",
          }}
        >
          Redirecting to home in 5 seconds
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
