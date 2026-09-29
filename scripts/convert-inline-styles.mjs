/* Convert static inline style={{...}} props on host elements to Tailwind classes.
   Usage: node scripts/convert-inline-styles.mjs [--write]
   Default is dry-run (report only). Residual (dynamic/unknown) props stay in style. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const WRITE = process.argv.includes("--write");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIRS = ["app", "components"];
const SAFE_COMPONENTS = new Set(["Link"]); // components that accept className

// ---------- literal helpers -------------------------------------------------

function splitTopLevel(text) {
  const parts = [];
  let depth = 0, cur = "", quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") { cur += ch + (text[i + 1] || ""); i++; continue; }
      if (ch === quote) quote = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; cur += ch; continue; }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    if ((ch === "," || ch === "\n") && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function isStringLiteral(v) {
  return (/^"(?:[^"\\]|\\.)*"$/.test(v) || /^'(?:[^'\\]|\\.)*'$/.test(v));
}
function isNumberLiteral(v) {
  return /^-?\d+(\.\d+)?$/.test(v);
}
function literalValue(v) {
  if (isStringLiteral(v)) return v.slice(1, -1);
  if (isNumberLiteral(v)) return Number(v);
  return undefined; // not a literal
}
function isStatic(v) { return literalValue(v) !== undefined; }

// split `a ? b : c` at top level (string/bracket aware); returns null if not found
function splitTernary(expr) {
  let depth = 0, quote = null, qIdx = -1, colonIdx = -1;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (depth === 0 && ch === "?" && qIdx === -1) qIdx = i;
    else if (depth === 0 && ch === ":" && qIdx !== -1 && colonIdx === -1) colonIdx = i;
  }
  if (qIdx === -1 || colonIdx === -1 || colonIdx < qIdx) return null;
  return {
    cond: expr.slice(0, qIdx).trim(),
    then: expr.slice(qIdx + 1, colonIdx).trim(),
    else: expr.slice(colonIdx + 1).trim(),
  };
}

// ---------- value maps ------------------------------------------------------

const SPACING_UNIT = new Set(["0","0.5","1","1.5","2","2.5","3","3.5","4","5","6","7","8","9","10","11","12","14","16","20","24","28","32","36","40","48","56","64","72","80","96","112","128","144","160","192"]);

function toPx(v) {
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s); // unitless CSS-in-JS numbers are px
  if (/^-?\d+(\.\d+)?px$/.test(s)) return parseFloat(s);
  if (/^-?\d+(\.\d+)?rem$/.test(s)) { const n = parseFloat(s) * 16; return Math.round(n * 100) / 100; }
  return undefined;
}

// Tailwind spacing scale is 0.25rem (4px) units: 12px -> gap-3, 16px -> mb-4.
function spacingCls(prefix, value) {
  const s = String(value).trim();
  if (s === "auto") return `${prefix}-auto`;
  const px = toPx(value);
  if (px === undefined) {
    if (/^-?\d+(\.\d+)?(vw|vh|vmin|vmax)$/.test(s)) return `${prefix}-[${s}]`;
    return null;
  }
  if (px < 0) return null;
  const unit = px / 4;
  const rounded = Math.round(unit * 2) / 2; // allow half steps (6px -> 1.5)
  if (rounded === unit && SPACING_UNIT.has(String(unit))) return `${prefix}-${unit}`;
  return `${prefix}-[${px}px]`;
}

// palette tokens are bare (text-slate-500); arbitrary values keep brackets ([#hex])
function colorCls(prefix, token) {
  if (token === null) return null;
  return `${prefix}-${token}`;
}

const FONT_SIZE_CLASS = { "10": "text-[10px]", "11": "text-[11px]", "12": "text-xs", "13": "text-[13px]", "14": "text-sm", "16": "text-base", "18": "text-lg", "20": "text-xl", "22": "text-[22px]", "24": "text-2xl", "26": "text-[26px]", "28": "text-[28px]", "30": "text-3xl", "36": "text-4xl", "48": "text-5xl" };

function fontSizeCls(v) {
  const px = toPx(v);
  if (px === undefined || px <= 0) return null;
  const key = String(px);
  if (FONT_SIZE_CLASS[key]) return FONT_SIZE_CLASS[key];
  return `text-[${px}px]`;
}

const COLORS = {
  "#fff": "white", "#ffffff": "white", "#000": "black", "#000000": "black", "transparent": "transparent",
  "#f8fafc": "slate-50", "#f1f5f9": "slate-100", "#e2e8f0": "slate-200", "#cbd5e1": "slate-300", "#94a3b8": "slate-400", "#64748b": "slate-500", "#475569": "slate-600", "#334155": "slate-700", "#1e293b": "slate-800", "#0f172a": "slate-900",
  "#dbeafe": "blue-100", "#bfdbfe": "blue-200", "#93c5fd": "blue-300", "#60a5fa": "blue-400", "#3b82f6": "blue-500", "#2563eb": "blue-600", "#1d4ed8": "blue-700", "#1e40af": "blue-800", "#1e3a8a": "blue-900", "#172554": "blue-950",
  "#fef2f2": "red-50", "#fee2e2": "red-100", "#fecaca": "red-200", "#f87171": "red-400", "#ef4444": "red-500", "#dc2626": "red-600", "#b91c1c": "red-700", "#991b1b": "red-800",
  "#f0fdf4": "green-50", "#dcfce7": "green-100", "#bbf7d0": "green-200", "#86efac": "green-300", "#4ade80": "green-400", "#22c55e": "green-500", "#16a34a": "green-600", "#15803d": "green-700", "#166534": "green-800",
  "#fefce8": "yellow-50", "#fef9c3": "yellow-100", "#fde68a": "yellow-200", "#facc15": "yellow-400", "#eab308": "yellow-500", "#ca8a04": "yellow-600", "#a16207": "yellow-700", "#854d0e": "yellow-800",
  "#fffbeb": "amber-50", "#fef3c7": "amber-100", "#fde68aA": "amber-200", "#f59e0b": "amber-500", "#d97706": "amber-600", "#b45309": "amber-700", "#92400e": "amber-800",
  "#f0fdfa": "teal-50", "#ccfbf1": "teal-100", "#14b8a6": "teal-500", "#0f766e": "teal-700", "#115e59": "teal-800",
  "#f0fdf4x": "", "#ecfdf5": "emerald-50", "#d1fae5": "emerald-100", "#a7f3d0": "emerald-200", "#34d399": "emerald-400", "#10b981": "emerald-500", "#059669": "emerald-600", "#047857": "emerald-700", "#065f46": "emerald-800",
  "#fff7ed": "orange-50", "#ffedd5": "orange-100", "#fed7aa": "orange-200", "#fb923c": "orange-400", "#f97316": "orange-500", "#ea580c": "orange-600", "#c2410c": "orange-700", "#9a3412": "orange-800",
  "#fef7ff": "", "#faf5ff": "purple-50", "#f3e8ff": "purple-100", "#e9d5ff": "purple-200", "#d8b4fe": "purple-300", "#c084fc": "purple-400", "#a855f7": "purple-500", "#9333ea": "purple-600", "#7e22ce": "purple-700", "#6b21a8": "purple-800",
  "#fdf2f8": "pink-50", "#fce7f3": "pink-100", "#f9a8d4": "pink-300", "#ec4899": "pink-500", "#db2777": "pink-600",
  "#f9fafb": "gray-50", "#f3f4f6": "gray-100", "#e5e7eb": "gray-200", "#d1d5db": "gray-300", "#9ca3af": "gray-400", "#6b7280": "gray-500", "#4b5563": "gray-600", "#374151": "gray-700", "#1f2937": "gray-800", "#111827": "gray-900",
  "#f8f9fa": "", "#f1f3f5": "", "#dee2e6": "",
};

function colorToken(v) {
  const s = String(v).trim();
  if (s === "white" || s === "black" || s === "transparent" || s === "inherit" || s === "current" || s === "currentColor") return s === "currentColor" ? "current" : s;
  const hex = s.toLowerCase();
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/.test(hex)) {
    if (COLORS[hex]) return COLORS[hex];
    return `[${hex}]`;
  }
  if (/^rgba?\(.*\)$/.test(s.replace(/\s+/g, ""))) return `[${s.replace(/\s+/g, "")}]`;
  return null;
}

const PCT_W = { "100%": "full", "50%": "1/2", "33.333333%": "1/3", "33.333%": "1/3", "25%": "1/4", "20%": "1/5", "75%": "3/4", "66.666667%": "2/3" };

function sizeCls(prefix, v) {
  const s = String(v).trim();
  if (s === "auto") return `${prefix}-auto`;
  if (s === "100vw") return `${prefix}-screen`;
  if (s === "100vh") return `${prefix}-screen`;
  if (s === "fit-content") return `${prefix}-fit`;
  if (s === "max-content") return `${prefix}-max`;
  if (s.endsWith("%")) {
    if (PCT_W[s]) return `${prefix}-${PCT_W[s]}`;
    return `${prefix}-[${s}]`;
  }
  if (s.endsWith("vw")) return `${prefix}-[${s}]`;
  if (s.endsWith("vh")) return `${prefix}-[${s}]`;
  const sp = spacingCls(prefix, s);
  return sp;
}

function sideSpacing(base, v) {
  const s = String(v).trim();
  const parts = s.split(/\s+/);
  const one = (p, pref) => spacingCls(pref, p);
  if (parts.length === 1) return [one(parts[0], base)];
  if (parts.length === 2) return [one(parts[1], `${base}x`), one(parts[0], `${base}y`)];
  if (parts.length === 3) return [one(parts[2], `${base}b`), one(parts[1], `${base}x`), one(parts[0], `${base}t`)];
  if (parts.length === 4) return [one(parts[3], `${base}r`), one(parts[2], `${base}b`), one(parts[1], `${base}l`), one(parts[0], `${base}t`)];
  return [null];
}

const BORDER_R = { "0": "rounded-none", "2": "rounded-sm", "4": "rounded", "6": "rounded-md", "8": "rounded-lg", "10": "rounded-[10px]", "12": "rounded-xl", "14": "rounded-[14px]", "16": "rounded-2xl", "24": "rounded-3xl", "9999": "rounded-full" };

function borderRadiusCls(v) {
  const s = String(v).trim();
  if (s === "9999px" || s === "50%") return "rounded-full";
  if (s.includes(" ")) {
    const parts = s.split(/\s+/);
    if (parts.length >= 2 && parts.length <= 4) {
      const norm = parts.map((p) => { const px = toPx(p); return px === undefined ? null : `${px}px`; });
      if (norm.every(Boolean)) return `rounded-[${norm.join("_")}]`;
    }
    return null;
  }
  const px = toPx(s);
  if (px === undefined) return null;
  if (BORDER_R[String(px)]) return BORDER_R[String(px)];
  if (px > 100) return "rounded-full";
  return `rounded-[${px}px]`;
}

function borderParts(v) {
  const s = String(v).trim();
  if (s === "none") return { width: "border-0" };
  const m = s.match(/^(\d+(?:\.\d+)?(?:px|rem)?)\s+(solid|dashed|dotted|none|double)?\s*(.*)$/);
  if (!m) return {};
  const out = {};
  if (m[2] === "none") return { width: "border-0" };
  const wpx = toPx(m[1]);
  if (wpx === 1) out.width = "border";
  else if (wpx === 2) out.width = "border-2";
  else if (wpx === 0) out.width = "border-0";
  else if (wpx !== undefined) out.width = `border-[${wpx}px]`;
  if (m[2] === "dashed") out.style = "border-dashed";
  if (m[2] === "dotted") out.style = "border-dotted";
  if (m[3]) {
    const tok = colorToken(m[3]);
    const c = colorCls("border", tok);
    if (c) out.color = c;
  }
  return out;
}

// ---------- per-property conversion ----------------------------------------

function clsFor(key, raw) {
  const v = literalValue(raw);
  if (v === undefined) return null;
  const s = typeof v === "string" ? v.trim() : v;

  switch (key) {
    case "padding": case "paddingTop": case "paddingRight": case "paddingBottom": case "paddingLeft": {
      const base = { padding: "p", paddingTop: "pt", paddingRight: "pr", paddingBottom: "pb", paddingLeft: "pl" }[key];
      if (key !== "padding") { const c = spacingCls(base, s); return c ? [c] : null; }
      return sideSpacing("p", s);
    }
    case "margin": case "marginTop": case "marginRight": case "marginBottom": case "marginLeft": case "marginInline": {
      const base = { margin: "m", marginTop: "mt", marginRight: "mr", marginBottom: "mb", marginLeft: "ml", marginInline: "mx" }[key];
      if (key !== "margin") { const c = spacingCls(base, s); return c ? [c] : null; }
      return sideSpacing("m", s);
    }
    case "gap": { const parts = String(s).split(/\s+/); if (parts.length === 2) return [spacingCls("gap-x", parts[1]), spacingCls("gap-y", parts[0])]; const c = spacingCls("gap", s); return c ? [c] : null; }
    case "rowGap": { const c = spacingCls("gap-y", s); return c ? [c] : null; }
    case "columnGap": { const c = spacingCls("gap-x", s); return c ? [c] : null; }
    case "width": { const c = sizeCls("w", s); return c ? [c] : null; }
    case "height": { const c = sizeCls("h", s); return c ? [c] : null; }
    case "minWidth": { if (String(s) === "0") return ["min-w-0"]; const c = sizeCls("min-w", s); return c ? [c] : null; }
    case "maxWidth": { if (s === "none") return ["max-w-none"]; const c = sizeCls("max-w", s); return c ? [c] : null; }
    case "minHeight": { if (String(s) === "0") return ["min-h-0"]; const c = sizeCls("min-h", s); return c ? [c] : null; }
    case "maxHeight": { const c = sizeCls("max-h", s); return c ? [c] : null; }
    case "fontSize": { const c = fontSizeCls(s); return c ? [c] : null; }
    case "fontWeight": {
      const n = String(s);
      const map = { "300": "font-light", "400": "font-normal", "500": "font-medium", "600": "font-semibold", "700": "font-bold", "800": "font-extrabold", "bold": "font-bold", "normal": "font-normal", "lighter": "font-thin", "bolder": "font-extrabold" };
      return map[n] ? [map[n]] : null;
    }
    case "fontStyle": return s === "italic" ? ["italic"] : s === "normal" ? ["not-italic"] : null;
    case "lineHeight": {
      if (s === "normal") return ["leading-normal"];
      const n = Number(s);
      if (n === 1) return ["leading-none"];
      if (n === 1.25) return ["leading-tight"];
      if (n === 1.375) return ["leading-snug"];
      if (n === 1.5) return ["leading-normal"];
      if (n === 1.625) return ["leading-relaxed"];
      if (n === 2) return ["leading-loose"];
      if (!isNaN(n)) return [`leading-[${n}]`];
      return null;
    }
    case "letterSpacing": {
      const map = { "-0.05em": "tracking-tighter", "-0.025em": "tracking-tight", "0em": "tracking-normal", "0px": "tracking-normal", "0.025em": "tracking-wide", "0.05em": "tracking-wider", "0.1em": "tracking-widest" };
      if (map[s]) return [map[s]];
      return /^-?[\d.]+(em|px)$/.test(String(s)) ? [`tracking-[${s}]`] : null;
    }
    case "color": { const t = colorToken(s); const c = colorCls("text", t); return c ? [c] : null; }
    case "background": case "backgroundColor": {
      if (typeof s === "string" && /gradient\(/.test(s)) return [`bg-[${s.replace(/\s+/g, "_")}]`];
      const t = colorToken(s);
      const c = colorCls("bg", t);
      return c ? [c] : null;
    }
    case "border": {
      const p = borderParts(s);
      return [p.width, p.style, p.color].filter(Boolean).length ? [p.width, p.style, p.color].filter(Boolean) : null;
    }
    case "borderTop": case "borderRight": case "borderBottom": case "borderLeft": {
      const side = { borderTop: "t", borderRight: "r", borderBottom: "b", borderLeft: "l" }[key];
      const p = borderParts(s);
      const width = p.width === "border" ? `border-${side}`
        : p.width === "border-2" ? `border-${side}-2`
        : p.width === "border-0" ? `border-${side}-0`
        : p.width;
      const color = p.color ? p.color.replace(/^border-/, `border-${side}-`) : undefined;
      const out = [width, p.style, color].filter(Boolean);
      return out.length ? out : null;
    }
    case "borderColor": { const t = colorToken(s); const c = colorCls("border", t); return c ? [c] : null; }
    case "borderWidth": {
      const px = toPx(s);
      if (px === undefined) return null;
      return [px === 1 ? "border" : px === 2 ? "border-2" : px === 0 ? "border-0" : `border-[${px}px]`];
    }
    case "borderStyle": return s === "dashed" ? ["border-dashed"] : s === "dotted" ? ["border-dotted"] : null;
    case "borderRadius": { const c = borderRadiusCls(s); return c ? [c] : null; }
    case "boxSizing": return s === "border-box" ? ["box-border"] : s === "content-box" ? ["box-content"] : null;
    case "borderCollapse": return s === "collapse" ? ["border-collapse"] : s === "separate" ? ["border-separate"] : null;
    case "display": {
      const map = { flex: "flex", grid: "grid", block: "block", inline: "inline", "inline-block": "inline-block", "inline-flex": "inline-flex", "inline-grid": "inline-grid", none: "none", "table-row": "table-row", "table-cell": "table-cell", contents: "contents" };
      return map[s] ? [map[s]] : null;
    }
    case "position": { const map = { static: "static", fixed: "fixed", absolute: "absolute", relative: "relative", sticky: "sticky" }; return map[s] ? [map[s]] : null; }
    case "top": case "right": case "bottom": case "left": {
      if (s === 0 || s === "0") return [`${key}-0`];
      if (s === "50%") return [`${key}-1/2`];
      if (s === "100%") return [`${key}-full`];
      const c = spacingCls(key, s);
      return c ? [c] : null;
    }
    case "inset": {
      if (s === 0 || s === "0") return ["inset-0"];
      if (s === "auto") return ["inset-auto"];
      return null;
    }
    case "zIndex": { const n = Number(s); if (isNaN(n)) return null; return [10, 20, 30, 40, 50, 0, 1, 5, 100, 1000].includes(n) ? [`z-${n}`] : [`z-[${n}]`]; }
    case "overflow": case "overflowX": case "overflowY": {
      const map = { visible: "visible", hidden: "hidden", auto: "auto", scroll: "scroll", clip: "clip" };
      if (!map[s]) return null;
      if (key === "overflow") return [`overflow-${map[s]}`];
      const axis = key === "overflowX" ? "x" : "y";
      return [`overflow-${axis}-${map[s]}`];
    }
    case "whiteSpace": { const map = { normal: "whitespace-normal", nowrap: "whitespace-nowrap", pre: "whitespace-pre", "pre-wrap": "whitespace-pre-wrap", "pre-line": "whitespace-pre-line" }; return map[s] ? [map[s]] : null; }
    case "textAlign": { const map = { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify", start: "text-start", end: "text-end" }; return map[s] ? [map[s]] : null; }
    case "textDecoration": { const map = { none: "no-underline", underline: "underline", "line-through": "line-through" }; return map[s] ? [map[s]] : null; }
    case "textTransform": { const map = { none: "normal-case", uppercase: "uppercase", lowercase: "lowercase", capitalize: "capitalize" }; return map[s] ? [map[s]] : null; }
    case "textOverflow": { const map = { ellipsis: "text-ellipsis", clip: "text-clip" }; return map[s] ? [map[s]] : null; }
    case "verticalAlign": { const map = { middle: "align-middle", top: "align-top", bottom: "align-bottom", baseline: "align-baseline", "text-top": "align-text-top", "text-bottom": "align-text-bottom" }; return map[s] ? [map[s]] : null; }
    case "cursor": { const map = { pointer: "cursor-pointer", default: "cursor-default", "not-allowed": "cursor-not-allowed", wait: "cursor-wait", move: "cursor-move", text: "cursor-text", grab: "cursor-grab" }; return map[s] ? [map[s]] : null; }
    case "opacity": {
      const n = Number(s);
      if (isNaN(n)) return null;
      const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
      return [`opacity-${pct}`];
    }
    case "flex": {
      if (s === 1 || s === "1") return ["flex-1"];
      if (s === "none") return ["flex-none"];
      if (s === "auto") return ["flex-auto"];
      if (s === "initial") return ["flex-initial"];
      return null;
    }
    case "flexDirection": { const map = { row: "flex-row", column: "flex-col", "row-reverse": "flex-row-reverse", "column-reverse": "flex-col-reverse" }; return map[s] ? [map[s]] : null; }
    case "flexWrap": { const map = { wrap: "flex-wrap", nowrap: "flex-nowrap", "wrap-reverse": "flex-wrap-reverse" }; return map[s] ? [map[s]] : null; }
    case "flexShrink": { if (s === 0 || s === "0") return ["shrink-0"]; if (s === 1 || s === "1") return ["shrink"]; return null; }
    case "flexGrow": { if (s === 0 || s === "0") return ["grow-0"]; if (s === 1 || s === "1") return ["grow"]; return null; }
    case "alignItems": { const map = { "flex-start": "items-start", "flex-end": "items-end", start: "items-start", end: "items-end", center: "items-center", baseline: "items-baseline", stretch: "items-stretch" }; return map[s] ? [map[s]] : null; }
    case "alignSelf": { const map = { "flex-start": "self-start", "flex-end": "self-end", start: "self-start", end: "self-end", center: "self-center", stretch: "self-stretch", auto: "self-auto" }; return map[s] ? [map[s]] : null; }
    case "justifyContent": { const map = { "flex-start": "justify-start", "flex-end": "justify-end", start: "justify-start", end: "justify-end", center: "justify-center", "space-between": "justify-between", "space-around": "justify-around", "space-evenly": "justify-evenly" }; return map[s] ? [map[s]] : null; }
    case "gridTemplateColumns": {
      const str = String(s).trim();
      const rep = str.match(/^repeat\((\d+),\s*1fr\)$/);
      if (rep) return [`grid-cols-${rep[1]}`];
      const map = { "1fr": "grid-cols-1", "1fr 1fr": "grid-cols-2", "1fr 1fr 1fr": "grid-cols-3" };
      if (map[str]) return [map[str]];
      if (str.split(/\s+/).length > 1) return [`grid-cols-[${str.replace(/\s+/g, "_")}]`];
      return null;
    }
    case "gridTemplateRows": {
      const str = String(s).trim();
      const rep = str.match(/^repeat\((\d+),\s*1fr\)$/);
      if (rep) return [`grid-rows-${rep[1]}`];
      return null;
    }
    case "gridColumn": {
      const str = String(s).trim();
      const sp = str.match(/^span\s+(\d+)$/);
      if (sp) return [`col-span-${sp[1]}`];
      if (str === "auto") return ["col-auto"];
      if (str === "1 / -1") return ["col-span-full"];
      return null;
    }
    case "gridRow": {
      const str = String(s).trim();
      const sp = str.match(/^span\s+(\d+)$/);
      if (sp) return [`row-span-${sp[1]}`];
      if (str === "auto") return ["row-auto"];
      return null;
    }
    case "transition": {
      const str = String(s).trim();
      if (str === "none") return ["transition-none"];
      const m = str.match(/^all\s+(\d+(?:\.\d+)?)s(?:\s+[\w-]+)?$/);
      if (m) {
        const ms = Math.round(Number(m[1]) * 1000);
        return ms === 150 ? ["transition"] : ["transition-all", `duration-${ms}`];
      }
      const single = str.match(/^(color|background|background-color|opacity|transform|border-color|box-shadow)\s+(\d+(?:\.\d+)?s)/);
      if (single && (single[1] === "color" || single[1] === "border-color" || single[1] === "background" || single[1] === "background-color")) return ["transition-colors"];
      if (single && single[1] === "box-shadow") return ["transition-shadow"];
      if (single && single[1] === "opacity") return ["transition-opacity"];
      if (single && single[1] === "transform") return ["transition-transform"];
      return null;
    }
    case "fontFamily": {
      const f = String(s).trim().toLowerCase();
      if (f === "monospace") return ["font-mono"];
      if (f === "inherit") return ["font-[inherit]"];
      if (f === "sans-serif" || f.startsWith("system-ui")) return ["font-sans"];
      if (f === "serif") return ["font-serif"];
      return null;
    }
    case "boxShadow": {
      if (s === "none") return ["shadow-none"];
      return [`shadow-[${String(s).replace(/\s+/g, "_")}]`];
    }
    case "backgroundSize": { const map = { cover: "bg-cover", contain: "bg-contain", auto: "bg-auto" }; return map[s] ? [map[s]] : null; }
    case "backgroundRepeat": { const map = { repeat: "bg-repeat", "no-repeat": "bg-no-repeat", "repeat-x": "bg-repeat-x", "repeat-y": "bg-repeat-y" }; return map[s] ? [map[s]] : null; }
    case "backgroundPosition": { const map = { center: "bg-center", top: "bg-top", bottom: "bg-bottom", left: "bg-left", right: "bg-right" }; return map[s] ? [map[s]] : null; }
    case "objectFit": { const map = { cover: "object-cover", contain: "object-contain", fill: "object-fill", none: "object-none", "scale-down": "object-scale-down" }; return map[s] ? [map[s]] : null; }
    case "pointerEvents": { const map = { none: "pointer-events-none", auto: "pointer-events-auto" }; return map[s] ? [map[s]] : null; }
    case "userSelect": { const map = { none: "select-none", all: "select-all", auto: "select-auto" }; return map[s] ? [map[s]] : null; }
    case "visibility": { const map = { visible: "visible", hidden: "invisible" }; return map[s] ? [map[s]] : null; }
    case "float": { const map = { left: "float-left", right: "float-right", none: "float-none" }; return map[s] ? [map[s]] : null; }
    case "clear": { const map = { both: "clear-both", left: "clear-left", right: "clear-right", none: "clear-none" }; return map[s] ? [map[s]] : null; }
    case "outline": { if (s === "none") return ["outline-none"]; return null; }
    case "resize": { const map = { both: "resize-both", vertical: "resize-y", horizontal: "resize-x", none: "resize-none" }; return map[s] ? [map[s]] : null; }
    case "appearance": { if (s === "none") return ["appearance-none"]; return null; }
    case "pointerEvents" : return null;
    default: return null;
  }
}

// ---------- JSX scanning -----------------------------------------------------

function findMatching(text, start, open, close) {
  let depth = 0, quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findTagStart(text, from) {
  let depth = 0;
  for (let i = from - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") depth++;
    else if (ch === "{") depth--;
    else if (ch === "<" && depth <= 0) return i;
  }
  return -1;
}

function findTagEnd(text, from) {
  let depth = 0, quote = null;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    else if (ch === ">" && depth === 0) return i;
  }
  return -1;
}

function mergeClassNameInTag(tagText, classes, condSegments, placeholder) {
  // returns tagText with classes merged into existing/new className
  const clsStr = classes.join(" ");
  const hasCond = condSegments.length > 0;

  const m = tagText.match(/\sclassName=(?:"([^"]*)"|'([^']*)'|\{)/);
  if (!m) {
    const attr = hasCond
      ? ` className={\`${[clsStr, ...condSegments].filter(Boolean).join(" ")}\`}`
      : ` className="${clsStr}"`;
    return tagText.replace(placeholder, attr);
  }
  if (m[1] !== undefined || m[2] !== undefined) {
    const existing = m[1] !== undefined ? m[1] : m[2];
    const q = m[1] !== undefined ? '"' : "'";
    if (!hasCond) {
      const merged = [existing, clsStr].filter(Boolean).join(" ");
      return tagText.replace(new RegExp(`\\sclassName=${q}[^${q}]*${q}`), ` className=${q}${merged}${q}`);
    }
    const expr = [existing, clsStr].filter(Boolean).join(" ");
    const tpl = `${expr} ${condSegments.join(" ")}`.trim();
    return tagText.replace(new RegExp(`\\sclassName=${q}[^${q}]*${q}`), ` className={\`${tpl}\`}`);
  }
  // className={expr}
  const openMatch = tagText.match(/\sclassName=\{/);
  if (!openMatch) return null;
  const braceStart = tagText.indexOf("{", openMatch.index);
  const end = findMatching(tagText, braceStart, "{", "}");
  if (end === -1) return null;
  const inner = tagText.slice(braceStart + 1, end);
  const tail = [clsStr, ...condSegments].filter(Boolean).join(" ");
  const tpl = tail ? `\${${inner}} ${tail}` : `\${${inner}}`;
  return tagText.slice(0, braceStart) + "{`" + tpl + "`}" + tagText.slice(end + 1);
}

function processFile(filePath, results) {
  let text = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(ROOT, filePath);
  let converted = 0;
  let residualObjs = 0;
  const residualKeys = new Set();
  let changed = false;

  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf("style={{", searchFrom);
    if (idx === -1) break;
    const objStart = idx + "style=".length; // points at '{' of {{
    const outerOpen = objStart;
    const outerClose = findMatching(text, outerOpen, "{", "}");
    if (outerClose === -1) { searchFrom = idx + 8; continue; }
    const innerStart = outerOpen + 1; // second {
    // text[innerStart] should be '{'; close of inner is outerClose-1
    if (text[innerStart] !== "{") { searchFrom = idx + 8; continue; }
    const objBody = text.slice(innerStart + 1, outerClose - 1);

    const tagStart = findTagStart(text, idx);
    if (tagStart === -1) { searchFrom = idx + 8; continue; }
    const tagName = (text.slice(tagStart).match(/^<([A-Za-z][\w.]*)/) || [])[1];
    if (!tagName || (/^[A-Z]/.test(tagName) && !SAFE_COMPONENTS.has(tagName))) { searchFrom = outerClose + 1; continue; } // skip components

    const props = splitTopLevel(objBody);
    if (props.some((p) => p.startsWith("..."))) { searchFrom = outerClose + 1; continue; } // spread → untouched

    const classes = [];
    const condMap = new Map(); // cond -> {then:[], else:[]}
    const residual = [];

    for (const prop of props) {
      const kv = prop.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
      if (!kv) { residual.push(prop); continue; }
      const key = kv[1];
      const expr = kv[2].trim();
      if (isStatic(expr)) {
        const c = clsFor(key, expr);
        if (c && c.length && c.every(Boolean)) classes.push(...c);
        else { residual.push(prop); residualKeys.add(key); }
        continue;
      }
      const t = splitTernary(expr);
      if (t) {
        const thenUndef = t.then === "undefined";
        const elseUndef = t.else === "undefined";
        const thenC = thenUndef ? [] : clsFor(key, t.then);
        const elseC = elseUndef ? [] : clsFor(key, t.else);
        if (thenC && elseC && thenC.every(Boolean) && elseC.every(Boolean) && (thenC.length || elseC.length)) {
          if (!condMap.has(t.cond)) condMap.set(t.cond, { then: [], else: [] });
          condMap.get(t.cond).then.push(...thenC);
          condMap.get(t.cond).else.push(...elseC);
          continue;
        }
      }
      residual.push(prop);
      residualKeys.add(key);
    }

    if (classes.length === 0 && condMap.size === 0) {
      // nothing converted
      searchFrom = outerClose + 1;
      if (props.length) { residualObjs++; props.forEach((p) => { const kv = p.match(/^([A-Za-z_$][\w$]*)/); if (kv) residualKeys.add(kv[1]); }); }
      continue;
    }
    if (residual.length > 0) { residualObjs++; }

    // build replacement pieces
    const condSegments = [];
    for (const [cond, arms] of condMap) {
      condSegments.push(`\${${cond} ? "${arms.then.join(" ")}" : "${arms.else.join(" ")}"}`);
    }

    const tagEnd = findTagEnd(text, idx);
    if (tagEnd === -1) { searchFrom = outerClose + 1; continue; }
    const tagText = text.slice(tagStart, tagEnd);
    const relIdx = idx - tagStart; // style= position within tag
    const head = tagText.slice(0, relIdx).replace(/\s+$/, "");
    const afterStyle = outerClose + 1 - tagStart;
    const tail = tagText.slice(afterStyle);
    const placeholder = "__STYLE_MERGE__";
    const residualStyle = residual.length ? ` style={{ ${residual.join(", ")} }}` : "";
    const withPlaceholder = `${head}${placeholder}${residualStyle}${tail}`;
    let mergedTag = mergeClassNameInTag(withPlaceholder, classes, condSegments, placeholder);
    if (mergedTag === null) { searchFrom = outerClose + 1; continue; }
    mergedTag = mergedTag.replace(placeholder, "");

    text = text.slice(0, tagStart) + mergedTag + text.slice(tagEnd);
    converted++;
    changed = true;
    searchFrom = tagStart + mergedTag.length;
  }

  if (changed && WRITE) fs.writeFileSync(filePath, text, "utf8");
  results.set(rel, { converted, residualObjs, residualKeys: [...residualKeys], changed });
}

// ---------- main -------------------------------------------------------------

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = TARGET_DIRS.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : []));
const results = new Map();
for (const f of files) processFile(f, results);

let totalC = 0, totalR = 0;
const allResidual = new Map();
for (const [f, r] of [...results.entries()].sort()) {
  if (!r.changed && r.residualObjs === 0) continue;
  totalC += r.converted;
  totalR += r.residualObjs;
  console.log(`${r.changed ? "CONV" : "----"} ${f}: ${r.converted} converted, ${r.residualObjs} residual`);
  if (r.residualKeys.length) {
    for (const k of r.residualKeys) allResidual.set(k, (allResidual.get(k) || 0) + 1);
  }
}
console.log(`\nTOTAL: ${totalC} style props converted, ${totalR} residual objects`);
console.log("Residual keys:", [...allResidual.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}(${n})`).join(" "));
if (!WRITE) console.log("\n(dry run — pass --write to apply)");
