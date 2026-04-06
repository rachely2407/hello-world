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

const panelStyle = {
  border: "3px solid #111111",
  background: "var(--surface)",
  boxShadow: "10px 10px 0 rgba(17,17,17,0.16)",
  overflow: "hidden" as const,
};

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
        ...panelStyle,
      }}
    >
      {children}
    </div>
  );

  const Pill = ({ label, active }: { label: string; active: boolean }) => (
    <div
      style={{
        padding: "9px 12px",
        border: "2px solid #111111",
        background: active ? "#f2c230" : "#ffffff",
        color: "#111111",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 1,
        textTransform: "uppercase",
        boxShadow: active ? "4px 4px 0 rgba(17,17,17,0.18)" : "none",
      }}
    >
      {label}
    </div>
  );

  return (
    <AppShell title="Rachel's Project">
      <div style={{ maxWidth: 1100, margin: "0 auto", paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18 }}>
          <div>
            <div style={{ display: "inline-block", padding: "7px 10px", border: "2px solid #111111", background: "#d9362b", color: "#ffffff", fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>
              Production Pipeline
            </div>
            <div
              style={{
                fontSize: "clamp(2.2rem, 6vw, 3.8rem)",
                fontWeight: 900,
                letterSpacing: 2,
                margin: "14px 0 0 0",
                lineHeight: 0.94,
                color: "var(--foreground)",
                textTransform: "uppercase",
              }}
            >
              Upload & Caption Pipeline
            </div>
            <div style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 13, maxWidth: 760, lineHeight: 1.5 }}>
              Upload an image, register it, and generate captions. If the server times out (504), click{" "}
              <strong style={{ color: "var(--foreground)" }}>Generate again</strong> for captions only.
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

        <div style={{ marginTop: 18 }}>
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ color: "var(--foreground)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.2 }}>Status:</span>{" "}
                  <strong style={{ color: "var(--foreground)" }}>{statusText}</strong>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {cdnUrl ? (
                    <a
                      href={cdnUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        textDecoration: "none",
                        padding: "8px 10px",
                        border: "2px solid #111111",
                        background: "#1f5eff",
                        color: "#ffffff",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      Open CDN
                    </a>
                  ) : null}

                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--foreground)",
                      padding: "8px 10px",
                      border: "2px solid #111111",
                      background: "var(--surface)",
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
                  background: "var(--surface-soft)",
                  overflow: "hidden",
                  border: "2px solid #111111",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #d9362b 0 33%, #f2c230 33% 66%, #1f5eff 66% 100%)",
                    transition: "width 250ms ease",
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {error && (
          <div style={{ marginTop: 14 }}>
            <Card>
              <div
                style={{
                  padding: 16,
                  background: "#fff3ef",
                }}
              >
                <div style={{ fontWeight: 900, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Error</div>
                <div style={{ color: "rgba(17,17,17,0.78)", fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
                  If this is a <strong style={{ color: "#111111" }}>504 Gateway Timeout</strong>, the API is overloaded. Your upload or registration likely succeeded, so try <strong style={{ color: "#111111" }}>Generate captions again</strong>.
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    color: "#111111",
                    background: "#ffffff",
                    border: "2px solid #111111",
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

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
          <Card>
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14, marginBottom: 10, textTransform: "uppercase" }}>
                1 Select an image
              </div>

              <label
                style={{
                  display: "block",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                <div
                  style={{
                    border: "2px dashed #111111",
                    background: "#f7f3e8",
                    padding: 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: "#111111", textTransform: "uppercase" }}>
                        Click to choose a file
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "rgba(17,17,17,0.65)" }}>
                        Supported: JPG / PNG / WEBP / GIF / HEIC
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "10px 12px",
                        border: "2px solid #111111",
                        background: "#f2c230",
                        color: "#111111",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 1,
                        whiteSpace: "nowrap",
                        textTransform: "uppercase",
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

                  <div style={{ marginTop: 14, color: "rgba(17,17,17,0.72)", fontSize: 12 }}>
                    {file ? (
                      <>
                        <div>
                          <strong style={{ color: "#111111" }}>Selected:</strong> {file.name}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <strong style={{ color: "#111111" }}>Type:</strong> {file.type || "(unknown)"} •{" "}
                          <strong style={{ color: "#111111" }}>Size:</strong>{" "}
                          {Math.round(file.size / 1024)} KB
                        </div>
                      </>
                    ) : (
                      "No file selected yet."
                    )}
                  </div>
                </div>
              </label>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <button
                  onClick={runFullPipeline}
                  disabled={!file || busy}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "2px solid #111111",
                    background: busy ? "#d9d2bf" : "#1f5eff",
                    color: busy ? "rgba(17,17,17,0.65)" : "#ffffff",
                    fontWeight: 900,
                    fontSize: 14,
                    letterSpacing: 1,
                    cursor: !file || busy ? "not-allowed" : "pointer",
                    boxShadow: busy ? "none" : "6px 6px 0 rgba(17,17,17,0.2)",
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
                    border: "2px solid #111111",
                    background: "#f2c230",
                    color: "#111111",
                    fontWeight: 850,
                    fontSize: 13,
                    letterSpacing: 1,
                    cursor: !imageId || busy ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Generate captions again (no re-upload)
                </button>

                <div style={{ color: "rgba(17,17,17,0.55)", fontSize: 12, lineHeight: 1.4 }}>
                  Tip: If you see 504, wait ~5–15 seconds and click “Generate captions again”.
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: "grid", gap: 16 }}>
            <Card>
              <div style={{ padding: 18 }}>
                <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14, marginBottom: 10, textTransform: "uppercase" }}>
                  Preview
                </div>

                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="preview"
                    style={{
                      width: "100%",
                      display: "block",
                      border: "2px solid #111111",
                      background: "#ffffff",
                      maxHeight: 380,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 260,
                      border: "2px dashed #111111",
                      background: "#f7f3e8",
                      display: "grid",
                      placeItems: "center",
                      color: "rgba(17,17,17,0.55)",
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
                <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14, marginBottom: 10, textTransform: "uppercase" }}>
                  Output
                </div>

                <div style={{ display: "grid", gap: 10, color: "var(--foreground)", fontSize: 13 }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>cdnUrl:</span>{" "}
                    {cdnUrl ? (
                      <a href={cdnUrl} target="_blank" rel="noreferrer" style={{ color: "#1f5eff" }}>
                        {cdnUrl}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>imageId:</span> {imageId ?? "—"}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, color: "var(--foreground)" }}>Captions</div>

                  {captions ? (
                    captions.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        Captions still generating. Try again in a few seconds.
                      </div>
                    ) : (
                      <ol style={{ paddingLeft: 18, margin: 0, color: "var(--foreground)" }}>
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
                                    color: "var(--foreground)",
                                    background: "var(--surface)",
                                    border: "2px solid #111111",
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
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No captions yet.</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14, marginBottom: 10, textTransform: "uppercase" }}>
                Debug Log
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  color: "#111111",
                  background: "#ffffff",
                  border: "2px solid #111111",
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
              <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14, marginBottom: 10, textTransform: "uppercase" }}>
                Raw API Response
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  color: "#111111",
                  background: "#ffffff",
                  border: "2px solid #111111",
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
