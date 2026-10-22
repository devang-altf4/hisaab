import type { Content } from '@google/genai';
import { parseFoodText } from '../domain/foodDb.js';
import { pnlFrom, statusInWords, whatIf, type DaySummary } from '../domain/hisaab.js';
import type { ChatMessage, Meal, User } from '../store/types.js';
import { geminiEnabled, generate, ZERO_USAGE, type AiUsage } from './gemini.js';
import { COACH_SYSTEM } from './prompts.js';

export interface CoachContext {
  user: User;
  today: DaySummary;
  meals: Meal[];
  weekPnl?: number;
}

/** Plain-text ledger block injected into every chat turn. */
export function ledgerContext({ user, today, meals, weekPnl }: CoachContext): string {
  const p = user.profile;
  const m = today.macros;
  const mealLines = meals
    .filter((x) => x.status === 'done')
    .map((x) => `  - ${x.mealType}: ${x.dishName} — ${x.calories} kcal (P${x.proteinG}/C${x.carbsG}/F${x.fatG})`)
    .join('\n');
  return [
    'LEDGER CONTEXT (today, real data):',
    `Name: ${user.name}. Goal: ${today.goal}.` +
      (p ? ` ${p.sex}, ${p.age}y, ${p.heightCm} cm, ${p.weightKg} kg, activity ${p.activityLevel}.` : ' Profile not set.'),
    `Budget: ${today.budget} kcal | Eaten: ${today.eaten} | Bonus (burned): ${today.burned} | Balance (left): ${today.caloriesLeft}`,
    `Status: ${statusInWords(today.pnl, today.goal)}`,
    `Protein ${m.protein.eaten}/${m.protein.target} g, Carbs ${m.carbs.eaten}/${m.carbs.target} g, Fat ${m.fat.eaten}/${m.fat.target} g`,
    `Water ${today.water.ml}/${today.water.targetMl} ml`,
    weekPnl !== undefined ? `Last 7 days: ${statusInWords(pnlFrom(weekPnl), today.goal)}` : '',
    mealLines ? `Meals today:\n${mealLines}` : 'Meals today: none logged yet.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function askCoach(
  ctx: CoachContext,
  history: ChatMessage[],
  message: string,
): Promise<{ text: string; usage: AiUsage }> {
  if (!geminiEnabled()) return { text: mockReply(ctx, message), usage: ZERO_USAGE };

  const contents: Content[] = [
    ...history.slice(-12).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: `${ledgerContext(ctx)}\n\nUSER: ${message}` }] },
  ];
  const { text, usage } = await generate({
    systemInstruction: COACH_SYSTEM,
    contents,
    temperature: 0.8,
    maxOutputTokens: 600,
  });
  return { text: plainText(text) || 'I couldn’t get an answer just now. Please ask again.', usage };
}

/** The chat shows plain text: drop markdown some models add anyway (**bold**, # headings, "- " bullets). */
export function plainText(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_m, a, b) => a ?? b)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Mock mode ────────────────────────────────────────────

function mockReply({ user, today }: CoachContext, message: string): string {
  const name = user.name || 'there';
  const items = parseFoodText(message);
  const left = today.caloriesLeft;

  if (items.length) {
    const kcal = Math.round(items.reduce((s, i) => s + i.food.kcal * i.qty, 0));
    const what = items.map((i) => `${i.food.name} (${i.qty === 1 ? i.food.unit : `${i.qty} × ${i.food.unit}`})`).join(' plus ');
    const { after } = whatIf(today, kcal);
    const gain = today.goal === 'gain';
    const verdict =
      after.status !== 'LOSS'
        ? gain
          ? 'That gets you to your budget. Nice, that’s a profitable day.'
          : `You’d still be ${after.amount} kcal in profit. Enjoy it and keep the rest of the day light.`
        : gain
          ? `After that you’d need ${Math.abs(after.amount)} kcal more. A glass of milk and a handful of nuts gets you most of the way.`
          : `That puts the day ${Math.abs(after.amount)} kcal in loss. If you want it, a 30–40 minute walk earns most of it back.`;
    return `${name}, ${what} is about ${kcal} kcal. Your balance is ${left} kcal now and would be ${left - kcal} kcal after. ${verdict}`;
  }

  if (/dinner|lunch|breakfast|what should i eat|suggest/i.test(message)) {
    if (left <= 150) return `You have ${left} kcal left. A bowl of curd or sprouts chaat keeps you in profit and adds protein.`;
    if (left <= 500) return `You have ${left} kcal left. Two rotis with dal and a salad (about 420 kcal) fits nicely.`;
    return `You have ${left} kcal left, so two rotis with paneer or chicken curry and a bowl of dal works well. Make protein the main part of the plate.`;
  }

  if (/protein/i.test(message)) {
    return `You’re at ${today.macros.protein.eaten} of ${today.macros.protein.target} g protein today. Vegetarian picks: paneer, curd, soya chunks and sprouts. Otherwise eggs and chicken. Add one protein source to every meal.`;
  }

  return (
    `${name}, here’s today: budget ${today.budget}, eaten ${today.eaten}, bonus ${today.burned}. ${statusInWords(today.pnl, today.goal).replace(/ \(.*\)$/, '')}. ` +
    (today.pnl.status !== 'LOSS'
      ? 'Nice work. Keep going like this.'
      : today.goal === 'gain'
        ? 'Add a protein-rich snack or a bigger next meal to close the gap.'
        : 'Keep the next meal light and take a walk to get back to even.')
  );
}
