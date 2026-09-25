import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env FIRST — before any import that reads process.env at module load.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { bot } from './bot/instance';
import { setupHandlers, setupBotProfile } from './bot/handlers';
import { MODEL } from './core/ai/client';
import { createWebApp } from './web/server';

const REQUIRED_ENV = ['DEEPSEEK_API_KEY', 'DATABASE_URL'] as const;
const WEB_PORT = parseInt(process.env.WEB_PORT || '3100', 10);

async function main(): Promise<void> {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.error('   Copy .env.example to .env and fill these in.');
    process.exit(1);
  }

  console.log(`   Model: ${MODEL}`);

  const server = createWebApp().listen(WEB_PORT, () => {
    console.log(`✅ Web app on http://localhost:${WEB_PORT}`);
  });

  // Telegram is optional so the web app can run on its own — only one process
  // may poll a bot token at a time.
  const telegram = !!process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ENABLED !== 'false';
  if (telegram) {
    setupHandlers();
    void setupBotProfile();
    bot.start({
      onStart: (info) => console.log(`✅ Telegram @${info.username} is live (polling)`),
    });
  } else {
    console.log('   Telegram disabled (no TELEGRAM_BOT_TOKEN or TELEGRAM_ENABLED=false)');
  }

  const shutdown = async (signal: string) => {
    console.log(`\n⏳ ${signal} — shutting down...`);
    server.close();
    if (telegram) await bot.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
