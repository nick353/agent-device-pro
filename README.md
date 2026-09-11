# Verified Device Operator

`verified-device-operator` is an independent, fail-closed compatibility layer for [`agent-device`](https://github.com/callstack/agent-device).

It keeps the existing `agent-device` transport and adds:

- unique target resolution
- focus and hittability preconditions
- post-action state verification
- keyboard/occlusion guards
- bounded recovery and retry suppression
- redacted evidence records
- explicit `accepted`, `verified`, `mismatch`, and `unknown` results

This package does not replace or modify the installed `agent-device`. The current local baseline is archived separately under `work/agent-device-baseline/`.

## Status

Version `0.1.0` is the first local implementation. It is intentionally conservative: it can observe and verify, but it does not submit external effects unless the caller explicitly uses `press` after all preconditions pass.

## Usage

```sh
npm test
npm run check

# Uses agent-device from PATH, or set AGENT_DEVICE_BIN.
node src/cli.mjs observe --session mypro-physical-qa-20260909
node src/cli.mjs focus 'id=signup-email-field' --session mypro-physical-qa-20260909
node src/cli.mjs replace 'id=signup-email-field' 'test@example.com' --session mypro-physical-qa-20260909
node src/cli.mjs verify 'id=signup-email-field' --value 'test@example.com' --session mypro-physical-qa-20260909

# Every transport call has a bounded timeout.
node src/cli.mjs observe --session mypro-physical-qa-20260909 --timeout-ms 15000
```

Secrets are not accepted through normal logs or evidence. A future secure secret provider must be added before password/OTP automation is enabled.

## Contract

Every mutation returns a result with:

```json
{
  "dispatch": "accepted",
  "verification": "verified",
  "retry": "forbidden",
  "evidence": []
}
```

`accepted` alone is never treated as a successful UI operation.

If the platform does not expose a verifiable field value, `replace` returns
`readback_unavailable` and stops. It never guesses that text entry succeeded.

## Non-goals for 0.1

- bypassing trust, OTP, CAPTCHA, identity verification, or payment
- replacing XCTest/WDA/CoreDevice
- automatically retrying an unknown external effect
- storing raw passwords, tokens, cookies, or OTPs

## GitHub release path

1. Run `npm test` and `npm run check`.
2. Add a real-device adapter test run with redacted evidence.
3. Review the public API and security model.
4. Initialize a separate Git repository and publish only this package.
