import { Bot } from 'grammy';

// Don't create the Bot at import time — token isn't loaded yet.
// It's created on first access, by which point dotenv has already run in src/index.ts.

let _bot: Bot | null = null;

function getBotInstance(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set. Check your .env file.');
    _bot = new Bot(token);
  }
  return _bot;
}

export const bot = new Proxy<Bot>({} as Bot, {
  get(_, prop) {
    return Reflect.get(getBotInstance(), prop, getBotInstance());
  },
  set(_, prop, value) {
    return Reflect.set(getBotInstance(), prop, value);
  },
});
