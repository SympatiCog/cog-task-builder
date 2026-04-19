// Compute SHA-256 of a File's bytes using the browser's SubtleCrypto API,
// returning the hex-encoded digest in lowercase — matches the format the
// engine expects on the wire (§4.1 of LLM_TASK_AUTHORING.md). Large folders
// are processed one at a time to avoid pinning a whole folder's worth of
// bytes in memory.
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
