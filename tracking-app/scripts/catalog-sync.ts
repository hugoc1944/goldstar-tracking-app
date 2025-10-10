/* scripts/catalog-sync.ts
   Sync Simulator catalog -> Tracking DB CatalogOption + ModelRule
   Run:
     - Dry-run:  npx tsx scripts/catalog-sync.ts
     - Apply:    npx tsx scripts/catalog-sync.ts --apply
*/

import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PrismaClient, CatalogGroup } from '@prisma/client';

const prisma = new PrismaClient();

function titleCase(s: string) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function readJSON<T>(relPath: string): Promise<T> {
  const file = path.resolve(process.cwd(), 'catalog-snapshots', relPath);
  return JSON.parse(await fs.readFile(file, 'utf8')) as T;
}
// If you have glassCatalog.ts (types & names), feel free to import it too.

/** Public assets root (inside tracking app repo or point to your simulator repo) */
const PUBLIC_ROOT = path.resolve(process.cwd(), 'public'); // change if your assets live elsewhere



// ====== MAPPINGS YOU CAN TUNE ======

// Handles list — if your simulator exposes this as data, import & use that instead
const HANDLE_OPTIONS = [
  { value: 'sem', label: 'Sem Puxador' }, // keep first so it shows at top
  { value: 'h1', label: 'Puxador 1' },
  { value: 'h2', label: 'Puxador 2' },
  { value: 'h3', label: 'Puxador 3' },
  { value: 'h4', label: 'Puxador 4' },
  { value: 'h5', label: 'Puxador 5' },
  { value: 'h6', label: 'Puxador 6' },  // default for correr
  { value: 'h7', label: 'Puxador 7' },
  { value: 'h8', label: 'Puxador 8' },  // Strong only
];

// Complementos
const COMPLEMENTO_OPTIONS = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'vision', label: 'Toalheiro Vision' },
  { value: 'toalheiro1', label: 'Toalheiro 1' },
  { value: 'prateleira', label: 'Prateleira de Canto' },
];

// Vision bars (fixed set)
const VISION_BARS = [
  { value: 'acrilico_transparente', label: 'Acrílico Transparente' },
  { value: 'branco_mate', label: 'Branco Mate' },
  { value: 'preto_mate', label: 'Preto Mate' },
];

// Glass types (base)
const GLASS_TIPOS = [
  { value: 'transparente', label: 'Transparente' },
  { value: 'fosco',        label: 'Fosco' },
];

// Monochromes (tinted)
const MONOS = [
  { value: 'mono_bronze', label: 'Monocromático — Bronze' },
  { value: 'mono_gris',   label: 'Monocromático — Gris' },
  { value: 'mono_verde',  label: 'Monocromático — Verde' },
    // Add textured/etched here as “types”, not monochromes:
  { value: 'visiosun',     label: 'Monocromático — Visiosun' },
  { value: 'flutes',       label: 'Monocromático — Flutes' },
  // add more if your glassCatalog has them
];

// Acrylic & Polycarbonate (base; optionally expand by scanning /public)
const ACRYLICS = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'agua_viva', label: 'Agua Viva' },
  { value: 'policarbonato_transparente', label: 'Policarbonato Transparente' },
  { value: 'policarbonato_branco', label: 'Policarbonato Branco' },
  // add project-specific SKUs if you don’t want to scan directories
];


// Helper: upsert option
async function upsertOption(
  group: CatalogGroup,
  value: string,
  label: string,
  order = 0,
  category?: string
) {
  await prisma.catalogOption.upsert({
    where: { group_value: { group, value } }, // requires @@unique([group, value])
    update: { label, order, category, active: true },
    create: { group, value, label, order, category, active: true },
  });
}

// Read files in a folder into options (value = filename stem)
async function scanToOptions(subdir: string, labelPrefix?: string) {
  const root = path.join(PUBLIC_ROOT, subdir);
  try {
    const entries = await fg(['*.{png,jpg,jpeg,webp,svg}'], { cwd: root, onlyFiles: true });
    const items = entries
      .map((f) => path.parse(f).name)
      .filter((n) => !!n)
      .map((stem, i) => ({
        value: stem.toLowerCase(),
        label: labelPrefix ? `${labelPrefix} ${stem.toUpperCase()}` : stem.toUpperCase(),
        order: i + 1,
      }));
    return items;
  } catch {
    return [];
  }
}
async function scanSilksAll() {
  const root = path.join(PUBLIC_ROOT, 'silks');
  const files = await fg(['**/*.{png,jpg,jpeg,webp,svg}'], { cwd: root, onlyFiles: true });

  const prime: { value: string; label: string; order: number }[] = [];
  const quadros: { value: string; label: string; order: number }[] = [];
  const elo: { value: string; label: string; order: number }[] = [];

  let iPrime = 1, iQuadros = 1, iElo = 1;

  for (const rel of files) {
    const stem = path.parse(rel).name;         // filename without extension
    const value = stem.toLowerCase();          // DB key

    if (/^ser/i.test(stem)) {
      prime.push({ value, label: fmtSerLabel(stem), order: iPrime++ });
    } else if (/^quadro/i.test(stem)) {
      quadros.push({ value, label: fmtQuadroLabel(stem), order: iQuadros++ });
    } else {
      const label = stem.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      elo.push({ value, label, order: iElo++ });
    }
  }

  // Order: SER 001.., Quadro…, Elo… alpha
  prime.sort((a, b) => a.order - b.order);
  quadros.sort((a, b) => a.order - b.order);
  elo.sort((a, b) => a.label.localeCompare(b.label, 'pt'));

  return { prime, quadros, elo };
}


type Rule = {
  hideHandles?: boolean;
  removeFinishes?: string[];
  allowAcrylicAndPoly?: boolean;
  allowTowel1?: boolean;
  hasFixingBar?: boolean;
};
type ModelEntry = {
  key: string;
  label: string;
  comingSoon?: boolean;
  rule?: Rule;
};
type FinishItem = { value: string; label: string };
type FinishSets = { metalicos: FinishItem[]; lacados: FinishItem[] };

export async function readSimulatorModels(): Promise<ModelEntry[]> {
  const raw = await readJSON<any>('modelCatalog.json');

  const catalog: any[] = Array.isArray(raw?.MODEL_CATALOG)
    ? raw.MODEL_CATALOG
    : [];

  const out: ModelEntry[] = [];

  for (const entry of catalog) {
    const section = entry.section as string | undefined;
    const baseName = entry.baseName as string | undefined;
    const baseRules = entry.rules ?? {};
    const variants: any[] = Array.isArray(entry.variants) ? entry.variants : [];

    for (const v of variants) {
      // Example variant name: "Europa_V2"
      const vName: string = v.name ?? '';
      if (!vName) continue;

      // Key convention → lowercase with underscores converted to lowercase
      const key = vName.toLowerCase(); // e.g., "europa_v2"

      // Label: prefer explicit variant label, then "<Base> Variação N", fallback to vName
      const explicit = v.label && String(v.label).trim();
      let label: string;
      if (explicit) {
        label = String(explicit);
      } else if (baseName) {
        // Try to pull V number:
        const match = vName.match(/_v(\d+)$/i);
        const n = match ? Number(match[1]) : undefined;
        label = n ? `${baseName} Variação ${n}` : `${baseName} ${vName}`;
      } else {
        label = vName;
      }

      const comingSoon = !!(v.comingSoon || entry.comingSoon);

      // Merge rules: variant.rules overrides entry.rules
      const vrules = { ...(entry.rules ?? {}), ...(v.rules ?? {}) };

      // Map to ModelRule fields used in tracking app
      const hideHandles = !!vrules.hideHandles;
      const removeFinishes = Array.isArray(vrules.removeFinishes)
        ? vrules.removeFinishes.map((s: string) => s.toLowerCase())
        : [];

      // The simulator often uses `hideAcrylics`; Europa allows acrylic/poly (not hidden)
      // If hideAcrylics === true => we DO NOT allow; else allow.
      const hideAcrylics = !!vrules.hideAcrylics;
      const allowRack1 = !!vrules.allowRack1; // your Strong/Europa rules, etc.
      const hasFixingBar = !!vrules.hasFixingBar;
      const allowAcrylicAndPoly = !hideAcrylics;

      out.push({
        key,
        label,
        comingSoon,
        rule: {
          hideHandles,
          removeFinishes,
          allowAcrylicAndPoly,
          allowTowel1: allowRack1,
          hasFixingBar,
        },
      });
    }
  }

  return out;
}

function pad3(n: string | number) {
  const s = String(n).replace(/\D/g, '');
  return s.padStart(3, '0');
}
function fmtSerLabel(stem: string) {
  // "SER001", "ser-1", "ser_12" -> "SER 001"
  const m = stem.match(/ser[\s\-_]*(\d+)/i);
  return m ? `SER ${pad3(m[1])}` : stem.toUpperCase();
}
function fmtQuadroLabel(stem: string) {
  // Keep "Quadro 1" style
  const base = stem.replace(/[_-]+/g, ' ');
  return /^quadro/i.test(base) ? base.replace(/^quadro/i, 'Quadro') : `Quadro ${base}`;
}

export async function readFinishes(): Promise<FinishSets> {
  const data = await readJSON<any>('finishes.json');

  const all: string[] = Array.isArray(data?.FINISHES) ? data.FINISHES : [];
  const meta: Record<string, any> = data?.FINISH_META ?? {};

  // 1) Hard override: only these two are metálico at Goldstar
  const METAL_OVERRIDE = new Set(['anodizado', 'cromado']);

  // 2) Secondary: try to infer from metadata (if present)
  const isMetalByMeta = (name: string) => {
    const m = meta[name] ?? meta[capitalize(name)];
    if (!m || typeof m !== 'object') return false;

    const toLower = (x: any) => (typeof x === 'string' ? x.toLowerCase() : x);
    const kind = toLower(m.kind) ?? toLower(m.type) ?? toLower(m.category);
    if (kind === 'metalico' || kind === 'metálico' || kind === 'metallic') return true;

    const tags: string[] = Array.isArray(m.tags) ? m.tags.map((t: any) => String(t).toLowerCase()) : [];
    return tags.includes('metalico') || tags.includes('metálico') || tags.includes('metallic');
  };

  const metalicos: FinishItem[] = [];
  const lacados:   FinishItem[] = [];

  for (const name of all) {
    const value = name.toLowerCase();
    const label = name;

    const isMetal =
      METAL_OVERRIDE.has(value) // <- primary rule
      || isMetalByMeta(name);   // <- secondary hint (safe, but won’t override the two above)

    (isMetal ? metalicos : lacados).push({ value, label });
  }

  // Keep a nice order: Anodizado, Cromado, then alpha
  metalicos.sort((a, b) => {
    const pref = ['anodizado', 'cromado'];
    const ai = pref.indexOf(a.value);
    const bi = pref.indexOf(b.value);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.label.localeCompare(b.label, 'pt');
  });
  lacados.sort((a, b) => a.label.localeCompare(b.label, 'pt'));

  return { metalicos, lacados };
}

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const models = await readSimulatorModels();
  const fins   = await readFinishes();

  const plan: string[] = [];

  // 1) MODELS
  models.forEach((m, i) => {
    plan.push(`MODEL: ${m.key} (${m.label}) ${m.comingSoon ? '[coming-soon]' : ''}`);
  });

  // 2) HANDLES
  HANDLE_OPTIONS.forEach((h, i) => plan.push(`HANDLE: ${h.value}`));

  // 3) FINISHES
  fins.metalicos.forEach((f, i) => plan.push(`FINISH_METALICO: ${f.value}`));
  fins.lacados.forEach((f, i) => plan.push(`FINISH_LACADO: ${f.value}`));

  // 4) GLASS
  GLASS_TIPOS.forEach((g, i) => plan.push(`GLASS_TIPO: ${g.value}`));
  MONOS.forEach((m, i) => plan.push(`MONOCROMATICO: ${m.value}`));

  // 5) ACRYLIC & POLI
  ACRYLICS.forEach((a, i) => plan.push(`ACRYLIC_AND_POLICARBONATE: ${a.value}`));

  // 6) COMPLEMENTO & VISION_BAR_COLOR
  COMPLEMENTO_OPTIONS.forEach((c, i) => plan.push(`COMPLEMENTO: ${c.value}`));
  VISION_BARS.forEach((v, i) => plan.push(`VISION_BAR_COLOR: ${v.value}`));

  // 7) SERIGRAFIAS from /public
  const { prime, quadros, elo } = await scanSilksAll();

  prime.forEach((s)  => plan.push(`SERIGRAFIA_PRIME: ${s.value} (${s.label})`));
  quadros.forEach((s)=> plan.push(`SERIGRAFIA_QUADROS: ${s.value} (${s.label})`));
  elo.forEach((s)   => plan.push(`SERIGRAFIA_ELO_SERENO: ${s.value} (${s.label})`));


  
  if (!apply) {
    console.log('--- DRY RUN (nothing written) ---');
    console.log(plan.join('\n'));
    console.log('\nRun with --apply to write to DB.');
    return;
  }

  // ====== APPLY (UPSERTS) ======

  // MODELS
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    await upsertOption(CatalogGroup.MODEL, m.key, m.label, i + 1, m.comingSoon ? 'coming_soon' : undefined);
    // ModelRule
    await prisma.modelRule.upsert({
      where: { modelKey: m.key },
      update: {
        hideHandles: !!m.rule?.hideHandles,
        removeFinishes: m.rule?.removeFinishes ?? [],
        allowAcrylicAndPoly: !!m.rule?.allowAcrylicAndPoly,
        allowTowel1: !!m.rule?.allowTowel1,
        hasFixingBar: !!m.rule?.hasFixingBar,
      },
      create: {
        modelKey: m.key,
        hideHandles: !!m.rule?.hideHandles,
        removeFinishes: m.rule?.removeFinishes ?? [],
        allowAcrylicAndPoly: !!m.rule?.allowAcrylicAndPoly,
        allowTowel1: !!m.rule?.allowTowel1,
        hasFixingBar: !!m.rule?.hasFixingBar,
      },
    });
  }

  // HANDLES
  for (let i = 0; i < HANDLE_OPTIONS.length; i++) {
    const h = HANDLE_OPTIONS[i];
    await upsertOption(CatalogGroup.HANDLE, h.value, h.label, i);
  }

  // FINISHES
  for (let i = 0; i < fins.metalicos.length; i++) {
    const f = fins.metalicos[i];
    await upsertOption(CatalogGroup.FINISH_METALICO, f.value, f.label, i + 1);
  }
  for (let i = 0; i < fins.lacados.length; i++) {
    const f = fins.lacados[i];
    await upsertOption(CatalogGroup.FINISH_LACADO, f.value, f.label, i + 1);
  }

  // GLASS
  for (let i = 0; i < GLASS_TIPOS.length; i++) {
    const g = GLASS_TIPOS[i];
    await upsertOption(CatalogGroup.GLASS_TIPO, g.value, g.label, i + 1);
  }
  for (let i = 0; i < MONOS.length; i++) {
    const m = MONOS[i];
    await upsertOption(CatalogGroup.MONOCROMATICO, m.value, m.label, i + 1);
  }

  // ACRYLIC/POLI
  for (let i = 0; i < ACRYLICS.length; i++) {
    const a = ACRYLICS[i];
    await upsertOption(CatalogGroup.ACRYLIC_AND_POLICARBONATE, a.value, a.label, i + 1);
  }

  // COMPLEMENTO & VISION BARS
  for (let i = 0; i < COMPLEMENTO_OPTIONS.length; i++) {
    const c = COMPLEMENTO_OPTIONS[i];
    await upsertOption(CatalogGroup.COMPLEMENTO, c.value, c.label, i + 1);
  }
  for (let i = 0; i < VISION_BARS.length; i++) {
    const v = VISION_BARS[i];
    await upsertOption(CatalogGroup.VISION_BAR_COLOR, v.value, v.label, i + 1);
  }
  // Silks
  for (const s of prime)   await upsertOption(CatalogGroup.SERIGRAFIA_PRIME, s.value, s.label, s.order);
  for (const s of quadros) await upsertOption(CatalogGroup.SERIGRAFIA_QUADROS, s.value, s.label, s.order);
  for (const s of elo)     await upsertOption(CatalogGroup.SERIGRAFIA_ELO_SERENO, s.value, s.label, s.order);

}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
