// Checks that every icon name declared in pages/IconPicker.jsx is a real export
// of @mui/icons-material, and that the local identifier matches the import.
//
// The picker cannot read names off the components (MUI never sets displayName),
// so the names are written by hand. That is only safe if something verifies
// them — a typo produces an import that fails the build, or worse, an export
// block that the user pastes into the nav data.
//
// Usage: node scripts/verify-icon-picker-names.js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as icons from "@mui/icons-material";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "pages", "IconPicker.jsx"), "utf8");
const imported = new Map();

// `ic("Name", Ident)` — the declared name and the local binding, in order.
const declared = [...src.matchAll(/\bic\("([A-Za-z0-9_]+)",\s*([A-Za-z0-9_]+)\)/g)].map(
  (m) => ({ name: m[1], ident: m[2] }),
);

// Which local bindings were actually imported, and under what name.
const importBlock = src.slice(0, src.indexOf("const STORAGE_KEY"));

// Named group: `import { A, B as C, ... } from "@mui/icons-material"`
for (const m of importBlock.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@mui\/icons-material"/g)) {
  for (const part of m[1].split(",")) {
    const bits = part.trim().split(/\s+as\s+/).filter(Boolean);
    if (bits.length) imported.set(bits[0], bits[bits.length - 1]);
  }
}
// Default import: `import Foo from "@mui/icons-material/Foo"`
for (const m of importBlock.matchAll(
  /import\s+([A-Za-z0-9_$]+)\s+from\s*"@mui\/icons-material\/([A-Za-z0-9_$]+)"/g,
)) {
  imported.set(m[1], m[2]);
}

const problems = [];
for (const { name, ident } of declared) {
  if (!(name in icons)) {
    problems.push(`"${name}" is not exported by @mui/icons-material`);
  }
  if (!imported.has(ident)) {
    problems.push(`${ident} (for "${name}") is not imported in IconPicker.jsx`);
  } else if (imported.get(ident) !== name) {
    problems.push(`${ident} is imported as "${imported.get(ident)}" but declared as "${name}"`);
  }
}

// The same icon is deliberately offered in several slots (MenuBook reads as both
// "syllabus" and "books"), so uniqueness only has to hold *within* one list.
const slotBodies = src.split(/^  \w+: \{$/m).slice(1);
for (const body of slotBodies) {
  const inSlot = [...body.matchAll(/\bic\("([A-Za-z0-9_]+)",/g)].map((m) => m[1]);
  const seen = new Set();
  for (const n of inSlot) {
    if (seen.has(n)) problems.push(`"${n}" appears twice in one slot's candidate list`);
    seen.add(n);
  }
}

console.log(`checked ${declared.length} icon names across ${slotBodies.length} slots`);
if (problems.length) {
  console.error("\nFAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("OK - every declared name is a real barrel export and matches its import");
