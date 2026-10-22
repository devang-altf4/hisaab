import { colors } from '../theme/tokens';
import type { Goal, Pnl } from '../api/hisaabApi';

/**
 * How a P&L reads to the user. For a GAIN goal, being under budget isn't a "loss": it's food
 * still to eat, so it reads "Need 2,190 kcal more" (red: it's the gap to close, stated as a
 * fact and a target). Going over budget on a lose/maintain goal is a real overspend and stays a loss.
 */
export type PnlTone = 'profit' | 'short' | 'over' | 'even';

export function pnlTone(pnl: Pnl, goal?: Goal | null): PnlTone {
  if (pnl.status === 'PROFIT') return 'profit';
  if (pnl.status === 'BREAK_EVEN') return 'even';
  return goal === 'gain' ? 'short' : 'over';
}

export const toneColor: Record<PnlTone, string> = {
  profit: colors.profit,
  short: colors.loss,
  over: colors.loss,
  even: colors.accent,
};

export const toneBg: Record<PnlTone, string> = {
  profit: 'rgba(16, 185, 129, 0.15)',
  short: 'rgba(255, 69, 58, 0.15)',
  over: 'rgba(255, 69, 58, 0.15)',
  even: 'rgba(245, 158, 11, 0.15)',
};

const kcal = (n: number) => `${Math.abs(n).toLocaleString()} kcal`;

/**
 * Sentence-length tag. `past`: the day is over, so a gap can't be closed any more ("2,190 kcal short").
 * `they`: someone else's day (trainer view).
 */
export function pnlText(pnl: Pnl, goal?: Goal | null, opts: { past?: boolean; they?: boolean } = {}): string {
  switch (pnlTone(pnl, goal)) {
    case 'profit':
      return `In profit, ${kcal(pnl.amount)}`;
    case 'short':
      return opts.past ? `${kcal(pnl.amount)} short` : `${opts.they ? 'Needs' : 'Need'} ${kcal(pnl.amount)} more`;
    case 'over':
      return `In loss, ${kcal(pnl.amount)}`;
    default:
      return 'Right on budget';
  }
}

/** Compact tag for small pills: "+550", "Need 480", "−300". */
export function pnlShort(pnl: Pnl, goal?: Goal | null): string {
  const n = Math.abs(pnl.amount).toLocaleString();
  switch (pnlTone(pnl, goal)) {
    case 'profit':
      return `+${n}`;
    case 'short':
      return `Need ${n}`;
    case 'over':
      return `−${n}`;
    default:
      return '±0';
  }
}
