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
  content: string | null;
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

const panelStyle = {
  border: "3px solid #111111",
  background: "var(--surface)",
  boxShadow: "10px 10px 0 rgba(17,17,17,0.16)",
};

const controlButtonStyle = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  border: "3px solid #111111",
  color: "#111111",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  boxShadow: "6px 6px 0 rgba(17,17,17,0.16)",
};

export default function RatePage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState<"intro" | "voting">("intro");
  const [status, setStatus] = useState<string | null>(null);
  const [item, setItem] = useState<VoteItem | null>(null);
  const [currentVote, setCurrentVote] = useState<1 | -1 | null>(null);
  const [lastVotedItem, setLastVotedItem] = useState<VoteItem | null>(null);

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
    setCurrentVote(null);

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

    const readyCaptions = captions.filter(
      (c) => !!c.image_id && typeof c.content === "string" && c.content.trim().length > 0
    );

    if (readyCaptions.length === 0) {
      setStatus("No ready captions found with both image_id and content.");
      console.log("⚠️ captions found, but image_id is null for all.");
      return;
    }

    const imageIds = Array.from(
      new Set(readyCaptions.map((c) => c.image_id!).filter(Boolean))
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

    const candidates: VoteItem[] = readyCaptions.map((c) => {
      const img = c.image_id ? byId.get(c.image_id) : undefined;
      const url = img?.url ?? null;

      return {
        caption_id: c.id,
        caption_content: c.content ?? "",
        image_id: c.image_id ?? null,
        image_url: url,
      };
    });

    const usable = candidates.filter((x) => !!x.image_url);

    if (usable.length === 0) {
      setStatus("No images with a usable url found. Check images.url values.");
      console.log("⚠️ No usable image_url resolved.", {
        captions_count: captions.length,
        ready_captions_count: readyCaptions.length,
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

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    if (uid) {
      const { data: existingVote } = await supabase
        .from("caption_votes")
        .select("vote_value")
        .eq("caption_id", chosen.caption_id)
        .eq("profile_id", uid)
        .maybeSingle();

      const storedVote = existingVote?.vote_value;
      setCurrentVote(storedVote === 1 || storedVote === -1 ? storedVote : null);
    }

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

    const { data: existingVote, error: existingVoteErr } = await supabase
      .from("caption_votes")
      .select("vote_value")
      .eq("caption_id", item.caption_id)
      .eq("profile_id", uid)
      .maybeSingle();

    if (existingVoteErr) {
      setStatus(`Vote lookup failed: ${existingVoteErr.message}`);
      return;
    }

    if (existingVote?.vote_value === voteValue) {
      const { error: deleteErr } = await supabase
        .from("caption_votes")
        .delete()
        .eq("caption_id", item.caption_id)
        .eq("profile_id", uid);

      if (deleteErr) {
        setStatus(`Vote removal failed: ${deleteErr.message}`);
        return;
      }

      setStatus("Vote removed ✅");
      setCurrentVote(null);
    } else if (existingVote) {
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
      setCurrentVote(voteValue);
      setLastVotedItem(item);
      await loadNext();
    } else {
      const { error: insertErr } = await supabase.from("caption_votes").insert({
        caption_id: item.caption_id,
        profile_id: uid,
        vote_value: voteValue,
        created_by_user_id: uid,
        modified_by_user_id: uid,
      });

      if (insertErr) {
        setStatus(`Vote failed: ${insertErr.message}`);
        return;
      }

      setStatus("Vote saved ✅");
      setCurrentVote(voteValue);
      setLastVotedItem(item);
      await loadNext();
    }
  };

  const undoVote = async () => {
    const targetItem = item && currentVote !== null ? item : lastVotedItem;
    if (!targetItem) return;

    setStatus("Removing vote…");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    if (!uid) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("caption_votes")
      .delete()
      .eq("caption_id", targetItem.caption_id)
      .eq("profile_id", uid);

    if (error) {
      setStatus(`Vote removal failed: ${error.message}`);
      return;
    }

    setCurrentVote(null);
    setStatus("Vote removed ✅");
    setItem(targetItem);
    setLastVotedItem(null);
  };

  if (!authed) return null;

  return (
    <AppShell title="Rachel's Project">
      <div
        style={{
          minHeight: "calc(100vh - 120px)",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        {mode === "intro" ? (
          <div style={{ textAlign: "left", maxWidth: 760, width: "100%" }}>
            <div style={{ display: "inline-block", padding: "7px 10px", border: "2px solid #111111", background: "#d9362b", color: "#ffffff", fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>
              Rating Deck
            </div>
            <div
                style={{
                  fontSize: "clamp(3rem, 10vw, 6rem)",
                  letterSpacing: 2,
                  fontWeight: 900,
                  lineHeight: 0.88,
                  textTransform: "uppercase",
                  marginTop: 18,
                  color: "var(--foreground)",
                }}
            >
              Are You Ready To
              <br />
              Vote?
            </div>

            <button
              onClick={startVoting}
              style={{
                marginTop: 20,
                padding: "14px 18px",
                border: "2px solid #111111",
                background: "#1f5eff",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
                boxShadow: "6px 6px 0 rgba(17,17,17,0.2)",
              }}
            >
              Start Voting
            </button>

            {status && (
              <div
                style={{
                  marginTop: 14,
                  color: "var(--text-muted)",
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
            {lastVotedItem && item?.caption_id !== lastVotedItem.caption_id && (
              <div
                style={{
                  width: "100%",
                  marginBottom: 14,
                  ...panelStyle,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Last vote saved. Undo to return to the previous caption.
                </div>
                <button
                  onClick={undoVote}
                  style={{
                    padding: "10px 14px",
                    border: "2px solid #111111",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    boxShadow: "4px 4px 0 rgba(17,17,17,0.16)",
                  }}
                >
                  Undo Last Vote
                </button>
              </div>
            )}

            <div
              style={{
                width: "100%",
                ...panelStyle,
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
                    ...controlButtonStyle,
                    background: "#d9362b",
                    color: "#ffffff",
                    cursor: item ? "pointer" : "not-allowed",
                    opacity: item ? 1 : 0.55,
                  }}
                  title="Downvote"
                >
                  👎
                </button>
              </div>

              <div
                style={{
                  border: "3px solid #111111",
                  background: "var(--surface)",
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
                      border: "2px solid #111111",
                      background: "var(--surface-soft)",
                      display: "block",
                      margin: "0 auto 14px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 280,
                      border: "2px dashed #111111",
                      background: "var(--surface-soft)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--text-muted)",
                      marginBottom: 14,
                      padding: 12,
                      textTransform: "uppercase",
                      fontSize: 12,
                      letterSpacing: 1,
                    }}
                  >
                    (No image found — open DevTools Console and check logs)
                  </div>
                )}

                <div
                  style={{
                    fontSize: 21,
                    color: "var(--foreground)",
                    letterSpacing: 0.4,
                    lineHeight: 1.35,
                    fontWeight: 700,
                  }}
                >
                  {item?.caption_content ?? "Loading…"}
                </div>

                {status && (
                  <div
                    style={{
                      marginTop: 12,
                      color: "var(--text-muted)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {status}
                  </div>
                )}

                {currentVote !== null && (
                  <div style={{ marginTop: 12, display: "grid", gap: 8, placeItems: "center" }}>
                    <button
                      onClick={undoVote}
                      style={{
                        padding: "10px 14px",
                        border: "2px solid #111111",
                        background: "var(--surface)",
                        color: "var(--foreground)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        boxShadow: "4px 4px 0 rgba(17,17,17,0.16)",
                      }}
                    >
                      Undo Vote
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", placeItems: "center" }}>
                <button
                  onClick={() => vote(1)}
                  disabled={!item}
                  style={{
                    ...controlButtonStyle,
                    background: "#1f5eff",
                    color: "#ffffff",
                    cursor: item ? "pointer" : "not-allowed",
                    opacity: item ? 1 : 0.55,
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
                padding: "12px 16px",
                border: "2px solid #111111",
                background: "#f2c230",
                color: "var(--foreground)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1,
                boxShadow: "6px 6px 0 rgba(17,17,17,0.16)",
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
