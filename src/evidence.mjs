import fs from "node:fs/promises";
import path from "node:path";

export function redact(value, secret = false) {
  if (secret) return "[REDACTED]";
  if (typeof value === "string") return value.replace(/(password|token|secret|cookie|otp)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
  return value;
}

export function evidenceEvent(event) {
  return {
    at: new Date().toISOString(),
    operationId: event.operationId,
    phase: event.phase,
    dispatch: event.dispatch,
    verification: event.verification,
    retry: event.retry,
    detail: redact(event.detail, event.secret === true)
  };
}

export async function appendEvidence(file, event) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(evidenceEvent(event))}\n`, "utf8");
}
