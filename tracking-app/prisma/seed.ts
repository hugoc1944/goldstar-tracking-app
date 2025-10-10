import { PrismaClient, CatalogGroup } from '@prisma/client';
const prisma = new PrismaClient();

async function upsertOption(group: CatalogGroup, value: string, label: string, order = 0, category?: string) {
  await prisma.catalogOption.upsert({
    where: { group_value: { group, value } }, // relies on @@unique([group, value])
    update: { label, order, category },
    create: { group, value, label, order, category },
  });
}

async function seedNenhum() {
  // Complemento “Nenhum”
  await upsertOption(CatalogGroup.COMPLEMENTO, 'nenhum', 'Nenhum', 0);

  // Acrylic/Poly “Nenhum”
  await upsertOption(CatalogGroup.ACRYLIC_AND_POLICARBONATE, 'nenhum', 'Nenhum', 0);

  // Serigrafia collections “Nenhum”
  await upsertOption(CatalogGroup.SERIGRAFIA_PRIME, 'nenhum', 'Nenhum', 0);
  await upsertOption(CatalogGroup.SERIGRAFIA_QUADROS, 'nenhum', 'Nenhum', 0);
  await upsertOption(CatalogGroup.SERIGRAFIA_ELO_SERENO, 'nenhum', 'Nenhum', 0);
}

async function seedVisionBars() {
  await upsertOption(CatalogGroup.VISION_BAR_COLOR, 'acrilico_transparente', 'Acrílico Transparente', 1);
  await upsertOption(CatalogGroup.VISION_BAR_COLOR, 'branco_mate', 'Branco Mate', 2);
  await upsertOption(CatalogGroup.VISION_BAR_COLOR, 'preto_mate', 'Preto Mate', 3);
}

async function seedFinishesSplit() {
  // If you previously had CatalogGroup.FINISH entries, copy/split them:
  // Metalicos
  await upsertOption(CatalogGroup.FINISH_METALICO, 'anodizado', 'Anodizado', 1);
  await upsertOption(CatalogGroup.FINISH_METALICO, 'cromado', 'Cromado', 2);

  // Lacados — add the ones you actually support; examples:
  const lacados = [
    ['lacado_branco', 'Lacado Branco'],
    ['lacado_preto', 'Lacado Preto'],
    ['lacado_ouro', 'Lacado Ouro'],
    // ... add the rest
  ] as const;
  for (let i = 0; i < lacados.length; i++) {
    const [value, label] = lacados[i];
    await upsertOption(CatalogGroup.FINISH_LACADO, value, label, i + 1);
  }
}

async function seedGlassGroups() {
  // Types
  await upsertOption(CatalogGroup.GLASS_TIPO, 'transparente', 'Transparente', 1);
  await upsertOption(CatalogGroup.GLASS_TIPO, 'fosco', 'Fosco', 2);

  // Monochromatics (examples — align with your simulator)
  const monos = [
    ['mono_bronze', 'Monocromático — Bronze'],
    ['mono_fume', 'Monocromático — Fumé'],
    ['mono_verde', 'Monocromático — Verde'],
  ] as const;
  for (let i = 0; i < monos.length; i++) {
    const [value, label] = monos[i];
    await upsertOption(CatalogGroup.MONOCROMATICO, value, label, i + 1);
  }
}

async function seedModelRules() {
  // Mirror the simulator behavior; extend as needed:

  // Europa (V1–V4): remove Cromado, hide handles, allow acrylic/poli, allow Toalheiro1
  for (const v of [1,2,3,4]) {
    await prisma.modelRule.upsert({
      where: { modelKey: `europa_v${v}` },
      update: {},
      create: {
        modelKey: `europa_v${v}`,
        hideHandles: true,
        removeFinishes: ['cromado'],
        allowAcrylicAndPoly: true,
        allowTowel1: true,
      },
    });
  }

  // Strong (V1–V4): remove Cromado, hide acrylics in sim (here: do NOT allow acrylic/poli)
  for (const v of [1,2,3,4]) {
    await prisma.modelRule.upsert({
      where: { modelKey: `strong_v${v}` },
      update: {},
      create: {
        modelKey: `strong_v${v}`,
        hideHandles: false,
        removeFinishes: ['cromado'],
        allowAcrylicAndPoly: false,
        allowTowel1: false,
      },
    });
  }

  // Painel Fixo V1: remove Cromado, no handles, allow Toalheiro1
  await prisma.modelRule.upsert({
    where: { modelKey: 'painel_fixo_v1' },
    update: {},
    create: {
      modelKey: 'painel_fixo_v1',
      hideHandles: true,
      removeFinishes: ['cromado'],
      allowAcrylicAndPoly: false,
      allowTowel1: true,
    },
  });

  // Painel (GOLDSTAR) V1: variant hides handles
  await prisma.modelRule.upsert({
    where: { modelKey: 'painel_v1' },
    update: {},
    create: {
      modelKey: 'painel_v1',
      hideHandles: true,
      removeFinishes: ['cromado'],
      allowAcrylicAndPoly: false,
      allowTowel1: true,
    },
  });

  // Sterling (V1–V4): allow handles, no acrylic/poli
  for (const v of [1,2,3,4]) {
    await prisma.modelRule.upsert({
      where: { modelKey: `sterling_v${v}` },
      update: {},
      create: {
        modelKey: `sterling_v${v}`,
        hideHandles: false,
        removeFinishes: [],
        allowAcrylicAndPoly: false,
        allowTowel1: false,
      },
    });
  }

  // DiplomataGold (V1–V10): no acrylic/poli; (V9 hides handles 5–7 — that’s UI-level, keep removeFinishes = [])
  for (const v of [1,2,3,4,5,6,7,8,9,10]) {
    await prisma.modelRule.upsert({
      where: { modelKey: `diplomatagold_v${v}` },
      update: {},
      create: {
        modelKey: `diplomatagold_v${v}`,
        hideHandles: false,
        removeFinishes: [],
        allowAcrylicAndPoly: false,
        allowTowel1: false,
      },
    });
  }
}

async function main() {
  await seedNenhum();
  await seedVisionBars();
  await seedFinishesSplit();
  await seedGlassGroups();
  await seedModelRules();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
