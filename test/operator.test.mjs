import test from "node:test";
import assert from "node:assert/strict";
import { VerifiedDeviceOperator } from "../src/operator.mjs";

function adapterFactory(states) {
  let index = 0;
  return {
    snapshot: async () => states[Math.min(index, states.length - 1)],
    press: async () => { index += 1; },
    fill: async () => { index += 1; }
  };
}

const field = (value, extra = {}) => ({ id: "email", role: "textfield", label: "Email", value, visible: true, enabled: true, hittable: true, editable: true, ...extra });

test("focus fails closed when the target is not actionable", async () => {
  const operator = new VerifiedDeviceOperator({ adapter: { snapshot: async () => ({ elements: [field("", { hittable: false })] }) } });
  await assert.rejects(() => operator.focus("id=email"), /target_not_actionable/);
});

test("replace verifies the exact readback", async () => {
  const operator = new VerifiedDeviceOperator({ adapter: adapterFactory([
    { elements: [field("")] },
    { elements: [field("", { focused: true })] },
    { elements: [field("ok", { focused: true })] }
  ]) });
  const result = await operator.replaceText("id=email", "ok");
  assert.equal(result.verification, "verified");
});

test("selector role aliases resolve platform naming differences", async () => {
  const makeField = (value, extra = {}) => ({ type: "TextField", label: "First name", enabled: true, hittable: true, editable: true, value, ...extra });
  const operator = new VerifiedDeviceOperator({ adapter: adapterFactory([
    { elements: [makeField("")] },
    { elements: [makeField("", { focused: true })] },
    { elements: [makeField("Nichika", { focused: true })] }
  ]) });
  const result = await operator.replaceText('role=text-field label="First name"', "Nichika");
  assert.equal(result.verification, "verified");
});

test("replace stops on value mismatch instead of retrying", async () => {
  const operator = new VerifiedDeviceOperator({ adapter: adapterFactory([
    { elements: [field("")] },
    { elements: [field("", { focused: true })] },
    { elements: [field("wrong", { focused: true })] }
  ]) });
  await assert.rejects(
    () => operator.replaceText("id=email", "ok"),
    error => error.code === "value_mismatch"
  );
});

test("secret input is fail-closed until a secure provider exists", async () => {
  const operator = new VerifiedDeviceOperator({ adapter: adapterFactory([{ elements: [field("")] }]) });
  await assert.rejects(
    () => operator.replaceText("id=email", "secret", { secret: true }),
    error => error.code === "secure_secret_provider_required"
  );
});

test("scroll verifies that the UI changed", async () => {
  const states = [{ page: 1 }, { page: 2 }];
  let index = 0;
  const operator = new VerifiedDeviceOperator({
    adapter: { snapshot: async () => states[index], scroll: async () => { index += 1; } }
  });
  const result = await operator.scroll("down");
  assert.equal(result.verification, "verified");
});
