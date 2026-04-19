// Lowercase hex — matches the engine wire format (§4.1 of
// LLM_TASK_AUTHORING.md). Callers hash sequentially to avoid pinning a
// whole folder's worth of bytes in memory at once.
export async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return toHex(new Uint8Array(hash));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
