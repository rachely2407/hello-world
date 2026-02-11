"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("images")
        .select("id, url, image_description")
        .eq("is_public", true)
        .limit(5);

      if (!error) {
        setRows(data || []);
      }
    }

    load();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>List from Supabase</h1>

      {/* 👇 ADD THIS BLOCK */}
      <div style={{ marginBottom: 16 }}>
        <a href="/rate">Rate captions (requires login)</a>
      </div>

      {rows.map((img) => (
        <div key={img.id} style={{ marginBottom: 24 }}>
          <img
            src={img.url}
            alt={img.image_description}
            style={{
              maxWidth: 300,
              borderRadius: 12,
              display: "block",
              marginBottom: 8,
            }}
          />
          <p>{img.image_description}</p>
        </div>
      ))}
    </main>
  );
}
