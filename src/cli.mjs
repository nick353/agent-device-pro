#!/usr/bin/env node
import { AgentDeviceAdapter } from "./agent-device-adapter.mjs";
import { VerifiedDeviceOperator } from "./operator.mjs";

function parse(argv) {
  const [command, ...args] = argv;
  const options = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) options[args[i].slice(2)] = args[i + 1]?.startsWith("--") ? true : args[++i];
    else positional.push(args[i]);
  }
  const selector = positional[0];
  const value = positional[1];
  return { command, selector, value, options };
}

const { command, selector, value, options } = parse(process.argv.slice(2));
if (!command || command === "help") {
  console.log("Usage: vdo observe|focus|replace|press|verify <selector> [value] [--session name]");
  process.exit(0);
}

const adapter = new AgentDeviceAdapter({ session: options.session, platform: options.platform, timeoutMs: Number(options["timeout-ms"] || 20000) });
const operator = new VerifiedDeviceOperator({ adapter, evidenceFile: options.evidence || null });
try {
  let result;
  if (command === "observe") result = await operator.observe();
  else if (command === "focus") result = await operator.focus(selector);
  else if (command === "replace") result = await operator.replaceText(selector, value);
  else if (command === "press") result = await operator.press(selector);
  else if (command === "verify") {
    const snapshot = await operator.observe();
    const target = operator.resolve(snapshot, selector, { requireActionable: false });
    result = { verification: "verified", target };
  } else throw new Error(`unknown_command:${command}`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ verification: "failed", code: error.code || "operator_error", message: error.message }, null, 2));
  process.exitCode = 1;
}
