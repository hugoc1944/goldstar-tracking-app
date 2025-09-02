// scripts/seed-catalog.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/** Utilidade para gerar linhas com ordem e categoria opcional */
function rows(group: string, items: Array<{ label: string; value?: string; category?: string }>) {
  return items.map((it, i) => ({
    group,
    category: it.category ?? null,
    value: (it.value ?? it.label).toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, ''),
    label: it.label,
    sort: i,
    active: true,
  }));
}

async function main() {
  // ========= NOVO: MODELOS =========
  const MODEL = [
    // Diversos
    ...rows('MODEL', [
      { category: 'Diversos', label: '-Diversos-', value: '' },
    ]),
    // Opening Doors
    ...rows('MODEL', [
      { category: 'Opening Doors', label: 'Sterling' },
      { category: 'Opening Doors', label: 'Diplomata Gold' },
      { category: 'Opening Doors', label: 'Diplomata Pivotante' },
      { category: 'Opening Doors', label: 'Painel Gold' },
      { category: 'Opening Doors', label: 'Painel' },
    ]),
    // Sliding Doors
    ...rows('MODEL', [
      { category: 'Sliding Doors', label: 'Splash' },
      { category: 'Sliding Doors', label: 'Strong' },
      { category: 'Sliding Doors', label: 'Algarve' },
      { category: 'Sliding Doors', label: '1/2 Algarve', value: 'MEIO_ALGARVE' },
      { category: 'Sliding Doors', label: 'Meia Lua', value: 'MEIA_LUA' },
      { category: 'Sliding Doors', label: 'Europa' },
      { category: 'Sliding Doors', label: 'Las Vegas' },
      { category: 'Sliding Doors', label: 'Florida' },
      { category: 'Sliding Doors', label: 'Turbo' },
    ]),
    // Folding Doors
    ...rows('MODEL', [
      { category: 'Folding Doors', label: 'Fole AP', value: 'FOLE_AP' },
      { category: 'Folding Doors', label: 'Fole' },
    ]),
    // Fixed
    ...rows('MODEL', [
      { category: 'Fixed', label: 'Painel Fixo' },
      { category: 'Fixed', label: 'Painel Goldstar' },
    ]),
  ];
  // PERFIS
  const PROFILE = rows('PROFILE', [
    { label: '-Diversos-', value: 'DIVERSOS' },
    { label: 'Anodizado' },
    { label: 'Bordeaux' },
    { label: 'Preto Mate' },
    { label: 'Preto Brilho' },
    { label: 'Branco Mate' },
    { label: 'Branco' },
    { label: 'Preto Mate 2' },

    { label: 'Preto' },
    { label: 'Cinza' },
    { label: 'Creme claro' },
    { label: 'Rosa escuro' },
    { label: 'Creme escuro' },
    { label: 'Bronze' },
    { label: 'Castanho' },

    { label: 'Verde Floresta' },
    { label: 'Azul Turquesa' },
    { label: 'Verde Água' },
    { label: 'Vermelho' },
    { label: 'Azul Escuro' },
    { label: 'Azul Claro' },
    { label: 'Amarelo' },

    { label: 'Cromado' },
  ]);

  // ACRÍLICOS E POLICARBONATOS
  const ACRYLIC = rows('ACRYLIC', [
    { label: '-Diversos-', value: 'DIVERSOS' },
    { label: 'Policarbonato 1' },
    { label: 'Policarbonato 2' },
    { label: 'Água Viva' },
    { label: 'Trevo Cristal' },
    { label: 'Teide Cristal' },
  ]);

  // SERIGRAFIAS (com categorias)
  const SERIGRAPHY = [
    ...rows('SERIGRAPHY', [{ label: '-Diversos-', value: 'DIVERSOS' }]),
    ...rows('SERIGRAPHY', [
      { category: 'Coleção Prime', label: 'SER001', value: 'SER001' },
      { category: 'Coleção Prime', label: 'SER002', value: 'SER002' },
      { category: 'Coleção Prime', label: 'SER003', value: 'SER003' },
      { category: 'Coleção Prime', label: 'SER004', value: 'SER004' },
      { category: 'Coleção Prime', label: 'SER005', value: 'SER005' },
      { category: 'Coleção Prime', label: 'SER006', value: 'SER006' },
      { category: 'Coleção Prime', label: 'SER007', value: 'SER007' },
      { category: 'Coleção Prime', label: 'SER008', value: 'SER008' },
      { category: 'Coleção Prime', label: 'SER009', value: 'SER009' },
      { category: 'Coleção Prime', label: 'SER010', value: 'SER010' },
      { category: 'Coleção Prime', label: 'SER011', value: 'SER011' },
      { category: 'Coleção Prime', label: 'SER012', value: 'SER012' },
    ]),
    ...rows('SERIGRAPHY', [
      { category: 'Coleção Quadros', label: '-Diversos-', value: 'QUADROS_DIVERSOS' },
      { category: 'Coleção Quadros', label: 'Quadro 1', value: 'QUADRO_1' },
      { category: 'Coleção Quadros', label: 'Quadro 2', value: 'QUADRO_2' },
      { category: 'Coleção Quadros', label: 'Quadro 3', value: 'QUADRO_3' },
    ]),
    ...rows('SERIGRAPHY', [{ label: 'Sereno', value: 'SERENO' }]),
    ...rows('SERIGRAPHY', [
      { category: 'Coleção Elo Abstrato', label: '-Diversos-', value: 'ELO_ABSTRATO_DIVERSOS' },
      { category: 'Coleção Elo Abstrato', label: 'Elo 1', value: 'ELO_1' },
      { category: 'Coleção Elo Abstrato', label: 'Elo 2', value: 'ELO_2' },
      { category: 'Coleção Elo Abstrato', label: 'Elo 3', value: 'ELO_3' },
      { category: 'Coleção Elo Abstrato', label: 'Elo 4', value: 'ELO_4' },
    ]),
  ];

  // MONOCROMÁTICOS
  const MONOCHROME = rows('MONOCHROME', [
    { label: '-Diversos-', value: 'DIVERSOS' },
    { label: 'Preto' },
    { label: 'Branco' },
    { label: 'Vermelho' },
    { label: 'Verde' },
    { label: 'Amarelo' },
    { label: 'Laranja' },
  ]);

  // MONOCROMÁTICOS
  const COMPLEMENT = rows('COMPLEMENT', [
    { label: '-Diversos-', value: 'DIVERSOS' },
    { label: 'Toalheiro Vision' },
    { label: 'Toalheiro' },
    { label: 'Prateleira' },
  ]);

  // Upsert em massa
  const all = [...MODEL, ...PROFILE, ...ACRYLIC, ...SERIGRAPHY, ...MONOCHROME, ...COMPLEMENT];

  for (const r of all) {
    await prisma.catalogOption.upsert({
      where: { group_value: { group: r.group, value: r.value } } as any, // comp. unique abaixo
      update: { label: r.label, sort: r.sort, active: true, category: r.category },
      create: r,
    });
  }
}

main()
  .then(async () => {
    console.log('Catalog seeded');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
