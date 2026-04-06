"use client";

import { useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";
import { supabase } from "@/lib/supabaseClient";

const PAGE_SIZE = 12;

type SortOption = "newest" | "oldest" | "caption";

type CaptionRow = {
  id: string;
  content: string | null;
  image_id: string | null;
  created_datetime_utc?: string | null;
};

type ImageRow = {
  id: string;
  url: string | null;
  image_description: string | null;
  is_public?: boolean | null;
};

type CaptionCardRow = {
  id: string;
  content: string;
  image_id: string | null;
  image_url: string | null;
  image_description: string | null;
};

const controlStyle = {
  border: "2px solid #111111",
  background: "var(--surface)",
  color: "var(--foreground)",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  boxShadow: "4px 4px 0 rgba(17,17,17,0.16)",
};

export default function CaptionsListPage() {
  const [rows, setRows] = useState<CaptionCardRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort] = useState<SortOption>("newest");

  useEffect(() => {
    const load = async () => {
      setStatus("Loading…");

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("captions")
        .select("id, content, image_id, created_datetime_utc", { count: "exact" });

      if (sort === "newest") {
        query = query.order("created_datetime_utc", { ascending: false, nullsFirst: false });
      } else if (sort === "oldest") {
        query = query.order("created_datetime_utc", { ascending: true, nullsFirst: false });
      } else {
        query = query.order("content", { ascending: true, nullsFirst: false });
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        setStatus(`Error: ${error.message}`);
        setRows([]);
        return;
      }

      const captions = ((data as CaptionRow[]) || []).filter(
        (row) => typeof row.content === "string" && row.content.trim().length > 0
      );

      const imageIds = Array.from(new Set(captions.map((row) => row.image_id).filter(Boolean))) as string[];

      let imageMap = new Map<string, ImageRow>();
      if (imageIds.length > 0) {
        const { data: imageData, error: imageErr } = await supabase
          .from("images")
          .select("id, url, image_description, is_public")
          .in("id", imageIds);

        if (imageErr) {
          setStatus(`Error: ${imageErr.message}`);
          setRows([]);
          return;
        }

        imageMap = new Map(((imageData as ImageRow[]) || []).map((image) => [image.id, image]));
      }

      const hydratedRows: CaptionCardRow[] = captions.map((caption) => {
        const image = caption.image_id ? imageMap.get(caption.image_id) : undefined;

        return {
          id: caption.id,
          content: caption.content || "",
          image_id: caption.image_id,
          image_url: image?.url ?? null,
          image_description: image?.image_description ?? null,
        };
      });

      setRows(hydratedRows);
      setTotalCount(count ?? 0);
      setStatus(null);
    };

    load();
  }, [page, sort]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <AppShell title="Rachel's Project">
      <div style={{ maxWidth: 1120, margin: "0 auto", paddingTop: 14 }}>
        <div style={{ display: "inline-block", padding: "7px 10px", border: "2px solid #111111", background: "#1f5eff", color: "#ffffff", fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>
          Public Archive
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: "clamp(2rem, 6vw, 3.4rem)",
            letterSpacing: 2,
            fontWeight: 900,
            marginBottom: 14,
            lineHeight: 0.95,
            textTransform: "uppercase",
            color: "var(--foreground)",
          }}
        >
          Captions List
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {status ? status : `Showing ${rows.length} of ${totalCount} captions`}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortOption);
                setPage(1);
              }}
              style={controlStyle}
            >
              <option value="newest">Most Recent</option>
              <option value="oldest">Oldest</option>
              <option value="caption">Caption A-Z</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {rows.map((row, index) => (
            <div
              key={row.id}
              style={{
                border: "3px solid #111111",
                background: index % 3 === 1 ? "#f2c230" : "var(--surface)",
                padding: 14,
                boxShadow: "8px 8px 0 rgba(17,17,17,0.16)",
                display: "grid",
                gap: 12,
                alignContent: "start",
              }}
            >
              {row.image_url ? (
                <img
                  src={row.image_url}
                  alt={row.image_description || row.content}
                  style={{ width: "100%", border: "2px solid #111111", display: "block", aspectRatio: "4 / 3", objectFit: "cover", background: "var(--surface)" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "4 / 3",
                    border: "2px dashed #111111",
                    display: "grid",
                    placeItems: "center",
                    background: "var(--surface-soft)",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  No image
                </div>
              )}

              <div style={{ color: "var(--foreground)", fontSize: 18, lineHeight: 1.45, fontWeight: 700 }}>
                {row.content}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>
            Page {page} of {totalPages}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              style={{
                ...controlStyle,
                cursor: page === 1 ? "not-allowed" : "pointer",
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              style={{
                ...controlStyle,
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
