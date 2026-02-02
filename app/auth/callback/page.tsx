"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const finishLogin = async () => {
      // If Supabase already has a session, great
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        router.replace("/protected");
        return;
      }

      // Otherwise, exchange the OAuth code in the URL for a session
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace("/protected");
          return;
        }
      }

      // If something went wrong, go back to login
      router.replace("/login");
    };

    finishLogin();
  }, [router]);

  return <p>Signing you in...</p>;
}
