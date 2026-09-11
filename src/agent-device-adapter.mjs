import { spawn } from "node:child_process";

export class AgentDeviceAdapter {
  constructor({ bin = process.env.AGENT_DEVICE_BIN || "agent-device", session = process.env.AGENT_DEVICE_SESSION, platform = process.env.AGENT_DEVICE_PLATFORM, timeoutMs = 20000 } = {}) {
    this.bin = bin; this.session = session; this.platform = platform; this.timeoutMs = timeoutMs;
  }

  async run(args, { input = null } = {}) {
    const full = [...args];
    if (this.session) full.push("--session", this.session);
    if (this.platform) full.push("--platform", this.platform);
    full.push("--json");
    return await new Promise((resolve, reject) => {
      const child = spawn(this.bin, full, { stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"] });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; });
      child.stderr.on("data", chunk => { stderr += chunk; });
      let settled = false;
      const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value); };
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 500).unref();
        finish(reject, new Error(`agent_device_timeout_${this.timeoutMs}ms`));
      }, this.timeoutMs);
      child.on("error", error => finish(reject, error));
      child.on("close", code => {
        if (code !== 0) return finish(reject, new Error(`agent_device_exit_${code}:${stderr.slice(-500)}`));
        try { finish(resolve, JSON.parse(stdout)); } catch { finish(reject, new Error("agent_device_invalid_json")); }
      });
      if (input != null) { child.stdin.end(input); }
    });
  }

  snapshot() { return this.run(["snapshot", "-i"]); }
  press(selector) { return this.run(["press", selector]); }
  fill(selector, value) { return this.run(["fill", selector, value]); }
  scroll(direction) { return this.run(["scroll", direction]); }
  recover() { return this.run(["keyboard", "dismiss"]); }
}
