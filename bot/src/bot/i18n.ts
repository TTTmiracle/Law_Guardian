/**
 * i18n.ts — The few fixed messages the bot sends without the model.
 *
 * Everything conversational is written by the agent in the user's own
 * language; these are only the welcome text and file-handling errors, picked
 * from the Telegram client language.
 */

import type { Context } from 'grammy';

export type Lang = 'uz' | 'ru' | 'en';

export function langOf(ctx: Context): Lang {
  const code = ctx.from?.language_code ?? '';
  if (code.startsWith('uz')) return 'uz';
  if (code.startsWith('ru')) return 'ru';
  return 'en';
}

type Key =
  | 'welcome'
  | 'readingPhotos'
  | 'unreadablePhoto'
  | 'tooBig'
  | 'unsupported'
  | 'scannedPdf'
  | 'emptyFile'
  | 'stReviewing'
  | 'stDrafting'
  | 'stRevising'
  | 'stWriting'
  | 'btnFair'
  | 'btnMessage'
  | 'messageOtherPrompt'
  | 'newDone'
  | 'rateLimited'
  | 'nothingToChange'
  | 'notAnalyzed'
  | 'cmdStart'
  | 'cmdNew'
  | 'cmdHelp'
  | 'botShort'
  | 'botDescription';

const STRINGS: Record<Key, Record<Lang, string>> = {
  welcome: {
    uz:
      "Assalomu alaykum! Men shartnomalar bo'yicha yordamchiman.\n\n" +
      "📄 Shartnomangizni tekshiraman. Matnini yuboring yoki PDF, DOCX fayl yoxud sahifalarning suratini jo'nating — nimaga rozi bo'layotganingizni oddiy tilda tushuntirib, xavfli bandlarni ko'rsataman.\n\n" +
      "✍️ Yangi shartnoma tuzib beraman. Nima kerakligini yozing, masalan: «Kvartiramni 6 oyga ijaraga bermoqchiman». Chop etishga tayyor PDF yuboraman.\n\n" +
      "Men advokat emasman. Muhim bitimlarni mutaxassisga ham ko'rsating.",
    ru:
      'Здравствуйте! Я помощник по договорам.\n\n' +
      '📄 Проверю ваш договор. Пришлите текст, файл PDF или DOCX, или фото страниц — объясню простыми словами, что вы подписываете, и покажу рискованные пункты.\n\n' +
      '✍️ Составлю новый договор. Напишите, что нужно, например: «Сдаю квартиру на 6 месяцев». Пришлю готовый к печати PDF.\n\n' +
      'Я не юрист. Важные сделки покажите также специалисту.',
    en:
      "Hi! I'm a contract assistant.\n\n" +
      "📄 I'll review your contract. Send the text, a PDF or DOCX file, or photos of the pages — I'll explain in plain words what you're agreeing to and point out the risky clauses.\n\n" +
      "✍️ I'll draft a new contract. Tell me what you need, for example: \"I'm renting out my apartment for 6 months.\" I'll send a ready-to-print PDF.\n\n" +
      "I'm not a lawyer. For important deals, have a professional look as well.",
  },
  readingPhotos: {
    uz: "📷 Suratlardagi matnni o'qiyapman…",
    ru: '📷 Читаю текст на фото…',
    en: '📷 Reading the text in your photos…',
  },
  unreadablePhoto: {
    uz: "Suratdagi matnni o'qib bo'lmadi. Hujjatni tekis qo'yib, yorug' joyda qayta suratga oling.",
    ru: 'Не удалось прочитать текст на фото. Положите документ ровно и сфотографируйте при хорошем освещении.',
    en: "I couldn't read the text in the photo. Lay the document flat and take the picture in good light.",
  },
  tooBig: {
    uz: 'Fayl juda katta. 20 MB dan kichik fayl yuboring.',
    ru: 'Файл слишком большой. Пришлите файл до 20 МБ.',
    en: 'That file is too large. Please send one under 20 MB.',
  },
  unsupported: {
    uz: "Bu faylni o'qiy olmayman. PDF, DOCX, TXT yoki surat yuboring.",
    ru: 'Не могу прочитать этот файл. Пришлите PDF, DOCX, TXT или фото.',
    en: "I can't read that file. Please send a PDF, DOCX, TXT or a photo.",
  },
  scannedPdf: {
    uz: "Bu PDF skanerlangan ko'rinadi — ichida matn yo'q. Sahifalarni suratga olib yuboring, o'qib beraman.",
    ru: 'Похоже, это скан — в PDF нет текста. Пришлите страницы фотографиями, я их прочитаю.',
    en: "This PDF looks like a scan — it has no text layer. Send the pages as photos and I'll read them.",
  },
  emptyFile: {
    uz: "Faylda deyarli matn yo'q. Shartnomaning to'liq matnini yuboring.",
    ru: 'В файле почти нет текста. Пришлите полный текст договора.',
    en: 'That file has almost no text. Please send the full contract.',
  },
  stReviewing: {
    uz: '🔍 Har bir bandni tekshiryapman…',
    ru: '🔍 Проверяю каждый пункт…',
    en: '🔍 Reviewing every clause…',
  },
  stDrafting: {
    uz: '✍️ Shartnomani tuzyapman…',
    ru: '✍️ Составляю договор…',
    en: '✍️ Drafting the contract…',
  },
  stRevising: {
    uz: '✍️ Tuzatishlarni tayyorlayapman…',
    ru: '✍️ Готовлю правки…',
    en: '✍️ Preparing tracked changes…',
  },
  stWriting: {
    uz: '💬 Javob yozyapman…',
    ru: '💬 Пишу ответ…',
    en: '💬 Writing the answer…',
  },
  btnFair: {
    uz: '✍️ Adolatli variant',
    ru: '✍️ Справедливая редакция',
    en: '✍️ Fair version',
  },
  btnMessage: {
    uz: '✉️ Boshqa tomonga xabar',
    ru: '✉️ Сообщение другой стороне',
    en: '✉️ Message to the other side',
  },
  messageOtherPrompt: {
    uz: "Boshqa tomonga yuborishim mumkin bo'lgan, shu o'zgarishlarni so'rab yozilgan qisqa va xushmuomala xabar yozib bering.",
    ru: 'Напиши короткое вежливое сообщение, которое я могу отправить другой стороне с просьбой внести эти изменения.',
    en: 'Write a short, polite message I can send to the other side asking for these changes.',
  },
  newDone: {
    uz: 'Yangi suhbat boshlandi. Hujjatlaringiz saqlanib qoldi.',
    ru: 'Начат новый разговор. Ваши документы сохранены.',
    en: 'Started a new conversation. Your documents are kept.',
  },
  rateLimited: {
    uz: "So'rovlar juda ko'p. Birozdan keyin qayta urinib ko'ring.",
    ru: 'Слишком много запросов. Попробуйте чуть позже.',
    en: 'Too many requests. Please try again a little later.',
  },
  nothingToChange: {
    uz: "Tekshiruvda qayta yozilishi kerak bo'lgan band topilmadi.",
    ru: 'Проверка не нашла пунктов, которые нужно переформулировать.',
    en: 'The review found nothing that needs rewording.',
  },
  notAnalyzed: {
    uz: 'Bu shartnoma hali tekshirilmagan.',
    ru: 'Этот договор ещё не проверен.',
    en: "This contract hasn't been reviewed yet.",
  },
  cmdStart: { uz: 'Boshlash', ru: 'Начать', en: 'Start' },
  cmdNew: { uz: 'Yangi suhbat', ru: 'Новый разговор', en: 'New conversation' },
  cmdHelp: { uz: 'Yordam', ru: 'Помощь', en: 'Help' },
  botShort: {
    uz: "Shartnomalarni tekshiradi va yangisini tuzib beradi. O'zbek, rus va ingliz tillarida.",
    ru: 'Проверяет договоры и составляет новые. На узбекском, русском и английском.',
    en: 'Reviews contracts and drafts new ones. In Uzbek, Russian and English.',
  },
  botDescription: {
    uz: "Shartnoma matnini, PDF faylini yoki suratini yuboring — nimaga rozi bo'layotganingizni oddiy tilda tushuntiraman va xavfli bandlarni ko'rsataman. Yoki kerakli shartnomani tasvirlang — chop etishga tayyor PDF tuzib beraman. Men advokat emasman.",
    ru: 'Пришлите текст договора, PDF или фото — объясню простыми словами, что вы подписываете, и покажу рискованные пункты. Или опишите нужный договор — составлю готовый к печати PDF. Я не юрист.',
    en: "Send a contract as text, a PDF or photos — I'll explain in plain words what you're agreeing to and point out the risky clauses. Or describe the contract you need and I'll draft a ready-to-print PDF. I'm not a lawyer.",
  },
};

export function t(lang: Lang, key: Key): string {
  return STRINGS[key][lang];
}

/** Status line shown after the quote check. */
export function verifiedLine(lang: Lang, verified: number, rejected: number): string {
  const total = verified + rejected;
  if (lang === 'uz') {
    return rejected
      ? `✅ ${total} ta iqtibos hujjatingiz bilan solishtirildi: ${verified} tasi tasdiqlandi, ${rejected} tasi rad etildi`
      : `✅ ${verified} ta iqtibos hujjatingiz bilan solishtirildi — hammasi tasdiqlandi`;
  }
  if (lang === 'ru') {
    return rejected
      ? `✅ Сверено цитат с вашим документом: ${total} — подтверждено ${verified}, отклонено ${rejected}`
      : `✅ Сверено цитат с вашим документом: ${verified} — все подтверждены`;
  }
  return rejected
    ? `✅ Checked ${total} quotes against your document: ${verified} verified, ${rejected} rejected`
    : `✅ Checked ${verified} ${verified === 1 ? 'quote' : 'quotes'} against your document — all verified`;
}

export function fairCaption(lang: Lang, n: number): string {
  if (lang === 'uz') return `${n} ta tuzatish kiritilgan qarshi taklif. Muzokara uchun asos sifatida uni boshqa tomonga yuboring.`;
  if (lang === 'ru') return `Встречная редакция с правками (${n}). Отправьте её другой стороне как основу для переговоров.`;
  return `A counter-proposal with ${n} tracked ${n === 1 ? 'change' : 'changes'}. Send it to the other side as a starting point for negotiation.`;
}
