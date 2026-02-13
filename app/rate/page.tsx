"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CaptionRow = {
  id: string;
  content: string;
};

export default function RatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [captions, setCaptions] = useState<CaptionRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("captions")
        .select("id, content")
        .limit(20);

      if (error) setStatus(`Error loading captions: ${error.message}`);
      setCaptions((data as CaptionRow[]) ?? []);
      setLoading(false);
    };

    init();
  }, [router]);

  const vote = async (captionId: string, voteValue: number) => {
    setStatus("Saving…");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    if (!uid) {
      router.replace("/login");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("caption_votes").insert({
      caption_id: captionId,
      profile_id: uid,
      vote_value: voteValue,
      created_datetime_utc: now,
      modified_datetime_utc: now,
    });

    setStatus(error ? `Vote failed: ${error.message}` : "Vote saved ✅");
  };

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Rate Captions</h1>
      {status && <p>{status}</p>}

      {captions.map((c) => (
        <div key={c.id} style={{ marginBottom: 16 }}>
          <p>{c.content}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} onClick={() => vote(c.id, v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
