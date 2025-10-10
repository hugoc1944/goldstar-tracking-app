export type CatItem = { value: string; label: string; order?: number; category?: string };
export type Catalog = Record<string, CatItem[]>;

export type ModelRuleDTO = {
  modelKey: string;
  hideHandles: boolean;
  removeFinishes: string[];          // lowercased values to remove from finishes
  allowAcrylicAndPoly: boolean;
  allowTowel1: boolean;
  hasFixingBar?: boolean;
};