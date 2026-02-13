"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <h1 style={{ margin: 0 }}>Humor Project</h1>

        <nav style={{ display: "flex", gap: 20 }}>
          <Link href="/rate">Rate Captions</Link>
          <Link href="/login">Login</Link>
        </nav>
      </header>

      {/* Image List */}
      <section>
        <h2 style={{ marginBottom: 20 }}>Public Images</h2>

        {rows.map((img) => (
          <div
            key={img.id}
            style={{
              marginBottom: 40,
              paddingBottom: 20,
              borderBottom: "1px solid #eee",
            }}
          >
            <img
              src={img.url}
              alt={img.image_description}
              style={{
                maxWidth: "100%",
                borderRadius: 12,
                marginBottom: 12,
              }}
            />
            <p style={{ lineHeight: 1.6 }}>{img.image_description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
