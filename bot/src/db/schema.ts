import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  serial,
  integer,
  bigint,
  varchar,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Custom types ─────────────────────────────────────────────────────────────

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ─── Enums ────────────────────────────────────────────────────────────────────

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const documentKindEnum = pgEnum('document_kind', ['reviewed', 'drafted']);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  /** Exactly one of these is set: Telegram users have an id, web visitors a session cookie. */
  telegramId: bigint('telegram_id', { mode: 'number' }).unique(),
  webSessionId: varchar('web_session_id', { length: 64 }).unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  kind: documentKindEnum('kind').notNull(),
  /** Uploaded filename, or the drafted contract's title. */
  title: varchar('title', { length: 255 }),
  rawText: text('raw_text').notNull(),
  summary: jsonb('summary'),
  pdf: bytea('pdf'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * A thread within one device's chat. Telegram and the eval suite never pick
 * one explicitly — they always get "the most recent, or a new one" — so a
 * conversation only becomes visible as a distinct, nameable thing on the web,
 * where people can hold several at once.
 */
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  /** Auto-set from the first real message; null shows as a date in the UI. */
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  /** Nullable only for rows written before threads existed. */
  conversationId: integer('conversation_id').references(() => conversations.id),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  messages: many(messages),
  conversations: many(conversations),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, { fields: [documents.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));
