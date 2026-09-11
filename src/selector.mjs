const KEY_RE = /([a-zA-Z][a-zA-Z0-9_-]*)=("[^"]*"|'[^']*'|[^\s]+)/g;

export function parseSelector(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error("selector_required");
  const selector = {};
  for (const match of input.matchAll(KEY_RE)) {
    const value = match[2].replace(/^['"]|['"]$/g, "");
    selector[match[1]] = value;
  }
  if (!Object.keys(selector).length) throw new Error("selector_must_use_key_value_syntax");
  const allowed = new Set(["id", "identifier", "role", "label", "text", "value", "focused", "enabled", "hittable", "editable", "visible"]);
  for (const key of Object.keys(selector)) if (!allowed.has(key)) throw new Error(`unsupported_selector_key:${key}`);
  return selector;
}

function values(node) {
  return {
    id: node.id ?? node.identifier ?? node.accessibilityIdentifier,
    identifier: node.identifier ?? node.id ?? node.accessibilityIdentifier,
    role: node.role ?? node.type ?? node.elementType,
    label: node.label ?? node.name ?? node.accessibilityLabel,
    text: node.text ?? node.title ?? node.value,
    value: node.value,
    focused: node.focused,
    enabled: node.enabled,
    hittable: node.hittable,
    editable: node.editable,
    visible: node.visible
  };
}

export function flattenNodes(root) {
  const out = [];
  const visit = (node, path = []) => {
    if (!node || typeof node !== "object") return;
    if (!Array.isArray(node)) out.push({ node, path, attrs: values(node) });
    for (const [key, child] of Object.entries(node)) {
      if (key === "parent") continue;
      if (Array.isArray(child)) child.forEach((item, index) => visit(item, [...path, `${key}[${index}]`]));
      else if (child && typeof child === "object") visit(child, [...path, key]);
    }
  };
  visit(root);
  return out;
}

function same(actual, expected) {
  if (expected === undefined) return true;
  if (actual === undefined || actual === null) return false;
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

export function resolveUnique(root, selectorInput, { requireActionable = true } = {}) {
  const selector = typeof selectorInput === "string" ? parseSelector(selectorInput) : selectorInput;
  const candidates = flattenNodes(root).filter(({ attrs }) => Object.entries(selector).every(([key, expected]) => same(attrs[key], expected)));
  if (!candidates.length) throw new Error(`target_not_resolved:${JSON.stringify(selector)}`);
  if (candidates.length > 1) throw new Error(`target_ambiguous:${JSON.stringify(selector)}:${candidates.length}`);
  const result = candidates[0];
  if (requireActionable && (result.attrs.visible === false || result.attrs.enabled === false || result.attrs.hittable === false)) {
    throw new Error(`target_not_actionable:${JSON.stringify(selector)}`);
  }
  return { ...result, selector };
}

export function readValue(root, selectorInput) {
  const selector = typeof selectorInput === "string" ? parseSelector(selectorInput) : selectorInput;
  const candidates = flattenNodes(root).filter(({ attrs }) => Object.entries(selector).every(([key, expected]) => same(attrs[key], expected)));
  if (candidates.length !== 1) throw new Error(candidates.length ? "target_ambiguous_on_readback" : "target_not_resolved_on_readback");
  return candidates[0].attrs.value ?? candidates[0].attrs.text ?? null;
}
