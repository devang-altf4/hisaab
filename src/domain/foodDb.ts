/**
 * Tiny Indian-first food table. Powers MOCK AI mode (no API key) and gives
 * the coach quick what-if numbers. Values are per `unit`, typical home portions.
 */

export interface FoodItem {
  name: string;
  aliases: string[];
  unit: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
  health: number;
}

export const FOODS: FoodItem[] = [
  { name: 'Idli', aliases: ['idli', 'idly'], unit: '1 piece', kcal: 58, p: 2, c: 12, f: 0.4, fiber: 0.5, health: 8 },
  { name: 'Sambar', aliases: ['sambar', 'sambhar'], unit: '1 bowl', kcal: 140, p: 6, c: 20, f: 4, fiber: 5, health: 8 },
  { name: 'Masala Dosa', aliases: ['masala dosa', 'dosa'], unit: '1 piece', kcal: 390, p: 7, c: 52, f: 17, fiber: 3, health: 6 },
  { name: 'Upma', aliases: ['upma'], unit: '1 plate', kcal: 250, p: 6, c: 38, f: 8, fiber: 3, health: 7 },
  { name: 'Poha', aliases: ['poha'], unit: '1 plate', kcal: 270, p: 5, c: 45, f: 8, fiber: 2, health: 7 },
  { name: 'Aloo Paratha', aliases: ['aloo paratha', 'paratha', 'parantha'], unit: '1 piece', kcal: 300, p: 6, c: 40, f: 13, fiber: 4, health: 5 },
  { name: 'Roti', aliases: ['roti', 'chapati', 'chapatti', 'phulka'], unit: '1 piece', kcal: 110, p: 3, c: 18, f: 3, fiber: 3, health: 8 },
  { name: 'Naan', aliases: ['butter naan', 'naan'], unit: '1 piece', kcal: 290, p: 8, c: 45, f: 8, fiber: 2, health: 4 },
  { name: 'Steamed Rice', aliases: ['rice', 'chawal'], unit: '1 bowl', kcal: 200, p: 4, c: 44, f: 0.5, fiber: 0.6, health: 6 },
  { name: 'Jeera Rice', aliases: ['jeera rice'], unit: '1 bowl', kcal: 250, p: 4, c: 44, f: 6, fiber: 1, health: 6 },
  { name: 'Dal Tadka', aliases: ['dal tadka', 'dal fry', 'dal', 'daal'], unit: '1 bowl', kcal: 180, p: 9, c: 24, f: 6, fiber: 6, health: 8 },
  { name: 'Dal Makhani', aliases: ['dal makhani'], unit: '1 bowl', kcal: 330, p: 11, c: 30, f: 18, fiber: 7, health: 5 },
  { name: 'Rajma Chawal', aliases: ['rajma chawal', 'rajma'], unit: '1 plate', kcal: 480, p: 16, c: 80, f: 10, fiber: 12, health: 7 },
  { name: 'Chole Bhature', aliases: ['chole bhature', 'chole bhatura'], unit: '1 plate', kcal: 650, p: 17, c: 75, f: 32, fiber: 10, health: 3 },
  { name: 'Paneer Bhurji', aliases: ['paneer bhurji'], unit: '1 bowl', kcal: 320, p: 18, c: 8, f: 24, fiber: 1, health: 7 },
  { name: 'Paneer Butter Masala', aliases: ['paneer butter masala', 'paneer makhani', 'shahi paneer'], unit: '1 bowl', kcal: 420, p: 15, c: 14, f: 34, fiber: 2, health: 4 },
  { name: 'Palak Paneer', aliases: ['palak paneer'], unit: '1 bowl', kcal: 280, p: 14, c: 10, f: 20, fiber: 4, health: 7 },
  { name: 'Chicken Biryani', aliases: ['chicken biryani', 'biryani', 'biriyani'], unit: '1 plate', kcal: 550, p: 25, c: 65, f: 20, fiber: 2, health: 5 },
  { name: 'Butter Chicken', aliases: ['butter chicken', 'murgh makhani'], unit: '1 bowl', kcal: 450, p: 28, c: 12, f: 32, fiber: 1, health: 4 },
  { name: 'Tandoori Chicken', aliases: ['tandoori chicken', 'chicken tikka'], unit: '1 plate', kcal: 300, p: 36, c: 6, f: 14, fiber: 1, health: 8 },
  { name: 'Egg Bhurji', aliases: ['egg bhurji', 'anda bhurji', 'omelette', 'omelet'], unit: '2 eggs', kcal: 220, p: 13, c: 3, f: 17, fiber: 0.5, health: 7 },
  { name: 'Boiled Egg', aliases: ['boiled egg', 'egg', 'anda'], unit: '1 egg', kcal: 78, p: 6, c: 0.6, f: 5, fiber: 0, health: 9 },
  { name: 'Samosa', aliases: ['samosa'], unit: '1 piece', kcal: 260, p: 4, c: 28, f: 15, fiber: 2, health: 2 },
  { name: 'Pakora', aliases: ['pakora', 'pakoda', 'bhajji', 'bhaji'], unit: '1 plate', kcal: 320, p: 6, c: 28, f: 20, fiber: 3, health: 2 },
  { name: 'Vada Pav', aliases: ['vada pav', 'vadapav'], unit: '1 piece', kcal: 300, p: 6, c: 40, f: 13, fiber: 2, health: 3 },
  { name: 'Pav Bhaji', aliases: ['pav bhaji'], unit: '1 plate', kcal: 550, p: 12, c: 70, f: 25, fiber: 7, health: 4 },
  { name: 'Pani Puri', aliases: ['pani puri', 'golgappa', 'gol gappa', 'puchka'], unit: '6 pieces', kcal: 210, p: 4, c: 32, f: 8, fiber: 2, health: 4 },
  { name: 'Maggi', aliases: ['maggi', 'instant noodles'], unit: '1 packet', kcal: 350, p: 8, c: 50, f: 13, fiber: 2, health: 2 },
  { name: 'Masala Chai', aliases: ['masala chai', 'chai', 'tea'], unit: '1 cup', kcal: 90, p: 3, c: 12, f: 3, fiber: 0, health: 5 },
  { name: 'Filter Coffee', aliases: ['filter coffee', 'coffee'], unit: '1 cup', kcal: 110, p: 3, c: 14, f: 4, fiber: 0, health: 5 },
  { name: 'Sweet Lassi', aliases: ['lassi'], unit: '1 glass', kcal: 260, p: 8, c: 40, f: 7, fiber: 0, health: 4 },
  { name: 'Gulab Jamun', aliases: ['gulab jamun'], unit: '1 piece', kcal: 150, p: 2, c: 25, f: 5, fiber: 0, health: 1 },
  { name: 'Jalebi', aliases: ['jalebi'], unit: '100 g', kcal: 450, p: 3, c: 70, f: 18, fiber: 0, health: 1 },
  { name: 'Chocolate Cake', aliases: ['cake', 'pastry', 'brownie'], unit: '1 slice', kcal: 350, p: 4, c: 45, f: 17, fiber: 2, health: 2 },
  { name: 'Pizza', aliases: ['pizza'], unit: '1 slice', kcal: 285, p: 12, c: 36, f: 10, fiber: 2, health: 3 },
  { name: 'Burger', aliases: ['burger'], unit: '1 piece', kcal: 450, p: 18, c: 45, f: 22, fiber: 2, health: 3 },
  { name: 'Curd', aliases: ['curd', 'dahi', 'yogurt', 'raita'], unit: '1 bowl', kcal: 100, p: 6, c: 7, f: 5, fiber: 0, health: 8 },
  { name: 'Banana', aliases: ['banana', 'kela'], unit: '1 medium', kcal: 105, p: 1.3, c: 27, f: 0.4, fiber: 3, health: 9 },
  { name: 'Apple', aliases: ['apple', 'seb'], unit: '1 medium', kcal: 95, p: 0.5, c: 25, f: 0.3, fiber: 4, health: 9 },
  { name: 'Mixed Salad', aliases: ['salad'], unit: '1 bowl', kcal: 80, p: 3, c: 12, f: 2, fiber: 5, health: 10 },
  { name: 'Whey Protein Shake', aliases: ['whey', 'protein shake'], unit: '1 scoop', kcal: 120, p: 24, c: 3, f: 1.5, fiber: 0, health: 8 },
  { name: 'Sprouts Chaat', aliases: ['sprouts', 'sprouts chaat'], unit: '1 bowl', kcal: 150, p: 10, c: 24, f: 2, fiber: 7, health: 10 },
];

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, one: 1, a: 1, an: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, half: 0.5, aadha: 0.5, adha: 0.5,
};

/** Longest alias first so "masala dosa" beats "dosa", "dal makhani" beats "dal". */
const ALIASES = FOODS.flatMap((f) => f.aliases.map((a) => ({ alias: a, food: f }))).sort(
  (x, y) => y.alias.length - x.alias.length,
);

export interface ParsedItem {
  food: FoodItem;
  qty: number;
}

/** "2 plate idli sambar aur ek chai" → [{Idli×2},{Sambar×1},{Chai×1}] */
export function parseFoodText(text: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  const parts = text.toLowerCase().split(/,|\band\b|\baur\b|\bwith\b|\bplus\b|&|\+/);
  for (const part of parts) {
    let rest = ` ${part.replace(/[^\p{L}\p{N}.\s]/gu, ' ')} `;
    const qtyMatch = rest.match(/(\d+(?:\.\d+)?)/) ?? rest.match(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`));
    const qty = qtyMatch ? (Number(qtyMatch[1]) || NUMBER_WORDS[qtyMatch[1]] || 1) : 1;
    const hits: Array<ParsedItem & { at: number }> = [];
    for (const { alias, food } of ALIASES) {
      const re = new RegExp(`\\b${alias}s?\\b`);
      const m = re.exec(rest);
      if (m) {
        hits.push({ food, qty: Math.min(qty, 20), at: m.index });
        // blank it out (same length, keeps later indices stable) so "dal" can't re-match inside "dal makhani"
        rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
      }
    }
    out.push(...hits.sort((a, b) => a.at - b.at).map(({ food, qty }) => ({ food, qty })));
  }
  return out;
}

export function findFood(text: string): FoodItem | null {
  return parseFoodText(text)[0]?.food ?? null;
}
