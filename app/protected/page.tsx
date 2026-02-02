"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ProtectedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
      } else {
        setLoading(false);
      }
    };

    checkSession();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return <p>Checking authentication…</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>Protected Content</h1>
      <p>You are signed in 🎉</p>

      <button onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
}
