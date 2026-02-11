"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CaptionRow = {
  id: string;
  caption: string; // change if your column name is different
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

      // ✅ IMPORTANT: change "captions" / "caption" if your table/column differs
      const { data, error } = await supabase
        .from("captions")
        .select("id, caption")
        .limit(20);

      if (error) setStatus(`Error loading captions: ${error.message}`);
      setCaptions((data as CaptionRow[]) ?? []);
      setLoading(false);
    };
