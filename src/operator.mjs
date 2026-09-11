import crypto from "node:crypto";
import { resolveUnique, readValue } from "./selector.mjs";
import { appendEvidence } from "./evidence.mjs";

export class VerifiedDeviceError extends Error {
  constructor(code, message = code, details = {}) { super(message); this.code = code; this.details = details; }
}

export class VerifiedDeviceOperator {
  constructor({ adapter, evidenceFile = null, maxRecovery = 1 } = {}) {
    if (!adapter) throw new Error("adapter_required");
    this.adapter = adapter;
    this.evidenceFile = evidenceFile;
    this.maxRecovery = maxRecovery;
    this.recoveryCount = 0;
    this.lastSnapshot = null;
  }

  async record(event) {
    if (this.evidenceFile) await appendEvidence(this.evidenceFile, event);
  }

  async observe() {
    const snapshot = await this.adapter.snapshot();
    this.lastSnapshot = snapshot;
    return snapshot;
  }

  resolve(snapshot, selector, options = {}) {
    try { return resolveUnique(snapshot, selector, options); }
    catch (error) { throw new VerifiedDeviceError(error.message.startsWith("target_ambiguous") ? "target_ambiguous" : "target_not_resolved", error.message); }
  }

  async focus(selector) {
    const before = await this.observe();
    const target = this.resolve(before, selector);
    if (target.attrs.editable === false) throw new VerifiedDeviceError("target_not_editable");
    const operationId = crypto.randomUUID();
    await this.record({ operationId, phase: "focus", dispatch: "started", verification: "pending", retry: "forbidden", detail: selector });
    await this.adapter.press(selector);
    const after = await this.observe();
    const focused = this.resolve(after, { ...target.selector, focused: true });
    await this.record({ operationId, phase: "focus", dispatch: "accepted", verification: "verified", retry: "forbidden", detail: focused.attrs.id ?? selector });
    return { operationId, dispatch: "accepted", verification: "verified", retry: "forbidden", target: focused };
  }

  async replaceText(selector, value, { secret = false } = {}) {
    if (secret) throw new VerifiedDeviceError("secure_secret_provider_required", "Secret input is disabled until a secure provider is configured");
    await this.focus(selector);
    const operationId = crypto.randomUUID();
    await this.adapter.fill(selector, value);
    const after = await this.observe();
    const readback = readValue(after, selector);
    if (readback === null || readback === undefined) {
      await this.record({ operationId, phase: "replace", dispatch: "accepted", verification: "unknown", retry: "forbidden", detail: "readback_unavailable" });
      throw new VerifiedDeviceError("readback_unavailable", "The adapter did not expose a verifiable field value");
    }
    if (readback !== value) {
      await this.record({ operationId, phase: "replace", dispatch: "accepted", verification: "mismatch", retry: "forbidden", detail: "value_mismatch" });
      throw new VerifiedDeviceError("value_mismatch", "Text readback did not match target value");
    }
    await this.record({ operationId, phase: "replace", dispatch: "accepted", verification: "verified", retry: "forbidden", detail: "value_verified" });
    return { operationId, dispatch: "accepted", verification: "verified", retry: "forbidden", value: readback };
  }

  async press(selector) {
    const before = await this.observe();
    const target = this.resolve(before, selector);
    if (target.attrs.role && !/button|link|cell|tab/i.test(String(target.attrs.role))) throw new VerifiedDeviceError("target_not_pressable");
    const operationId = crypto.randomUUID();
    await this.adapter.press(selector);
    const after = await this.observe();
    if (JSON.stringify(before) === JSON.stringify(after)) throw new VerifiedDeviceError("state_unchanged", "Press was accepted but no UI state change was observed");
    await this.record({ operationId, phase: "press", dispatch: "accepted", verification: "verified", retry: "forbidden", detail: selector });
    return { operationId, dispatch: "accepted", verification: "verified", retry: "forbidden" };
  }

  async recoverOnce(reason) {
    if (this.recoveryCount >= this.maxRecovery) throw new VerifiedDeviceError("recovery_budget_exhausted", reason);
    this.recoveryCount += 1;
    if (typeof this.adapter.recover !== "function") throw new VerifiedDeviceError("recovery_unavailable", reason);
    await this.adapter.recover(reason);
    return { recovery: "performed", attempt: this.recoveryCount };
  }
}
