"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;

      if (!data.session) {
        router.replace("/login");
        return;
      }
      setLoading(false);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      ignore = true;
      sub.subscription.unsubscribe();
    };
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

      <button onClick={handleSignOut} style={{ marginTop: 16 }}>
        Sign out
      </button>
    </div>
  );
}
