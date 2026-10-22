/**
 * Packaged-food lookup via Open Food Facts (free, decent Indian coverage for big brands).
 * Values are per serving when OFF knows the serving size, else per 100 g.
 */
export interface BarcodeProduct {
  code: string;
  name: string;
  brand: string | null;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  imageUrl: string | null;
}

const cache = new Map<string, BarcodeProduct | null>();
const r1 = (n: unknown) => Math.round((Number(n) || 0) * 10) / 10;

export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  if (cache.has(code)) return cache.get(code)!;
  const fields = 'product_name,brands,serving_size,serving_quantity,nutriments,image_front_small_url';
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`;
  const res = await fetch(url, {
    headers: { 'user-agent': 'Hisaab/0.1 (calorie tracker MVP)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Open Food Facts returned ${res.status}`);
  const json = (await res.json()) as { status?: number; product?: any };
  if (json.status !== 1 || !json.product) {
    cache.set(code, null);
    return null;
  }
  const p = json.product;
  const n = p.nutriments ?? {};
  const hasServing = Number(p.serving_quantity) > 0 && n['energy-kcal_serving'] !== undefined;
  const pick = (k: string) => (hasServing ? n[`${k}_serving`] : n[`${k}_100g`]);
  const kcal = pick('energy-kcal') ?? (pick('energy') ? Number(pick('energy')) / 4.184 : 0);

  const product: BarcodeProduct = {
    code,
    name: p.product_name || 'Packaged food',
    brand: p.brands?.split(',')[0]?.trim() || null,
    servingLabel: hasServing ? String(p.serving_size || `${p.serving_quantity} g`) : '100 g',
    calories: Math.round(Number(kcal) || 0),
    proteinG: r1(pick('proteins')),
    carbsG: r1(pick('carbohydrates')),
    fatG: r1(pick('fat')),
    fiberG: r1(pick('fiber')),
    imageUrl: p.image_front_small_url || null,
  };
  cache.set(code, product);
  return product;
}
