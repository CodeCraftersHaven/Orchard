import type { PrismaClient } from '@orchard/database';

export const xpCooldowns = new Map<string, number>();
export const xpCooldownMs = 60_000;
export const failEmojis = ['❌', '💀', '🤡', '👎', '🫠', '🪦', '📉', '👻', '🤏', '🧱', '🤦', '💩', '📉', '☣️'];
export const checkEmojis = ['✅', '☑️', '✔️'];
export const wrongCountMessages = [
  'Oof. The next number was **{expected}**. Back to 0.',
  'Math is hard. **{expected}** was the goal.',
  'Wrong! Back to 0 we go.',
  'My disappointment is immeasurable, and my day is ruined. **{expected}** was next.',
  "I'm not mad, just disappointed. **{expected}** was the number.",
  '**{expected}**. That\'s it. That\'s the number you missed. We\'re starting over.',
  'Congratulations, you\'ve reached level 0. The next number was **{expected}**.',
  "Even a broken clock is right twice a day, but you weren't right this time. It was **{expected}**.",
  'Brain.exe has stopped working. **{expected}** was next.',
  '404: Correct number not found. Expected **{expected}**.',
  'Wait, you thought it was that? It was **{expected}**. Try again!',
  'Legend says the next number was **{expected}**, but we\'ll never know now.',
];
export const repeatCountMessages = [
  "Greedy! You can't count twice in a row.",
  'Wait for a friend, {user}!',
  'Patience is a virtue, {user}. One you clearly lack.',
  'Whoa there, Speed Racer! Let someone else have a turn.',
  '{user}, don\'t be a count-hog!',
  'The solo career isn\'t working out for you, {user}.',
  'One is the loneliest number, but you need at least two people to play this, {user}.',
];
export const raceCountMessages = [
  'Someone else got there first. The numbers are fast today.',
  'That count was snatched before you could claim it.',
  'The counter moved while you were typing.',
];

export function randomMessage(messages: string[]) {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function randomCountMessage(messages: string[], replacements: Record<string, string>) {
  return randomMessage(messages).replace(/\{(\w+)\}/g, (_, key: string) => replacements[key] ?? `{${key}}`);
}

export function evaluateCountExpression(expression: string) {
  let position = 0;

  const skipWhitespace = () => {
    while (/\s/.test(expression[position] ?? '')) position++;
  };
  const parseNumber = () => {
    skipWhitespace();
    const start = position;
    while (/[\d.]/.test(expression[position] ?? '')) position++;
    if (start === position || expression.slice(start, position).split('.').length > 2) return null;
    const value = Number(expression.slice(start, position));
    return Number.isFinite(value) ? value : null;
  };
  const parseFactor = (): number | null => {
    skipWhitespace();
    if (expression[position] === '+' || expression[position] === '-') {
      const sign = expression[position++] === '-' ? -1 : 1;
      const value = parseFactor();
      return value === null ? null : sign * value;
    }
    if (expression[position] === '(') {
      position++;
      const value = parseExpression();
      skipWhitespace();
      if (expression[position] !== ')') return null;
      position++;
      return value;
    }
    return parseNumber();
  };
  const parseTerm = () => {
    let value = parseFactor();
    while (value !== null) {
      skipWhitespace();
      const operator = expression[position];
      if (operator !== '*' && operator !== '/') break;
      position++;
      const right = parseFactor();
      if (right === null || (operator === '/' && right === 0)) return null;
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  function parseExpression() {
    let value = parseTerm();
    while (value !== null) {
      skipWhitespace();
      const operator = expression[position];
      if (operator !== '+' && operator !== '-') break;
      position++;
      const right = parseTerm();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  const result = parseExpression();
  skipWhitespace();
  return position === expression.length && result !== null && Number.isSafeInteger(result) ? result : null;
}

export async function resetCounter(prisma: PrismaClient, guildId: string, channelId: string, count: number) {
  const reset = await prisma.counter.updateMany({
    where: { gID: guildId, active: true, channel: channelId, count },
    data: { count: 0, lastCount: null, lastUser: null, recordPending: false },
  });
  return reset.count > 0;
}