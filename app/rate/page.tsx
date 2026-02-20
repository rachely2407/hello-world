"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { supabase } from "@/lib/supabaseClient";

type VoteItem = {
  caption_id: string;
  caption_content: string;
  image_url: string | null;
};

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function RatePage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState<"intro" | "voting">("intro");
  const [status, setStatus] = useState<string | null>(null);

  const [item, setItem] = useState<VoteItem | null>(null);

  // auth gate
  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setAuthed(true);
    };
    init();
  }, [router]);

  const loadNext = async () => {
    setStatus("Loading next…");

    // Try best-case: captions has image_id and FK to images
    // If your FK is set, this works:
    // select("id, content, image:images(url)") requires relationship
    const { data, error } = await supabase
      .from("captions")
      .select("id, content, image_id, images(url)")
      .limit(50);

    if (error) {
      setStatus(`Error loading captions: ${error.message}`);
      setItem(null);
      return;
    }

    const rows = (data as any[]) || [];
    if (rows.length === 0) {
      setStatus("No captions found.");
      setItem(null);
      return;
    }

    const r = pickRandom(rows);

    // Handle both shapes:
    // - images: { url: ... }
    // - images: [{ url: ... }]
    const imgRel = r.images;
    const url =
      (imgRel && typeof imgRel === "object" && "url" in imgRel && imgRel.url) ||
      (Array.isArray(imgRel) && imgRel[0]?.url) ||
      null;

    setItem({
      caption_id: r.id,
      caption_content: r.content,
      image_url: url,
    });

    setStatus(null);
  };

  const startVoting = async () => {
    setMode("voting");
    await loadNext();
  };

  const vote = async (voteValue: number) => {
    if (!item) return;

    setStatus("Saving vote…");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    if (!uid) {
      router.replace("/login");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("caption_votes").insert({
      caption_id: item.caption_id,
      profile_id: uid,
      vote_value: voteValue, // 👍 1, 👎 -1
      created_datetime_utc: now,
      modified_datetime_utc: now,
    });

    if (error) {
      setStatus(`Vote failed: ${error.message}`);
      return;
    }

    setStatus("Vote saved ✅");
    // load next after a tiny delay so user sees confirmation
    setTimeout(() => {
      loadNext();
    }, 350);
  };

  if (!authed) return null;

  return (
    <AppShell title="Rachel's Project">
      <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        {mode === "intro" ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 80,
                letterSpacing: 10,
                fontWeight: 900,
                textShadow: "0 0 18px rgba(255,255,255,0.16)",
                lineHeight: 0.95,
              }}
            >
              ARE YOU READY TO
              <br />
              VOTE?
            </div>

            <button
              onClick={startVoting}
              style={{
                marginTop: 20,
                padding: "12px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Start Voting
            </button>

            {status && (
              <div style={{ marginTop: 14, color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
                {status}
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 860, display: "grid", placeItems: "center" }}>
            <div
              style={{
                width: "100%",
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
                padding: 22,
                display: "grid",
                gridTemplateColumns: "84px 1fr 84px",
                alignItems: "center",
                gap: 18,
              }}
            >
              {/* 👎 */}
              <div style={{ display: "grid", placeItems: "center" }}>
                <button
                  onClick={() => vote(-1)}
                  disabled={!item}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.92)",
                    cursor: item ? "pointer" : "not-allowed",
                    fontSize: 22,
                  }}
                  title="Downvote"
                >
                  👎
                </button>
              </div>

              {/* Card */}
              <div
                style={{
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.45)",
                  padding: 18,
                  textAlign: "center",
                }}
              >
                {item?.image_url ? (
                  <img
                    src={item.image_url}
                    alt="caption image"
                    style={{
                      width: "100%",
                      maxHeight: 380,
                      objectFit: "contain",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.02)",
                      display: "block",
                      margin: "0 auto 14px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 280,
                      borderRadius: 14,
                      border: "1px dashed rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.02)",
                      display: "grid",
                      placeItems: "center",
                      color: "rgba(255,255,255,0.6)",
                      marginBottom: 14,
                      padding: 12,
                    }}
                  >
                    (No image found for this caption — check captions.image_id FK to images)
                  </div>
                )}

                <div
                  style={{
                    fontSize: 18,
                    color: "rgba(255,255,255,0.92)",
                    letterSpacing: 1.2,
                    lineHeight: 1.35,
                    textShadow: "0 0 10px rgba(255,255,255,0.10)",
                  }}
                >
                  {item?.caption_content ?? "Loading…"}
                </div>

                {status && (
                  <div style={{ marginTop: 12, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                    {status}
                  </div>
                )}
              </div>

              {/* 👍 */}
              <div style={{ display: "grid", placeItems: "center" }}>
                <button
                  onClick={() => vote(1)}
                  disabled={!item}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.92)",
                    cursor: item ? "pointer" : "not-allowed",
                    fontSize: 22,
                  }}
                  title="Upvote"
                >
                  👍
                </button>
              </div>
            </div>

            <button
              onClick={loadNext}
              style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.02)",
                color: "rgba(255,255,255,0.85)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Skip →
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}