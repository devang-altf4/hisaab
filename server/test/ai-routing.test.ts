import { describe, expect, it } from 'vitest';
import { attemptOrder, cooldownFor, failureState, planRoute } from '../src/ai/gemini.js';
import { GroqError } from '../src/ai/groq.js';
import { plainText } from '../src/ai/coach.js';

// Who answers what, and what gets skipped after an error. Pure functions: no network, fake keys.

const setup = {
  geminiKeys: ['g-key-1', 'g-key-2'],
  geminiModels: ['gemini-main', 'gemini-backup'],
  groqKey: 'groq-key',
  groqModels: ['groq-a', 'groq-b'],
};

describe('AI routing', () => {
  it('text goes to Groq first, then every Gemini model on both keys', () => {
    expect(planRoute({ ...setup, textOnly: true }).map((s) => s.id)).toEqual([
      'groq:groq-a',
      'groq:groq-b',
      'gemini#1:gemini-main',
      'gemini#2:gemini-main',
      'gemini#1:gemini-backup',
      'gemini#2:gemini-backup',
    ]);
  });

  it('photos never go to Groq', () => {
    const route = planRoute({ ...setup, textOnly: false });
    expect(route.every((s) => s.provider === 'gemini')).toBe(true);
    expect(route.map((s) => s.id)[0]).toBe('gemini#1:gemini-main');
  });

  it('without a Groq key, text uses Gemini', () => {
    expect(planRoute({ ...setup, groqKey: '', textOnly: true })[0].provider).toBe('gemini');
  });

  it('slot ids never contain the key', () => {
    for (const s of planRoute({ ...setup, textOnly: true })) expect(s.id).not.toMatch(/key/);
  });
});

describe('AI cooldowns', () => {
  const geminiError = (status: number, body: object) => Object.assign(new Error(JSON.stringify({ error: body })), { status });

  it('Gemini daily quota: skip that model up to an hour (Google says retry in ~17 h)', () => {
    const err = geminiError(429, { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ retryDelay: '61150s' }] });
    expect(cooldownFor(err, 'gemini')).toEqual({ ms: 3_600_000 });
  });

  it('Groq per-minute limit: skip for as long as Groq says', () => {
    expect(cooldownFor(new GroqError(429, 'rate limit', 7000), 'groq')).toEqual({ ms: 7000 });
  });

  it('denied project / bad key: skip every model on that key', () => {
    const err = geminiError(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Your project has been denied access.' });
    expect(cooldownFor(err, 'gemini')).toEqual({ ms: 3_600_000, wholeKey: true });
  });

  it('overloaded or timed out: skip for a minute', () => {
    expect(cooldownFor(geminiError(503, { status: 'UNAVAILABLE' }), 'gemini')).toEqual({ ms: 60_000 });
    expect(cooldownFor(new Error('The operation was aborted due to timeout'), 'groq')).toEqual({ ms: 60_000 });
  });

  it('a bad request fails at once on Gemini, but falls through to Gemini from Groq', () => {
    expect(cooldownFor(geminiError(400, { status: 'INVALID_ARGUMENT' }), 'gemini')).toBeNull();
    expect(cooldownFor(new GroqError(413, 'request too large', null), 'groq')).toEqual({ ms: 0 });
  });
});

describe('coach replies are plain text', () => {
  it('strips the markdown some models add (the app shows plain text)', () => {
    const groqStyle = 'A typical slice of cake is about **250 kcal**.\n- **Balance before:** 1,773 kcal left\n- **Balance after:** 1,523 kcal left\n\n\n### Tip\nGo easy.';
    expect(plainText(groqStyle)).toBe(
      'A typical slice of cake is about 250 kcal.\n• Balance before: 1,773 kcal left\n• Balance after: 1,523 kcal left\n\nTip\nGo easy.',
    );
  });
});

describe('attempt order', () => {
  it('a briefly busy main model is still tried before giving up, ahead of backups out of quota for the day', () => {
    // What happened on Azure: the main model timed out once (skipped 1 min), the backups were out of quota (1 h)
    const route = planRoute({ ...setup, geminiKeys: ['g-key-1'], groqKey: '', textOnly: false });
    const now = 1_000_000;
    const cooling = new Map([
      ['gemini#1:gemini-main', now + 60_000],
      ['gemini#1:gemini-backup', now + 3_600_000],
    ]);
    expect(attemptOrder(route, cooling, now).map((s) => s.id)).toEqual(['gemini#1:gemini-main', 'gemini#1:gemini-backup']);
  });

  it('ready ones keep their route order and come first', () => {
    const route = planRoute({ ...setup, textOnly: true });
    const now = 1_000_000;
    const ids = attemptOrder(route, new Map([['groq:groq-a', now + 7000]]), now).map((s) => s.id);
    expect(ids[0]).toBe('groq:groq-b');
    expect(ids.at(-1)).toBe('groq:groq-a');
  });
});

describe('AI status shown to the app', () => {
  const err = (status: number, s: string) => Object.assign(new Error(JSON.stringify({ error: { code: status, status: s } })), { status });
  const quota = err(429, 'RESOURCE_EXHAUSTED');
  const busy = err(503, 'UNAVAILABLE');
  const denied = err(403, 'PERMISSION_DENIED');
  const retired = err(404, 'NOT_FOUND');

  it('out of quota or busy is "limited" (no warning banner): it comes back on its own', () => {
    expect(failureState([quota])).toBe('limited');
    expect(failureState([busy, quota])).toBe('limited');
  });

  it('only a setup problem is "error" (warning banner)', () => {
    expect(failureState([denied])).toBe('error');
    expect(failureState([denied, retired])).toBe('error');
  });

  it('a refused second key plus a first key out of quota is still just "limited"', () => {
    expect(failureState([quota, denied, quota])).toBe('limited');
  });
});
