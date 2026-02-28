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
  const delta = ms * 0.15;
  return ms + (Math.random() * 2 - 1) * delta;
}

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

function pretty(v: unknown) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function extractCloudFrontRequestId(html: string): string | null {
  const m = html.match(/Request ID:\s*([A-Za-z0-9_\-+/=&#x;]+)/i);
  return m?.[1]?.replace(/&#x3D;/g, "=") ?? null;
}

/** UI helpers */
function stageIndex(stage: Stage) {
  if (stage === "presign") return 1;
  if (stage === "upload") return 2;
  if (stage === "register") return 3;
  if (stage === "captions") return 4;
  if (stage === "done") return 5;
  if (stage === "error") return 0;
  return 0;
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
            const base = 1500 * attempt;
            await sleep(jitter(base));
            continue;
          }

          throw new Error(`Generate captions failed (${res.status}):\n${pretty(body)}`);
        }

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

      // Step 4: captions
      setBusy(false);
      await generateCaptionsOnly(newImageId);
    } catch (e: any) {
      setStage("error");
      setStatusText("Error");
      setError(e?.message ?? "Unknown error");
      setBusy(false);
    }
  };

  const idx = stageIndex(stage);
  const progress = idx === 0 ? 0 : Math.min(100, Math.round(((idx - 1) / 4) * 100));

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.35)",
        boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );

  const Pill = ({ label, active }: { label: string; active: boolean }) => (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active
          ? "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(239,68,68,0.18))"
          : "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.88)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
      }}
    >
      {label}
    </div>
  );

  return (
    <AppShell title="Rachel's Project">
      <div style={{ maxWidth: 1100, margin: "0 auto", paddingTop: 8 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18 }}>
          <div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 900,
                letterSpacing: 2,
                margin: 0,
                lineHeight: 1,
                background: "linear-gradient(90deg, rgba(59,130,246,1), rgba(239,68,68,1))",
                WebkitBackgroundClip: "text",
                color: "transparent",
                textShadow: "0 0 22px rgba(255,255,255,0.08)",
              }}
            >
              Upload & Caption Pipeline
            </div>
            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", fontSize: 13, maxWidth: 760 }}>
              Upload an image, register it, and generate captions. If the server times out (504), click{" "}
              <strong style={{ color: "rgba(255,255,255,0.9)" }}>Generate again</strong> — no re-upload needed.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Pill label="1 Presign" active={stage === "presign"} />
            <Pill label="2 Upload" active={stage === "upload"} />
            <Pill label="3 Register" active={stage === "register"} />
            <Pill label="4 Captions" active={stage === "captions"} />
            <Pill label="Done" active={stage === "done"} />
          </div>
        </div>

        {/* Status bar */}
        <div style={{ marginTop: 18 }}>
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
                  <span style={{ color: "rgba(255,255,255,0.55)" }}>Status:</span>{" "}
                  <strong style={{ color: "rgba(255,255,255,0.92)" }}>{statusText}</strong>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {cdnUrl ? (
                    <a
                      href={cdnUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.8)",
                        textDecoration: "none",
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.04)",
                      }}
                    >
                      Open CDN
                    </a>
                  ) : null}

                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.7)",
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                    title={imageId ?? ""}
                  >
                    imageId: {imageId ? `${imageId.slice(0, 8)}…` : "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, rgba(59,130,246,1), rgba(239,68,68,1))",
                    transition: "width 250ms ease",
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 14 }}>
            <Card>
              <div
                style={{
                  padding: 16,
                  background: "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(59,130,246,0.08))",
                }}
              >
                <div style={{ fontWeight: 900, letterSpacing: 0.6, marginBottom: 8 }}>Error</div>
                <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
                  If this is a <strong style={{ color: "rgba(255,255,255,0.92)" }}>504 Gateway Timeout</strong>, the API
                  is overloaded. Your upload/registration likely succeeded — try{" "}
                  <strong style={{ color: "rgba(255,255,255,0.92)" }}>Generate captions again</strong>.
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.9)",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    padding: 12,
                    lineHeight: 1.35,
                  }}
                >
                  {error}
                </pre>
              </div>
            </Card>
          </div>
        )}

        {/* Main grid */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
          {/* Left: upload */}
          <Card>
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 14, marginBottom: 10 }}>
                1) Select an image
              </div>

              {/* Dropzone-ish box */}
              <label
                style={{
                  display: "block",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                <div
                  style={{
                    borderRadius: 20,
                    border: "1px dashed rgba(255,255,255,0.22)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                    padding: 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: "rgba(255,255,255,0.92)" }}>
                        Click to choose a file
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                        Supported: JPG / PNG / WEBP / GIF / HEIC
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.88)",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Browse →
                    </div>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={busy}
                    style={{ display: "none" }}
                  />

                  <div style={{ marginTop: 14, color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
                    {file ? (
                      <>
                        <div>
                          <strong style={{ color: "rgba(255,255,255,0.92)" }}>Selected:</strong> {file.name}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <strong style={{ color: "rgba(255,255,255,0.92)" }}>Type:</strong> {file.type || "(unknown)"} •{" "}
                          <strong style={{ color: "rgba(255,255,255,0.92)" }}>Size:</strong>{" "}
                          {Math.round(file.size / 1024)} KB
                        </div>
                      </>
                    ) : (
                      "No file selected yet."
                    )}
                  </div>
                </div>
              </label>

              {/* CTA buttons */}
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <button
                  onClick={runFullPipeline}
                  disabled={!file || busy}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: busy
                      ? "rgba(255,255,255,0.06)"
                      : "linear-gradient(90deg, rgba(59,130,246,1), rgba(239,68,68,1))",
                    color: busy ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.95)",
                    fontWeight: 900,
                    fontSize: 14,
                    letterSpacing: 0.6,
                    cursor: !file || busy ? "not-allowed" : "pointer",
                    boxShadow: busy ? "none" : "0 18px 55px rgba(0,0,0,0.45)",
                  }}
                >
                  {busy ? "Working…" : "UPLOAD + GENERATE CAPTIONS →"}
                </button>

                <button
                  onClick={() => {
                    resetRunOutputs();
                    if (!imageId) {
                      setError("No imageId yet. Run Upload + Generate first.");
                      return;
                    }
                    generateCaptionsOnly(imageId);
                  }}
                  disabled={!imageId || busy}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 850,
                    fontSize: 13,
                    letterSpacing: 0.4,
                    cursor: !imageId || busy ? "not-allowed" : "pointer",
                  }}
                >
                  Generate captions again (no re-upload)
                </button>

                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.4 }}>
                  Tip: If you see 504, wait ~5–15 seconds and click “Generate captions again”.
                </div>
              </div>
            </div>
          </Card>

          {/* Right: preview + results */}
          <div style={{ display: "grid", gap: 16 }}>
            <Card>
              <div style={{ padding: 18 }}>
                <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 14, marginBottom: 10 }}>
                  Preview
                </div>

                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="preview"
                    style={{
                      width: "100%",
                      borderRadius: 18,
                      display: "block",
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.02)",
                      maxHeight: 380,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 260,
                      borderRadius: 18,
                      border: "1px dashed rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.02)",
                      display: "grid",
                      placeItems: "center",
                      color: "rgba(255,255,255,0.55)",
                      fontSize: 13,
                      textAlign: "center",
                      padding: 12,
                    }}
                  >
                    Pick an image to preview it here.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div style={{ padding: 18 }}>
                <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 14, marginBottom: 10 }}>
                  Output
                </div>

                <div style={{ display: "grid", gap: 10, color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>cdnUrl:</span>{" "}
                    {cdnUrl ? (
                      <a href={cdnUrl} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.9)" }}>
                        {cdnUrl}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>imageId:</span> {imageId ?? "—"}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Captions</div>

                  {captions ? (
                    captions.length === 0 ? (
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                        Captions still generating. Try again in a few seconds.
                      </div>
                    ) : (
                      <ol style={{ paddingLeft: 18, margin: 0, color: "rgba(255,255,255,0.9)" }}>
                        {captions.map((c, idx) => {
                          const text = c?.content ?? c?.caption ?? c?.text ?? c?.result ?? null;
                          return (
                            <li key={idx} style={{ marginBottom: 10, lineHeight: 1.35 }}>
                              {text ? (
                                <span>{String(text)}</span>
                              ) : (
                                <pre
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    fontSize: 12,
                                    margin: 0,
                                    color: "rgba(255,255,255,0.85)",
                                    background: "rgba(0,0,0,0.30)",
                                    border: "1px solid rgba(255,255,255,0.10)",
                                    borderRadius: 14,
                                    padding: 10,
                                  }}
                                >
                                  {JSON.stringify(c, null, 2)}
                                </pre>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )
                  ) : (
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>No captions yet.</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Debug */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 14, marginBottom: 10 }}>
                Debug Log
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.88)",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  padding: 12,
                  lineHeight: 1.35,
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {debugLog || "—"}
              </pre>
            </div>
          </Card>

          <Card>
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 14, marginBottom: 10 }}>
                Raw API Response
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.88)",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  padding: 12,
                  lineHeight: 1.35,
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {rawCaptionsResponse ? JSON.stringify(rawCaptionsResponse, null, 2) : "—"}
              </pre>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}