// lib/zod-budget.ts
import { z } from 'zod';

const SerColorEnum = z.enum(['padrao', 'acabamento']);
const FixBarModeEnum = z.enum(['padrao', 'acabamento']);
const DualColorModeEnum = z.enum(['padrao', 'acabamento']);

// helper for optional integers coming from forms / json
const NumOpt = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.number().int().optional()
);

/**
 * This schema must match what the public page sends.
 * Fields like barColor / visionSupport are OPTIONAL here
 * and become required only when complemento === 'vision'.
 * Similar conditional rules for toalheiro1 / prateleira.
 */
export const BudgetCreateSchema = z.object({
  // Cliente
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  nif: z.string().optional(),
  address: z.string().min(1, 'Morada é obrigatória'),
  postalCode: z.string().min(1, 'Código postal é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),

  // Escolhas
  modelKey: z.string().min(1),
  handleKey: z.string().optional(), // cleared if rule.hideHandles == true
  finishKey: z.string().min(1),

  // Vision-only base fields — optional here; enforced below
  barColor: z.string().optional(),
  visionSupport: z.string().optional(),

  glassTypeKey: z.string().min(1),
  acrylicKey: z.string().optional(),

  serigrafiaKey: z.string().optional(),      // 'nenhum' or a code
  serigrafiaColor: z.string().optional(),

  fixingBarMode: FixBarModeEnum.optional(),  // only if model rule hasFixingBar

  complementos: z.array(z.string()).default([]),
  launchBonus: z.enum(['shampooGOLDSTAR','gelGOLDSTAR']).default('shampooGOLDSTAR'),

  // legacy/extra toggles (optional)
  visionBar: z.string().optional(),
  towelColorMode: DualColorModeEnum.optional(), // when complemento === 'toalheiro1'
  shelfColorMode: DualColorModeEnum.optional(), // when complemento === 'prateleira'
  shelfHeightPct: z.number().int().min(20).max(100).optional(), 

  cornerChoice: z.string().optional(),
  cornerColorMode: z.string().optional(),

  // Medidas
  widthMm: NumOpt,
  heightMm: NumOpt,
  depthMm: NumOpt,
  willSendLater: z.boolean().default(false),

  // Logística
  deliveryType: z.string().min(1), // 'entrega' | 'instalacao'
  housingType: z.string().optional(),
  floorNumber: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.number().int().optional()
  ),
  hasElevator: z.boolean().optional(),

  // Fotos
  photoUrls: z.array(z.string().url()).optional(),

  // Observações
  notes: z.string().optional(),
})
.superRefine((val, ctx) => {
  // Medidas: width/height required unless "willSendLater" is true
  if (!val.willSendLater) {
    if (!val.widthMm || val.widthMm <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Insira uma medida', path: ['widthMm'] });
    }
    if (!val.heightMm || val.heightMm <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Insira uma medida', path: ['heightMm'] });
    }
  }

  // Vision-only requirements
  if (val.complementos.includes('vision')) {
    if (!val.barColor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['barColor'] });
    }
    if (!val.visionSupport) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['visionSupport'] });
    }
  }

  // Toalheiro 1 requirement
  if (val.complementos.includes('toalheiro1')) {
    if (!val.towelColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Toalheiro 1.', path: ['towelColorMode'] });
    }
  }

  // Prateleira de Canto requirement
  if (val.complementos.includes('prateleira')) {
    if (!val.shelfColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Prateleira de Canto.', path: ['shelfColorMode'] });
    }
  }

   if (val.serigrafiaKey && val.serigrafiaKey !== 'nenhum') {
      const c = (val.serigrafiaColor ?? '').trim().toLowerCase();
      if (!c) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Escolha a cor da serigrafia.',
          path: ['serigrafiaColor'],
        });
      } else if (c === 'anodizado' || c === 'cromado') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cor indisponível para serigrafia.',
          path: ['serigrafiaColor'],
        });
      }
    }
});

export type BudgetCreate = z.infer<typeof BudgetCreateSchema>;

export const BudgetUpdateSchema = BudgetCreateSchema.partial().extend({
  priceCents: z.number().int().nonnegative().optional(),
  installPriceCents: z.number().int().nonnegative().optional(),
  quotedPdfUrl: z.string().url().optional(),
});
export type BudgetUpdateInput = z.infer<typeof BudgetUpdateSchema>;