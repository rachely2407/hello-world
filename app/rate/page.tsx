"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { supabase } from "@/lib/supabaseClient";

type VoteItem = {
  caption_id: string;
  caption_content: string;
  image_id: string | null;
  image_url: string | null;
};

type CaptionRow = {
  id: string;
  content: string;
  image_id: string | null;
};

type ImageRow = {
  id: string;
  url: string | null;
  is_public: boolean | null;
};

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isDuplicateVoteError(err: any) {
  return (
    err?.code === "23505" ||
    String(err?.message || "").toLowerCase().includes("duplicate")
  );
}

export default function RatePage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState<"intro" | "voting">("intro");
  const [status, setStatus] = useState<string | null>(null);
  const [item, setItem] = useState<VoteItem | null>(null);

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
    setItem(null);

    const { data: capData, error: capErr } = await supabase
      .from("captions")
      .select("id, content, image_id")
      .limit(80);

    if (capErr) {
      console.log("❌ captions select error:", capErr);
      setStatus(`Error loading captions: ${capErr.message}`);
      return;
    }

    const captions: CaptionRow[] = (capData as any[]) || [];
    if (captions.length === 0) {
      setStatus("No captions found.");
      return;
    }

    const withImageId = captions.filter((c) => !!c.image_id);
    if (withImageId.length === 0) {
      setStatus("Captions exist, but none have image_id.");
      console.log("⚠️ captions found, but image_id is null for all.");
      return;
    }

    const imageIds = Array.from(
      new Set(withImageId.map((c) => c.image_id!).filter(Boolean))
    );

    const { data: imgData, error: imgErr } = await supabase
      .from("images")
      .select("id, url, is_public")
      .in("id", imageIds);

    if (imgErr) {
      console.log("❌ images select error:", imgErr);
      setStatus(`Error loading images: ${imgErr.message}`);
      return;
    }

    const images: ImageRow[] = (imgData as any[]) || [];
    const byId = new Map<string, ImageRow>();
    for (const img of images) byId.set(img.id, img);

    const candidates: VoteItem[] = withImageId.map((c) => {
      const img = c.image_id ? byId.get(c.image_id) : undefined;
      const url = img?.url ?? null;

      return {
        caption_id: c.id,
        caption_content: c.content,
        image_id: c.image_id ?? null,
        image_url: url,
      };
    });

    const usable = candidates.filter((x) => !!x.image_url);

    if (usable.length === 0) {
      setStatus("No images with a usable url found. Check images.url values.");
      console.log("⚠️ No usable image_url resolved.", {
        captions_count: captions.length,
        withImageId_count: withImageId.length,
        images_returned: images.length,
        sample_image: images[0],
      });
      return;
    }

    const chosen = pickRandom(usable);

    console.log("🎯 picked:", {
      caption_id: chosen.caption_id,
      image_id: chosen.image_id,
      image_url: chosen.image_url,
    });

    setItem(chosen);
    setStatus(null);
  };

  const startVoting = async () => {
    setMode("voting");
    await loadNext();
  };

  const vote = async (voteValue: 1 | -1) => {
    if (!item) return;

    setStatus("Saving vote…");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    if (!uid) {
      router.replace("/login");
      return;
    }

    const { error: insertErr } = await supabase.from("caption_votes").insert({
      caption_id: item.caption_id,
      profile_id: uid,
      vote_value: voteValue,
      created_by_user_id: uid,
      modified_by_user_id: uid,
    });

    if (insertErr) {
      if (isDuplicateVoteError(insertErr)) {
        const { error: updateErr } = await supabase
          .from("caption_votes")
          .update({
            vote_value: voteValue,
            modified_by_user_id: uid,
          })
          .eq("caption_id", item.caption_id)
          .eq("profile_id", uid);

        if (updateErr) {
          setStatus(`Vote update failed: ${updateErr.message}`);
          return;
        }
        setStatus("Vote updated ✅");
      } else {
        setStatus(`Vote failed: ${insertErr.message}`);
        return;
      }
    } else {
      setStatus("Vote saved ✅");
    }

    setTimeout(() => {
      loadNext();
    }, 350);
  };

  if (!authed) return null;

  return (
    <AppShell title="Rachel's Project">
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
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
              <div
                style={{
                  marginTop: 14,
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 13,
                }}
              >
                {status}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: 860,
              display: "grid",
              placeItems: "center",
            }}
          >
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
                    (No image found — open DevTools Console and check logs)
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
                  <div
                    style={{
                      marginTop: 12,
                      color: "rgba(255,255,255,0.65)",
                      fontSize: 12,
                    }}
                  >
                    {status}
                  </div>
                )}
              </div>

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