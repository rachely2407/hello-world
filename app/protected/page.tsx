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

      // Redirect to homepage after 5 seconds
      setTimeout(() => {
        router.replace("/");
      }, 5000);
    };

    checkAuth();
  }, [router]);

  return (
    <main style={{ padding: 40 }}>
      <h1>You're signed in 🎉</h1>
      <p>Redirecting to homepage in 5 seconds...</p>
    </main>
  );
}
