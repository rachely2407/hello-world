"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppShell from "@/app/components/AppShell";


const API_BASE = "https://api.almostcrackd.ai";

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

type Stage =
  | "auth"
  | "ready"
  | "presign"
  | "upload"
  | "register"
  | "captions"
  | "done"
  | "error";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  // add +/- 15% randomness to reduce synchronized retries
  const delta = ms * 0.15;
  return ms + (Math.random() * 2 - 1) * delta;
}

/** Read response body safely (json when possible, otherwise text) */
async function readBody(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/** Turn any unknown value into a readable string (prevents [object Object]) */
function pretty(v: unknown) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Try to extract a CloudFront Request ID from the HTML */
function extractCloudFrontRequestId(html: string): string | null {
  const m = html.match(/Request ID:\s*([A-Za-z0-9_\-+/=&#x;]+)/i);
  return m?.[1]?.replace(/&#x3D;/g, "=") ?? null;
}

export default function PipelinePage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("auth");
  const [statusText, setStatusText] = useState<string>("Checking auth…");
  const [error, setError] = useState<string | null>(null);

  const [cdnUrl, setCdnUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);

  const [captions, setCaptions] = useState<any[] | null>(null);
  const [rawCaptionsResponse, setRawCaptionsResponse] = useState<any>(null);

  const [debugLog, setDebugLog] = useState<string>("");

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const init = async () => {
      setStage("auth");
      setStatusText("Checking auth…");

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (!token) {
        router.replace("/login");
        return;
      }

      setStage("ready");
      setStatusText("Ready");
    };

    init();
  }, [router]);

  function log(line: string) {
    setDebugLog((prev) => (prev ? `${prev}\n${line}` : line));
  }

  async function requireFreshToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token ?? null;
    if (!token) throw new Error("Session expired. Please log in again.");
    return token;
  }

  function resetRunOutputs() {
    setError(null);
    setCaptions(null);
    setRawCaptionsResponse(null);
    setDebugLog("");
    // note: we DO NOT clear imageId/cdnUrl here because for retries we want to keep them
  }

  async function generateCaptionsOnly(existingImageId: string) {
    setCaptions(null);
    setRawCaptionsResponse(null);

    setBusy(true);
    setStage("captions");

    try {
      const maxAttempts = 10;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setStatusText(`Generating captions… (attempt ${attempt}/${maxAttempts})`);

        const token = await requireFreshToken();

        const res = await fetch(`${API_BASE}/pipeline/generate-captions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageId: existingImageId }),
        });

        const body = await readBody(res);

        if (!res.ok) {
          const retryable = res.status === 504 || res.status === 502 || res.status === 503;

          // CloudFront 504 returns HTML as string
          if (typeof body === "string" && body.includes("504 Gateway Timeout")) {
            const reqId = extractCloudFrontRequestId(body);
            log(
              `Attempt ${attempt}: 504 CloudFront timeout${
                reqId ? ` (Request ID: ${reqId})` : ""
              }`
            );
          } else {
            log(`Attempt ${attempt}: error ${res.status}\n${pretty(body)}`);
          }

          if (retryable && attempt < maxAttempts) {
            // gentler backoff for overloaded service
            const base = 1500 * attempt;
            await sleep(jitter(base));
            continue;
          }

          // Not retryable or out of attempts
          throw new Error(`Generate captions failed (${res.status}):\n${pretty(body)}`);
        }

        // success
        setRawCaptionsResponse(body);

        const arr = Array.isArray(body) ? body : [body];
        setCaptions(arr);

        setStage("done");
        setStatusText("Done ✅");
        log("Captions success");
        return;
      }

      throw new Error("Caption generation timed out after multiple retries.");
    } catch (e: any) {
      setStage("error");
      setStatusText("Error");
      setError(e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const runFullPipeline = async () => {
    setError(null);
    setCaptions(null);
    setRawCaptionsResponse(null);
    setCdnUrl(null);
    setImageId(null);
    setDebugLog("");

    if (!file) {
      setError("Please choose an image first.");
      return;
    }
    if (!SUPPORTED_TYPES.has(file.type)) {
      setError(
        `Unsupported file type: ${file.type || "(unknown)"}.\nSupported: jpeg/jpg/png/webp/gif/heic`
      );
      return;
    }

    setBusy(true);

    try {
      const token = await requireFreshToken();

      // Step 1: presign
      setStage("presign");
      setStatusText("1/4 Generating presigned upload URL…");

      const presignRes = await fetch(`${API_BASE}/pipeline/generate-presigned-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!presignRes.ok) {
        const body = await readBody(presignRes);
        throw new Error(`Presign failed (${presignRes.status}):\n${pretty(body)}`);
      }

      const presignJson = (await presignRes.json()) as {
        presignedUrl: string;
        cdnUrl: string;
      };

      setCdnUrl(presignJson.cdnUrl);
      log(`Step1 presign ok\ncdnUrl=${presignJson.cdnUrl}`);

      // Step 2: upload
      setStage("upload");
      setStatusText("2/4 Uploading image bytes…");

      const uploadRes = await fetch(presignJson.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        const body = await readBody(uploadRes);
        throw new Error(`Upload failed (${uploadRes.status}):\n${pretty(body)}`);
      }

      log("Step2 upload ok");

      // Step 3: register
      setStage("register");
      setStatusText("3/4 Registering uploaded image…");

      const registerRes = await fetch(`${API_BASE}/pipeline/upload-image-from-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: presignJson.cdnUrl, isCommonUse: false }),
      });

      const registerBody = await readBody(registerRes);

      if (!registerRes.ok) {
        throw new Error(`Register failed (${registerRes.status}):\n${pretty(registerBody)}`);
      }

      const registerJson = registerBody as any;
      log(`Step3 register response:\n${pretty(registerJson)}`);

      const newImageId: string | null =
        registerJson?.imageId ??
        registerJson?.step3Output?.imageId ??
        registerJson?.data?.imageId ??
        registerJson?.result?.imageId ??
        registerJson?.id ??
        null;

      if (!newImageId) {
        throw new Error(
          `Register succeeded but imageId missing.\nResponse:\n${pretty(registerJson)}`
        );
      }

      setImageId(newImageId);
      log(`Step3 imageId=${newImageId}`);

      // Step 4: captions (retry)
      setBusy(false); // let generateCaptionsOnly manage busy/stage itself
      await generateCaptionsOnly(newImageId);
    } catch (e: any) {
      setStage("error");
      setStatusText("Error");
      setError(e?.message ?? "Unknown error");
      setBusy(false);
    }
  };

  const StepPill = ({ n, label }: { n: number; label: string }) => {
    const idx =
      stage === "presign" ? 1 : stage === "upload" ? 2 : stage === "register" ? 3 : stage === "captions" ? 4 : 0;
    const active = idx === n;
    const completed = idx > n || stage === "done";

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 999,
          border: "1px solid #eaeaea",
          background: active ? "#f5f7ff" : completed ? "#f6fff7" : "#fafafa",
          color: "#111",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #ddd",
            background: completed ? "#eaffee" : "#fff",
            fontSize: 12,
          }}
        >
          {completed ? "✓" : n}
        </span>
        <span style={{ opacity: 0.9 }}>{label}</span>
      </div>
    );
  };

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Upload → Generate Captions</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>
            Pick an image, click the big button, and if captions time out you can retry without re-uploading.
          </p>
        </div>

        <nav style={{ display: "flex", gap: 16 }}>
          <a href="/" style={{ color: "#111", textDecoration: "none" }}>
            Home
          </a>
          <a href="/rate" style={{ color: "#111", textDecoration: "none" }}>
            Rate
          </a>
          <a href="/login" style={{ color: "#111", textDecoration: "none" }}>
            Login
          </a>
        </nav>
      </header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <StepPill n={1} label="Presign URL" />
        <StepPill n={2} label="Upload Bytes" />
        <StepPill n={3} label="Register Image" />
        <StepPill n={4} label="Generate Captions" />
      </div>

      <div style={{ marginBottom: 16, color: "#444" }}>
        Status: <strong>{statusText}</strong>
      </div>

      {error && (
        <div
          style={{
            padding: 14,
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            borderRadius: 12,
            marginBottom: 16,
            whiteSpace: "pre-wrap",
            lineHeight: 1.35,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Error</div>
          <div style={{ marginBottom: 10, color: "#444" }}>
            If this is a <strong>504 Gateway Timeout</strong>, the server is overloaded.
            Your upload/registration likely succeeded — try the retry button below.
          </div>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
            {error}
          </div>
        </div>
      )}

      {/* Upload card */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 18,
          padding: 18,
          border: "1px solid #eee",
          borderRadius: 16,
          marginBottom: 18,
          background: "#fff",
        }}
      >
        <div>
          <div
            style={{
              border: "2px dashed #d7d7d7",
              borderRadius: 16,
              padding: 18,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>1) Choose an image</div>
            <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
              Then click <strong>Upload & Generate</strong>. If captions time out, use the retry button.
            </div>

            <label
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              Choose File
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={busy}
                style={{ display: "none" }}
              />
            </label>

            <div style={{ marginTop: 12, color: "#555", fontSize: 13 }}>
              {file ? (
                <>
                  <div>
                    <strong>Selected:</strong> {file.name}
                  </div>
                  <div>
                    <strong>Type:</strong> {file.type || "(unknown)"} • <strong>Size:</strong>{" "}
                    {Math.round(file.size / 1024)} KB
                  </div>
                </>
              ) : (
                "No file selected yet."
              )}
            </div>
          </div>

          <button
            onClick={runFullPipeline}
            disabled={!file || busy}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #111",
              background: busy ? "#f2f2f2" : "#111",
              color: busy ? "#777" : "#fff",
              fontWeight: 900,
              fontSize: 15,
              cursor: !file || busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Working…" : "Upload & Generate Captions →"}
          </button>

          {/* New: retry-only button */}
          <button
            onClick={() => {
              resetRunOutputs();
              if (!imageId) {
                setError("No imageId yet. Run Upload & Generate first.");
                return;
              }
              generateCaptionsOnly(imageId);
            }}
            disabled={!imageId || busy}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid #ddd",
              background: busy ? "#f8f8f8" : "#fff",
              color: "#111",
              fontWeight: 800,
              fontSize: 14,
              cursor: !imageId || busy ? "not-allowed" : "pointer",
            }}
          >
            Generate captions again (no re-upload)
          </button>

          <div style={{ marginTop: 10, color: "#777", fontSize: 12 }}>
            Tip: if you see 504, wait ~5–15 seconds and click “Generate captions again”.
          </div>
        </div>

        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Preview</div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: "100%", borderRadius: 12, display: "block" }}
            />
          ) : (
            <div
              style={{
                height: 220,
                borderRadius: 12,
                background: "#fafafa",
                border: "1px dashed #ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#888",
                fontSize: 13,
                textAlign: "center",
                padding: 12,
              }}
            >
              Pick an image to see a preview here.
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Results</h2>

        <div style={{ marginBottom: 12, color: "#444", fontSize: 13, lineHeight: 1.4 }}>
          <div>
            <strong>cdnUrl:</strong>{" "}
            {cdnUrl ? (
              <a href={cdnUrl} target="_blank" rel="noreferrer">
                {cdnUrl}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <strong>imageId:</strong> {imageId ?? "—"}
          </div>
        </div>

        {captions && (
          <>
            <h3 style={{ marginTop: 14, fontSize: 16 }}>Captions</h3>
            {captions.length === 0 ? (
              <p style={{ color: "#777" }}>Captions still generating. Try again in a few seconds.</p>
            ) : (
              <ol style={{ paddingLeft: 18 }}>
                {captions.map((c, idx) => {
                  const text = c?.content ?? c?.caption ?? c?.text ?? c?.result ?? null;
                  return (
                    <li key={idx} style={{ marginBottom: 10 }}>
                      {text ? (
                        <span>{String(text)}</span>
                      ) : (
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                          {JSON.stringify(c, null, 2)}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}

        {!captions && <p style={{ color: "#777" }}>No captions yet.</p>}

        {rawCaptionsResponse && (
          <>
            <h3 style={{ marginTop: 18, fontSize: 14 }}>Raw API response (debug)</h3>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                background: "#fafafa",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #eee",
              }}
            >
              {JSON.stringify(rawCaptionsResponse, null, 2)}
            </pre>
          </>
        )}

        <h3 style={{ marginTop: 18, fontSize: 14 }}>Debug log</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            background: "#0b0b0b",
            color: "#eaeaea",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #222",
            lineHeight: 1.35,
          }}
        >
          {debugLog || "—"}
        </pre>
      </section>
    </main>
  );
}