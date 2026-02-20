"use client";

import { useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";
import { supabase } from "@/lib/supabaseClient";

export default function CaptionsListPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setStatus("Loading…");
      const { data, error } = await supabase
        .from("images")
        .select("id, url, image_description")
        .eq("is_public", true)
        .order("created_datetime_utc", { ascending: false })
        .limit(12);

      if (error) setStatus(`Error: ${error.message}`);
      else setStatus(null);

      setRows(data || []);
    };
    load();
  }, []);

  return (
    <AppShell title="Rachel's Project">
      <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 14 }}>
        <div
          style={{
            fontSize: 34,
            letterSpacing: 6,
            fontWeight: 900,
            marginBottom: 16,
            textShadow: "0 0 14px rgba(255,255,255,0.14)",
          }}
        >
          CAPTIONS LIST
        </div>

        {status && <p style={{ color: "rgba(255,255,255,0.7)" }}>{status}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
          {rows.map((img) => (
            <div
              key={img.id}
              style={{
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                padding: 14,
              }}
            >
              <img
                src={img.url}
                alt={img.image_description || "image"}
                style={{ width: "100%", borderRadius: 14, display: "block" }}
              />
              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
                {img.image_description || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}