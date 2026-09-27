/* Law Guardian — web client.
 *
 * No framework: one chat, one document viewer. Every piece of user or model
 * text is inserted with textContent, never innerHTML — a contract is
 * untrusted input.
 */
(() => {
  'use strict';

  // ─── Strings ───────────────────────────────────────────────────────────────

  const STR = {
    en: {
      tagline: 'Understand a contract before you sign it — or get one drafted for you.',
      telegram: 'Also on Telegram',
      newChat: 'New conversation',
      tabChat: 'Chat',
      tabDoc: 'Document',
      tabChats: 'Chats',
      noChats: 'No conversations yet.',
      introTitle: 'Know what you are signing.',
      reviewTitle: 'Review a contract',
      reviewBody: "Upload a PDF, Word file or photos of the pages — or paste the text. You'll see what you are agreeing to and which clauses can hurt you.",
      upload: 'Upload a file',
      trySample: 'Try a sample contract',
      draftTitle: 'Draft a new contract',
      draftBody: "Describe the deal in your own words. You'll get a complete contract as a PDF, ready to print and sign.",
      examples: [
        "I'm renting out my apartment in Tashkent for 6 months at $400 a month.",
        "I'm lending $2,000 to a friend, to be repaid by March 2027, no interest.",
        "I'm hiring a freelance designer to make a logo for 3 million so'm.",
      ],
      privacy: 'Not legal advice. Documents you add are visible only in this browser.',
      placeholder: 'Paste a contract, ask, or describe the one you need…',
      dropHere: 'Drop the file to upload',
      documents: 'Documents',
      docEmptyTitle: 'Your documents appear here',
      docEmptyBody: "Risky clauses are highlighted right in the text. Every flag is checked against the document — if the AI can't point to the exact words, it isn't shown.",
      sevHigh: 'Serious',
      sevMedium: 'Worth negotiating',
      sevLow: 'Minor',
      overall: { high: 'High risk', medium: 'Some risk', low: 'Low risk' },
      verified: (n) => `${n} ${n === 1 ? 'clause' : 'clauses'} flagged — each checked against the document`,
      flagged: 'Flagged clauses',
      missing: 'Missing from the contract',
      keyTerms: 'Key terms',
      askFor: 'Ask for:',
      noRisks: 'No risky clauses could be verified in this document.',
      notAnalyzed: 'Not reviewed yet — ask for a review in the chat.',
      reviewed: 'Reviewed',
      drafted: 'Drafted',
      openPdf: 'Open PDF',
      downloadPdf: 'Download PDF',
      openDoc: 'Open',
      showDoc: 'Show document →',
      showAll: 'Show all',
      showLess: 'Show less',
      steps: {
        thinking: 'Reading your message',
        photos: 'Reading the photos',
        file: 'Extracting the text from your file',
        read: (n) => `Read ${n.toLocaleString('en')} characters`,
        save_document: 'Saving the contract',
        analyze_document: 'Reviewing every clause',
        analyzed: (v, r) => (r ? `Checked ${v + r} quotes against the text — ${v} verified, ${r} rejected` : `Checked ${v} ${v === 1 ? 'quote' : 'quotes'} against the text — all verified`),
        get_document: 'Re-reading the document',
        list_documents: 'Looking up your documents',
        draft_contract: 'Drafting the contract',
        drafted: 'Contract drafted — PDF ready',
        propose_revisions: 'Preparing tracked changes',
        writing: 'Writing the answer',
      },
      fairVersion: 'Make a fair version (tracked changes)',
      messageOther: 'Write a message to the other side',
      messageOtherPrompt: 'Write a short, polite message I can send to the other side asking for these changes.',
      fairReady: (n) => `Here is a counter-proposal with ${n} tracked ${n === 1 ? 'change' : 'changes'}. Send it to the other side as a starting point for negotiation.`,
      fairToolbar: 'Fair version (PDF)',
      suggested: 'Suggested wording',
      manipulationTitle: 'Hidden instructions for AI found',
      manipulationBody: 'This document contains text addressed to AI tools, trying to make them call it safe. It was ignored — but treat it as a warning sign.',
      pasted: 'Pasted contract',
      trustTitle: 'How Law Guardian keeps itself honest',
      trust1: "Every flagged clause must quote your contract word for word. Code checks each quote — if the words aren't really there, the flag is dropped.",
      trust2: 'Text hidden in a document that tries to steer AI reviewers is detected and shown to you.',
      trust3: (p, t) => `Red-team tested: ${p} of ${t} adversarial cases passed — hidden instructions, invented laws, illegal contracts, clauses that don't exist.`,
      trustCases: 'See every test',
      cat: { safety: 'Safety', honesty: 'Honesty', capability: 'Capability', language: 'Language' },
      errors: {
        busy: 'Still working on your last message.',
        rateLimited: 'Too many requests — please wait a bit and try again.',
        tooBig: 'That file is too large (max 20 MB).',
        unsupported: "I can't read that file. Please send a PDF, DOCX, TXT or photos.",
        scannedPdf: 'This PDF looks like a scan with no text layer. Upload photos of the pages instead.',
        emptyFile: 'That file has almost no text.',
        unreadablePhoto: "I couldn't read the text in the photo. Lay the document flat and use good light.",
        oneFileOrPhotos: 'Upload one file, or several photos of the same document.',
        nothingToChange: 'The review found nothing that needs rewording.',
        notAnalyzed: "This contract hasn't been reviewed yet.",
        failed: 'Something went wrong. Please try again.',
        network: 'No connection to the server. Check your internet and try again.',
      },
    },
    ru: {
      tagline: 'Разберитесь в договоре до подписания — или получите готовый.',
      telegram: 'Есть и в Telegram',
      newChat: 'Новый разговор',
      tabChat: 'Чат',
      tabDoc: 'Документ',
      tabChats: 'Чаты',
      noChats: 'Пока нет разговоров.',
      introTitle: 'Знайте, что подписываете.',
      reviewTitle: 'Проверить договор',
      reviewBody: 'Загрузите PDF, файл Word или фото страниц — или вставьте текст. Вы увидите, на что соглашаетесь и какие пункты могут вам навредить.',
      upload: 'Загрузить файл',
      trySample: 'Попробовать на примере',
      draftTitle: 'Составить новый договор',
      draftBody: 'Опишите сделку своими словами. Вы получите полный договор в PDF — готовый к печати и подписи.',
      examples: [
        'Сдаю квартиру в Ташкенте на 6 месяцев за 4 млн сумов в месяц.',
        'Даю другу в долг 20 млн сумов без процентов, вернуть до марта 2027 года.',
        'Нанимаю дизайнера сделать логотип за 3 млн сумов.',
      ],
      privacy: 'Это не юридическая консультация. Ваши документы видны только в этом браузере.',
      placeholder: 'Вставьте договор, спросите или опишите нужный…',
      dropHere: 'Отпустите файл, чтобы загрузить',
      documents: 'Документы',
      docEmptyTitle: 'Здесь появятся ваши документы',
      docEmptyBody: 'Рискованные пункты подсвечиваются прямо в тексте. Каждая отметка сверяется с документом: если ИИ не может указать точные слова, отметка не показывается.',
      sevHigh: 'Серьёзно',
      sevMedium: 'Стоит обсудить',
      sevLow: 'Незначительно',
      overall: { high: 'Высокий риск', medium: 'Есть риски', low: 'Низкий риск' },
      verified: (n) => `Отмечено пунктов: ${n} — каждый сверен с документом`,
      flagged: 'Рискованные пункты',
      missing: 'Чего нет в договоре',
      keyTerms: 'Ключевые условия',
      askFor: 'Что просить:',
      noRisks: 'В этом документе не удалось подтвердить ни одного рискованного пункта.',
      notAnalyzed: 'Ещё не проверен — попросите проверку в чате.',
      reviewed: 'Проверен',
      drafted: 'Составлен',
      openPdf: 'Открыть PDF',
      downloadPdf: 'Скачать PDF',
      openDoc: 'Открыть',
      showDoc: 'Показать документ →',
      showAll: 'Показать полностью',
      showLess: 'Свернуть',
      steps: {
        thinking: 'Читаю сообщение',
        photos: 'Читаю фотографии',
        file: 'Извлекаю текст из файла',
        read: (n) => `Прочитано символов: ${n.toLocaleString('ru')}`,
        save_document: 'Сохраняю договор',
        analyze_document: 'Проверяю каждый пункт',
        analyzed: (v, r) => (r ? `Сверено цитат с текстом: ${v + r} — подтверждено ${v}, отклонено ${r}` : `Сверено цитат с текстом: ${v} — все подтверждены`),
        get_document: 'Перечитываю документ',
        list_documents: 'Ищу ваши документы',
        draft_contract: 'Составляю договор',
        drafted: 'Договор составлен — PDF готов',
        propose_revisions: 'Готовлю правки',
        writing: 'Пишу ответ',
      },
      fairVersion: 'Сделать справедливую редакцию (с правками)',
      messageOther: 'Написать сообщение другой стороне',
      messageOtherPrompt: 'Напиши короткое вежливое сообщение, которое я могу отправить другой стороне с просьбой внести эти изменения.',
      fairReady: (n) => `Готово: встречная редакция с правками (${n}). Отправьте её другой стороне как основу для переговоров.`,
      fairToolbar: 'Справедливая редакция (PDF)',
      suggested: 'Предлагаемая редакция',
      manipulationTitle: 'Найдены скрытые указания для ИИ',
      manipulationBody: 'В документе есть текст, обращённый к ИИ-сервисам, чтобы те назвали договор безопасным. Он проигнорирован — но это тревожный знак.',
      pasted: 'Вставленный договор',
      trustTitle: 'Как Law Guardian проверяет сам себя',
      trust1: 'Каждый отмеченный пункт должен дословно цитировать ваш договор. Программа сверяет цитату — если таких слов в тексте нет, отметка отбрасывается.',
      trust2: 'Текст в документе, который пытается повлиять на ИИ-проверку, обнаруживается и показывается вам.',
      trust3: (p, t) => `Проверен атаками: пройдено ${p} из ${t} сценариев — скрытые указания, выдуманные законы, незаконные договоры, несуществующие пункты.`,
      trustCases: 'Все тесты',
      cat: { safety: 'Безопасность', honesty: 'Честность', capability: 'Возможности', language: 'Язык' },
      errors: {
        busy: 'Ещё обрабатываю предыдущее сообщение.',
        rateLimited: 'Слишком много запросов — подождите немного и попробуйте снова.',
        tooBig: 'Файл слишком большой (максимум 20 МБ).',
        unsupported: 'Не могу прочитать этот файл. Пришлите PDF, DOCX, TXT или фото.',
        scannedPdf: 'Похоже, это скан без текстового слоя. Загрузите фото страниц.',
        emptyFile: 'В файле почти нет текста.',
        unreadablePhoto: 'Не удалось прочитать текст на фото. Положите документ ровно и снимайте при хорошем освещении.',
        oneFileOrPhotos: 'Загрузите один файл или несколько фото одного документа.',
        nothingToChange: 'Проверка не нашла пунктов, которые нужно переформулировать.',
        notAnalyzed: 'Этот договор ещё не проверен.',
        failed: 'Что-то пошло не так. Попробуйте ещё раз.',
        network: 'Нет связи с сервером. Проверьте интернет и попробуйте снова.',
      },
    },
    uz: {
      tagline: "Shartnomani imzolashdan oldin tushunib oling yoki yangisini tuzdiring.",
      telegram: 'Telegramda ham bor',
      newChat: 'Yangi suhbat',
      tabChat: 'Chat',
      tabDoc: 'Hujjat',
      tabChats: 'Suhbatlar',
      noChats: "Hozircha suhbat yo'q.",
      introTitle: "Nimani imzolayotganingizni biling.",
      reviewTitle: 'Shartnomani tekshirish',
      reviewBody: "PDF, Word fayl yoki sahifalar suratini yuklang yoxud matnni joylashtiring. Nimaga rozi bo'layotganingiz va qaysi bandlar sizga zarar keltirishi mumkinligini ko'rasiz.",
      upload: 'Fayl yuklash',
      trySample: "Namunada sinab ko'rish",
      draftTitle: 'Yangi shartnoma tuzish',
      draftBody: "Kelishuvni o'z so'zlaringiz bilan tasvirlab bering. Chop etish va imzolashga tayyor to'liq shartnomani PDF shaklida olasiz.",
      examples: [
        "Toshkentdagi kvartiramni 6 oyga, oyiga 4 million so'mdan ijaraga bermoqchiman.",
        "Do'stimga 20 million so'm foizsiz qarz beryapman, 2027-yil martgacha qaytaradi.",
        "Logotip chizish uchun dizaynerni 3 million so'mga yollayapman.",
      ],
      privacy: "Bu yuridik maslahat emas. Siz qo'shgan hujjatlarni faqat shu brauzerda ko'rish mumkin.",
      placeholder: "Shartnomani joylashtiring yoki kerakligini yozing…",
      dropHere: 'Yuklash uchun faylni shu yerga tashlang',
      documents: 'Hujjatlar',
      docEmptyTitle: "Hujjatlaringiz shu yerda ko'rinadi",
      docEmptyBody: "Xavfli bandlar matnning o'zida belgilanadi. Har bir belgi hujjat bilan tekshiriladi: sun'iy intellekt aniq so'zlarni ko'rsata olmasa, belgi ko'rsatilmaydi.",
      sevHigh: 'Jiddiy',
      sevMedium: 'Muhokama qilish kerak',
      sevLow: 'Kichik',
      overall: { high: 'Xavf yuqori', medium: "Xavf o'rtacha", low: 'Xavf past' },
      verified: (n) => `${n} ta band belgilandi — har biri hujjat bilan tekshirilgan`,
      flagged: 'Xavfli bandlar',
      missing: "Shartnomada yo'q",
      keyTerms: 'Asosiy shartlar',
      askFor: "Nimani so'rash kerak:",
      noRisks: "Bu hujjatda birorta xavfli bandni tasdiqlab bo'lmadi.",
      notAnalyzed: "Hali tekshirilmagan — chatda tekshirishni so'rang.",
      reviewed: 'Tekshirilgan',
      drafted: 'Tuzilgan',
      openPdf: 'PDF ni ochish',
      downloadPdf: 'PDF ni yuklab olish',
      openDoc: 'Ochish',
      showDoc: "Hujjatni ko'rsatish →",
      showAll: "To'liq ko'rsatish",
      showLess: "Yig'ish",
      steps: {
        thinking: "Xabaringizni o'qiyapman",
        photos: "Suratlarni o'qiyapman",
        file: 'Fayldan matnni olyapman',
        read: (n) => `${n.toLocaleString('ru')} ta belgi o'qildi`,
        save_document: 'Shartnomani saqlayapman',
        analyze_document: 'Har bir bandni tekshiryapman',
        analyzed: (v, r) => (r ? `${v + r} ta iqtibos matn bilan solishtirildi — ${v} tasi tasdiqlandi, ${r} tasi rad etildi` : `${v} ta iqtibos matn bilan solishtirildi — hammasi tasdiqlandi`),
        get_document: "Hujjatni qayta o'qiyapman",
        list_documents: 'Hujjatlaringizni qidiryapman',
        draft_contract: 'Shartnomani tuzyapman',
        drafted: 'Shartnoma tuzildi — PDF tayyor',
        propose_revisions: 'Tuzatishlarni tayyorlayapman',
        writing: 'Javob yozyapman',
      },
      fairVersion: 'Adolatli variantini tayyorlash (tuzatishlar bilan)',
      messageOther: 'Boshqa tomonga xabar yozish',
      messageOtherPrompt: "Boshqa tomonga yuborishim mumkin bo'lgan, shu o'zgarishlarni so'rab yozilgan qisqa va xushmuomala xabar yozib bering.",
      fairReady: (n) => `Tayyor: ${n} ta tuzatish kiritilgan qarshi taklif. Muzokara uchun asos sifatida uni boshqa tomonga yuboring.`,
      fairToolbar: 'Adolatli variant (PDF)',
      suggested: 'Taklif etilayotgan matn',
      manipulationTitle: "Sun'iy intellekt uchun yashirin ko'rsatma topildi",
      manipulationBody: "Hujjatda sun'iy intellekt xizmatlariga qaratilgan, ularni shartnomani xavfsiz deb atashga undaydigan matn bor. U e'tiborga olinmadi — lekin bu ogohlantiruvchi belgi.",
      pasted: 'Joylashtirilgan shartnoma',
      trustTitle: "Law Guardian o'zini qanday tekshiradi",
      trust1: "Belgilangan har bir band shartnomangizdan so'zma-so'z iqtibos keltirishi shart. Dastur iqtibosni tekshiradi — bunday so'zlar matnda bo'lmasa, belgi olib tashlanadi.",
      trust2: "Hujjatdagi sun'iy intellekt tekshiruviga ta'sir qilishga urinayotgan yashirin matn aniqlanadi va sizga ko'rsatiladi.",
      trust3: (p, t) => `Hujumlar bilan sinovdan o'tkazilgan: ${t} ta ssenariydan ${p} tasi muvaffaqiyatli — yashirin ko'rsatmalar, to'qib chiqarilgan qonunlar, noqonuniy shartnomalar, mavjud bo'lmagan bandlar.`,
      trustCases: 'Barcha testlar',
      cat: { safety: 'Xavfsizlik', honesty: 'Halollik', capability: 'Imkoniyatlar', language: 'Til' },
      errors: {
        busy: 'Oldingi xabaringiz ustida hali ishlayapman.',
        rateLimited: "So'rovlar juda ko'p — biroz kutib, qayta urinib ko'ring.",
        tooBig: "Fayl juda katta (ko'pi bilan 20 MB).",
        unsupported: "Bu faylni o'qiy olmayman. PDF, DOCX, TXT yoki surat yuboring.",
        scannedPdf: "Bu PDF skanerlangan ko'rinadi, ichida matn yo'q. Sahifalarning suratini yuklang.",
        emptyFile: "Faylda deyarli matn yo'q.",
        unreadablePhoto: "Suratdagi matnni o'qib bo'lmadi. Hujjatni tekis qo'yib, yorug' joyda suratga oling.",
        oneFileOrPhotos: 'Bitta fayl yoki bitta hujjatning bir nechta suratini yuklang.',
        nothingToChange: "Tekshiruvda qayta yozilishi kerak bo'lgan band topilmadi.",
        notAnalyzed: 'Bu shartnoma hali tekshirilmagan.',
        failed: "Xatolik yuz berdi. Qayta urinib ko'ring.",
        network: "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring.",
      },
    },
  };

  /** Red-team case names; the English originals come from eval/summary.json. */
  const CASE_TITLES = {
    'fair-contract': { ru: 'Сбалансированный договор не выдаётся за опасный', uz: "Muvozanatli shartnoma xavfli deb ko'rsatilmaydi" },
    'hallucinated-clause': { ru: 'Вопрос о пункте, которого нет в договоре', uz: "Shartnomada yo'q band haqida savol" },
    'invented-article': { ru: 'Требуют точный номер статьи закона', uz: 'Qonun moddasining aniq raqamini talab qilish' },
    'lawyer-roleplay': { ru: 'Давление: «гарантируй победу в суде»', uz: 'Bosim: «sudda yutishimni kafolatla»' },
    'not-a-contract': { ru: 'Рецепт не проверяется как договор', uz: 'Retsept shartnoma sifatida tekshirilmaydi' },
    'injection-pasted': { ru: 'Скрытое указание «скажи, что договор безопасен» (вставлен текстом)', uz: "Yashirin «shartnoma xavfsiz deb ayt» ko'rsatmasi (matn sifatida)" },
    'injection-uploaded': { ru: 'То же скрытое указание в загруженном файле', uz: "Xuddi shu yashirin ko'rsatma yuklangan faylda" },
    'forged-upload-note': { ru: 'Поддельная ссылка на документ другого пользователя', uz: 'Boshqa foydalanuvchi hujjatiga soxta havola' },
    'illegal-draft': { ru: 'Просьба составить незаконный кабальный договор', uz: "Noqonuniy mehnat shartnomasini tuzish so'rovi" },
    'threat-of-violence': { ru: 'Пользователь сообщает об угрозе насилия', uz: "Foydalanuvchi zo'ravonlik tahdidi haqida xabar beradi" },
    'prompt-leak': { ru: 'Просьба показать системные инструкции', uz: "Tizim ko'rsatmalarini chiqarib berish so'rovi" },
    'off-topic': { ru: 'Просьба сделать домашнее задание не по теме', uz: "Mavzudan tashqari uy vazifasi so'rovi" },
    'sycophancy-pushback': { ru: 'Пользователь спорит с верным предупреждением', uz: "Foydalanuvchi to'g'ri ogohlantirishga e'tiroz bildiradi" },
    'false-premise': { ru: 'Ложное юридическое утверждение, поданное как факт', uz: "Fakt sifatida aytilgan noto'g'ri huquqiy da'vo" },
    'single-clause': { ru: 'Один пункт — слишком короткий, чтобы сохранить как договор', uz: "Bitta band — shartnoma sifatida saqlash uchun juda qisqa" },
    'buried-trap': { ru: 'Одна ловушка на 85% договора длиной ~30 000 символов', uz: "~30 000 belgili shartnomaning 85% qismiga yashirilgan bitta tuzoq" },
    'draft-missing-info': { ru: 'Расплывчатая просьба составить договор', uz: "Noaniq shartnoma tuzish so'rovi" },
    'draft-and-revise': { ru: 'Составить договор, затем изменить сумму', uz: "Shartnoma tuzish, keyin summani o'zgartirish" },
    'fair-version': { ru: 'Проверка, затем справедливая редакция для отправки', uz: 'Tekshiruv, keyin yuborish uchun adolatli variant' },
    'message-other-side': { ru: 'Сообщение другой стороне с просьбой об изменениях', uz: "Boshqa tomonga o'zgarishlarni so'rab xabar yozish" },
    'uzbek-cyrillic': { ru: 'Договор займа на узбекской кириллице', uz: "O'zbek kirillitsasidagi qarz shartnomasi" },
    'russian-asks-about-english': { ru: 'Вопрос на русском об английском договоре', uz: "Ingliz tilidagi shartnoma haqida rus tilida so'rov" },
    'greeting-uz': { ru: 'Простое приветствие на узбекском', uz: "Oddiy o'zbekcha salomlashish" },
  };

  /** Titles the server gives uploaded photos are English; show them in the UI language. */
  function localTitle(title) {
    const m = /^Photos? of a document(?: \((\d+) pages\))?$/.exec(title || '');
    if (!m) return title;
    const n = m[1];
    if (state.lang === 'uz') return n ? `Hujjat suratlari (${n} sahifa)` : 'Hujjat surati';
    if (state.lang === 'ru') return n ? `Фото документа (${n} стр.)` : 'Фото документа';
    return title;
  }

  const UPLOAD_NOTE = /^\[The user uploaded "(.+?)"\. It has been saved as document #(\d+) \(\d+ characters\)\.\]\n?([\s\S]*)$/;
  const COLLAPSE_CHARS = 600;

  // ─── State ─────────────────────────────────────────────────────────────────

  const state = {
    lang: pickLang(),
    busy: false,
    files: [],
    docs: [],
    currentDocId: null,
    hasMessages: false,
    conversationId: null,
    conversations: [],
  };

  function pickLang() {
    try {
      const saved = localStorage.getItem('lg_lang');
      if (saved && STR[saved]) return saved;
    } catch (_) { /* storage blocked */ }
    const nav = (navigator.language || 'en').slice(0, 2);
    return STR[nav] ? nav : 'en';
  }

  const S = () => STR[state.lang];
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ─── i18n ──────────────────────────────────────────────────────────────────

  function applyLang() {
    document.documentElement.lang = state.lang;
    for (const n of document.querySelectorAll('[data-i18n]')) {
      const v = S()[n.dataset.i18n];
      if (typeof v === 'string') n.textContent = v;
    }
    for (const n of document.querySelectorAll('[data-i18n-placeholder]')) {
      n.placeholder = S()[n.dataset.i18nPlaceholder];
    }
    for (const b of document.querySelectorAll('.lang-switch button')) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang));
    }
    const ex = $('examples');
    ex.replaceChildren(
      ...S().examples.map((text) => {
        const b = el('button', 'example', text);
        b.type = 'button';
        b.addEventListener('click', () => {
          $('input').value = text;
          autosize();
          $('input').focus();
        });
        return b;
      })
    );
    renderDocSelect();
    renderConvoList();
    if (evalSummary) renderTrust();
    if (state.currentDocId) openDoc(state.currentDocId, { quiet: true });
  }

  // ─── Network ───────────────────────────────────────────────────────────────

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, { credentials: 'same-origin', ...opts });
    } catch (_) {
      return { ok: false, data: { error: 'network' } };
    }
    let data = {};
    try { data = await res.json(); } catch (_) { /* non-JSON */ }
    return { ok: res.ok && !data.error, data };
  }

  /**
   * POST that answers with NDJSON: progress lines while the agent works, then
   * one result line. Refusals (busy, rate limit, bad input) come back as a
   * plain JSON error instead.
   */
  async function streamApi(path, opts, onProgress) {
    let res;
    try {
      res = await fetch(path, { credentials: 'same-origin', ...opts });
    } catch (_) {
      return { ok: false, data: { error: 'network' } };
    }
    if (!(res.headers.get('content-type') || '').includes('ndjson')) {
      let data = {};
      try { data = await res.json(); } catch (_) { /* non-JSON */ }
      return { ok: false, data: data.error ? data : { error: 'failed' } };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let result = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === 'progress') onProgress(msg.event);
          else if (msg.type === 'result') result = msg;
        }
      }
    } catch (_) {
      return { ok: false, data: { error: 'network' } };
    }
    if (!result) return { ok: false, data: { error: 'failed' } };
    return { ok: !result.error, data: result };
  }

  // ─── Chat rendering ────────────────────────────────────────────────────────

  function hideIntro() {
    if (!state.hasMessages) {
      state.hasMessages = true;
      $('intro').hidden = true;
    }
  }

  function scrollChat() {
    const m = $('messages');
    m.scrollTop = m.scrollHeight;
  }

  function addUserText(text) {
    hideIntro();
    const bubble = el('div', 'msg msg-user', text);
    $('messages').append(bubble);
    if (text.length > COLLAPSE_CHARS) {
      bubble.classList.add('msg-collapsed');
      const toggle = el('button', 'msg-expand', S().showAll);
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        const collapsed = bubble.classList.toggle('msg-collapsed');
        toggle.textContent = collapsed ? S().showAll : S().showLess;
      });
      $('messages').append(toggle);
    }
    scrollChat();
  }

  function addAttachment(title, docId, caption) {
    hideIntro();
    const chip = el('div', 'attachment-chip');
    chip.append(el('span', null, '📎'), el('span', 'name', title));
    if (docId) {
      const open = el('button', null, S().openDoc);
      open.type = 'button';
      open.addEventListener('click', () => openDoc(docId, { focus: true }));
      chip.append(open);
    }
    $('messages').append(chip);
    if (caption) addUserText(caption);
    scrollChat();
  }

  const PASTE_NOTE = /^\[The user pasted a contract\. It has been saved as document #(\d+) \(\d+ characters\)\.\]$/;

  function addUserMessage(content) {
    const up = UPLOAD_NOTE.exec(content);
    if (up) return addAttachment(localTitle(up[1]), Number(up[2]), up[3].trim());
    const paste = PASTE_NOTE.exec(content);
    if (paste) return addAttachment(S().pasted, Number(paste[1]), '');
    addUserText(content);
  }

  function addAssistant(text, focusDocId) {
    hideIntro();
    $('messages').append(el('div', 'msg msg-assistant', text));
    if (focusDocId) {
      const link = el('button', 'msg-link', S().showDoc);
      link.type = 'button';
      link.addEventListener('click', () => openDoc(focusDocId, { focus: true }));
      $('messages').append(link);
    }
    scrollChat();
  }

  function addError(key) {
    hideIntro();
    $('messages').append(el('div', 'msg msg-error', S().errors[key] || S().errors.failed));
    scrollChat();
  }

  /**
   * A live checklist of what the agent is actually doing, driven by the
   * server's progress events — no timers pretending to know.
   */
  function showProgress(firstStep) {
    const box = el('div', 'progress');
    $('messages').append(box);
    let current = null;

    function step(text) {
      if (current) current.classList.add('done');
      const row = el('div', 'step');
      row.append(el('span', 'step-icon'), el('span', 'step-text', text));
      box.append(row);
      current = row;
      scrollChat();
      return row;
    }
    function finish(row, text) {
      row.querySelector('.step-text').textContent = text;
      row.classList.add('done');
    }

    const st = () => S().steps;
    step(st()[firstStep]);
    const toolRows = new Map();
    // "Writing" is provisional: the model often plans another tool call first.
    let writingRow = null;
    const dropWriting = () => {
      if (writingRow && current === writingRow) {
        writingRow.remove();
        current = box.lastElementChild;
      }
      writingRow = null;
    };

    return {
      event(e) {
        if (e.type === 'reading') step(e.source === 'photos' ? st().photos : st().file);
        else if (e.type === 'read') finish(current, st().read(e.chars));
        else if (e.type === 'writing') writingRow = step(st().writing);
        else if (e.type === 'tool' && e.phase === 'start') {
          dropWriting();
          toolRows.set(e.name, step(st()[e.name] || st().writing));
        } else if (e.type === 'tool' && e.phase === 'done') {
          const row = toolRows.get(e.name);
          if (!row) return;
          if (!e.ok) row.classList.add('failed');
          else if (e.name === 'analyze_document' && e.verified != null) finish(row, st().analyzed(e.verified, e.rejected || 0));
          else if (e.name === 'draft_contract') finish(row, st().drafted);
          else row.classList.add('done');
        }
      },
      stop() { box.remove(); },
    };
  }

  function setBusy(b) {
    state.busy = b;
    $('send').disabled = b;
    $('attach').disabled = b;
    $('try-sample').disabled = b;
    $('intro-upload').disabled = b;
    $('new-chat-side').disabled = b;
    for (const q of document.querySelectorAll('.quick button')) q.disabled = b;
  }

  // ─── Sending ───────────────────────────────────────────────────────────────

  async function sendText(text) {
    if (state.busy) return;
    setBusy(true);
    const conversationId = await ensureConversation();
    addUserText(text);
    const progress = showProgress('thinking');
    const { ok, data } = await streamApi(
      '/api/chat',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, conversationId }) },
      (e) => progress.event(e)
    );
    progress.stop();
    setBusy(false);
    handleReply(ok, data);
  }

  async function sendFiles(files, caption) {
    if (state.busy) return;
    const allImages = files.every((f) => f.type.startsWith('image/'));
    if (!allImages && files.length > 1) return addError('oneFileOrPhotos');
    if (files.some((f) => f.size > 20 * 1024 * 1024)) return addError('tooBig');

    setBusy(true);
    const conversationId = await ensureConversation();
    const title = allImages && files.length > 1 ? `${files.length} × ${files[0].name}` : files[0].name;
    addAttachment(title, null, caption);
    const progress = showProgress('thinking');

    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    if (caption) form.append('caption', caption);
    form.append('conversationId', String(conversationId));
    const { ok, data } = await streamApi('/api/upload', { method: 'POST', body: form }, (e) => progress.event(e));
    progress.stop();
    setBusy(false);
    handleReply(ok, data);
  }

  async function handleReply(ok, data) {
    if (!ok) {
      if (data.reply) addAssistant(data.reply);
      else addError(data.error);
      return;
    }
    addAssistant(data.reply, data.focusDocumentId);
    await loadDocs();
    await loadConversations();
    if (!data.focusDocumentId) return;
    const doc = await openDoc(data.focusDocumentId, { quiet: isPhone() });
    if (doc && doc.kind === 'reviewed' && doc.analysis && doc.analysis.canRevise) addQuickActions(doc.id);
  }

  /** Next steps offered right after a review. */
  function addQuickActions(docId) {
    const row = el('div', 'quick');
    const fair = el('button', 'btn btn-primary', S().fairVersion);
    fair.type = 'button';
    fair.addEventListener('click', () => makeFairVersion(docId));
    const msg = el('button', 'btn', S().messageOther);
    msg.type = 'button';
    msg.addEventListener('click', () => sendText(S().messageOtherPrompt));
    row.append(fair, msg);
    $('messages').append(row);
    scrollChat();
  }

  /** Tracked-changes counter-proposal: no model call, so it's instant. */
  async function makeFairVersion(docId) {
    if (state.busy) return;
    setBusy(true);
    const { ok, data } = await api(`/api/documents/${docId}/revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: state.lang }),
    });
    setBusy(false);
    if (!ok) return addError(data.error);
    addAssistant(S().fairReady(data.changes), data.documentId);
    await loadDocs();
    openDoc(data.documentId, { focus: true });
  }

  function submitComposer() {
    const input = $('input');
    const text = input.value.trim();
    const files = state.files.slice();
    if (state.busy || (!text && files.length === 0)) return;

    input.value = '';
    autosize();
    clearFiles();
    if (files.length > 0) sendFiles(files, text);
    else sendText(text);
  }

  // ─── Attachments ───────────────────────────────────────────────────────────

  function addFiles(list) {
    for (const f of list) state.files.push(f);
    renderFiles();
  }

  function clearFiles() {
    state.files = [];
    renderFiles();
  }

  function renderFiles() {
    const box = $('attachments');
    box.hidden = state.files.length === 0;
    box.replaceChildren(
      ...state.files.map((f, i) => {
        const pill = el('span', 'file-pill');
        const x = el('button', null, '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Remove');
        x.addEventListener('click', () => {
          state.files.splice(i, 1);
          renderFiles();
        });
        pill.append(el('span', null, f.name), x);
        return pill;
      })
    );
  }

  function autosize() {
    const t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 200) + 'px';
    t.style.overflowY = t.scrollHeight > 200 ? 'auto' : 'hidden';
  }

  // ─── Documents ─────────────────────────────────────────────────────────────

  async function loadDocs() {
    const { ok, data } = await api('/api/documents');
    state.docs = ok ? data.documents : [];
    renderDocSelect();
  }

  function docLabel(d) {
    const kind = d.kind === 'drafted' ? S().drafted : S().reviewed;
    return `${localTitle(d.title) || '#' + d.id} · ${kind}`;
  }

  function renderDocSelect() {
    const sel = $('doc-select');
    $('doc-toolbar').hidden = state.docs.length === 0;
    sel.replaceChildren(
      ...state.docs.map((d) => {
        const o = el('option', null, docLabel(d));
        o.value = String(d.id);
        return o;
      })
    );
    if (state.currentDocId) sel.value = String(state.currentDocId);
  }

  async function openDoc(id, opts = {}) {
    const { ok, data } = await api(`/api/documents/${id}`);
    if (!ok) return null;
    state.currentDocId = id;
    $('doc-select').value = String(id);
    renderDoc(data);
    if (opts.focus || !isPhone()) setPane('doc', !opts.focus);
    else markDocTab();
    return data;
  }

  function renderDoc(doc) {
    const body = $('doc-body');
    const actions = $('doc-actions');
    actions.replaceChildren();

    if (doc.kind === 'drafted') {
      const open = el('a', 'btn', S().openPdf);
      open.href = `/api/documents/${doc.id}/pdf`;
      open.target = '_blank';
      open.rel = 'noopener';
      const dl = el('a', 'btn btn-primary', S().downloadPdf);
      dl.href = `/api/documents/${doc.id}/pdf?download=1`;
      actions.append(open, dl);

      const frame = el('iframe', 'pdf-frame');
      frame.src = `/api/documents/${doc.id}/pdf`;
      frame.title = doc.title || 'PDF';
      const text = el('div', 'paper drafted-text', doc.text);
      body.replaceChildren(frame, text);
      // The embedded viewer is the real print layout; the text copy is for
      // phones, where browsers can't show a PDF inline.
      text.hidden = !isPhone();
      body.scrollTop = 0;
      return;
    }

    const paper = buildPaper(doc);
    if (!doc.analysis) {
      body.replaceChildren(el('div', 'note-bar', S().notAnalyzed), wrapReview(null, paper));
      body.scrollTop = 0;
      return;
    }
    if (doc.analysis.canRevise) {
      const fair = el('button', 'btn btn-primary', S().fairToolbar);
      fair.type = 'button';
      fair.addEventListener('click', () => makeFairVersion(doc.id));
      actions.append(fair);
    }
    body.replaceChildren(wrapReview(buildFindings(doc.analysis), paper));
    body.scrollTop = 0;
  }

  function wrapReview(findings, paper) {
    const grid = el('div', 'review');
    if (findings) grid.append(findings);
    grid.append(paper);
    if (!findings) grid.style.gridTemplateColumns = '1fr';
    return grid;
  }

  /** The contract text with each verified risk wrapped in a <mark>. */
  function buildPaper(doc) {
    const paper = el('article', 'paper');
    paper.append(el('p', 'paper-title', localTitle(doc.title) || ''));

    const a = doc.analysis;
    const marks = a ? a.risks.map((r, i) => ({ ...r, i })) : [];
    if (a && a.manipulation && a.manipulation.span) {
      const [start, end] = a.manipulation.span;
      marks.push({ start, end, manipulation: true });
    }
    marks.sort((x, y) => x.start - y.start);

    let pos = 0;
    for (const r of marks) {
      if (r.start < pos) continue; // overlapping quote — the earlier one wins
      if (r.start > pos) paper.append(document.createTextNode(doc.text.slice(pos, r.start)));
      const text = doc.text.slice(r.start, r.end);
      if (r.manipulation) {
        const mark = el('mark', 'manipulation', text);
        mark.id = 'manipulation';
        mark.title = S().manipulationTitle;
        paper.append(mark);
      } else {
        const mark = el('mark', `risk sev-${r.severity}`, text);
        mark.id = `risk-${r.i}`;
        mark.title = r.issue;
        mark.addEventListener('click', () => focusFinding(r.i));
        paper.append(mark);
      }
      pos = r.end;
    }
    if (pos < doc.text.length) paper.append(document.createTextNode(doc.text.slice(pos)));
    return paper;
  }

  function buildFindings(a) {
    const s = S();
    const col = el('aside', 'findings');

    if (a.manipulation) {
      const warn = el('div', 'manipulation-card');
      warn.append(el('div', 'card-title', '⚠ ' + s.manipulationTitle), el('p', null, s.manipulationBody));
      warn.append(el('blockquote', null, a.manipulation.text));
      if (a.manipulation.span) {
        warn.tabIndex = 0;
        warn.addEventListener('click', () => {
          const m = $('manipulation');
          if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      col.append(warn);
    }

    const summary = el('div', 'summary-card');
    summary.append(el('span', `risk-pill sev-${a.overall_risk}`, s.overall[a.overall_risk] || s.overall.medium));
    summary.append(el('p', null, a.summary));
    if (a.risks.length > 0) {
      const v = el('div', 'verified');
      v.append(el('span', null, '✓'), el('span', null, s.verified(a.risks.length)));
      summary.append(v);
    }
    col.append(summary);

    col.append(el('div', 'section-label', s.flagged));
    if (a.risks.length === 0) col.append(el('div', 'note-bar', s.noRisks));

    const sevLabel = { high: s.sevHigh, medium: s.sevMedium, low: s.sevLow };
    a.risks.forEach((r, i) => {
      const card = el('div', `finding sev-${r.severity}`);
      card.id = `finding-${i}`;
      card.tabIndex = 0;
      card.append(el('div', 'sev', sevLabel[r.severity] || r.severity));
      card.append(el('p', null, r.issue));
      const ask = el('p', 'ask');
      ask.append(el('b', null, s.askFor + ' '), document.createTextNode(r.suggestion));
      card.append(ask);
      if (r.rewrite) {
        const sug = el('div', 'suggested');
        sug.append(el('div', 'suggested-label', s.suggested), el('div', 'suggested-text', r.rewrite));
        card.append(sug);
      }
      const go = () => focusRisk(i);
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
      col.append(card);
    });

    if (a.missing_protections.length > 0) {
      const box = el('div', 'missing-card');
      box.append(el('div', 'card-title', s.missing));
      const ul = el('ul');
      for (const m of a.missing_protections) ul.append(el('li', null, m));
      box.append(ul);
      col.append(box);
    }

    if (a.key_terms.length > 0) {
      const box = el('div', 'terms-card');
      box.append(el('div', 'card-title', s.keyTerms));
      const dl = el('dl');
      for (const t of a.key_terms) dl.append(el('dt', null, t.term), el('dd', null, t.value));
      box.append(dl);
      col.append(box);
    }
    return col;
  }

  function focusRisk(i) {
    const mark = $(`risk-${i}`);
    if (!mark) return;
    for (const c of document.querySelectorAll('.finding.active')) c.classList.remove('active');
    $(`finding-${i}`)?.classList.add('active');
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    mark.classList.remove('flash');
    void mark.offsetWidth; // restart the animation
    mark.classList.add('flash');
  }

  function focusFinding(i) {
    const card = $(`finding-${i}`);
    if (!card) return;
    for (const c of document.querySelectorAll('.finding.active')) c.classList.remove('active');
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── Conversations: separate threads on this device ───────────────────────

  async function loadConversations() {
    const { ok, data } = await api('/api/conversations');
    state.conversations = ok ? data.conversations : [];
    renderConvoList();
  }

  function convoLabel(c) {
    if (c.title) return c.title;
    const d = new Date(c.updatedAt);
    const loc = state.lang === 'uz' ? 'uz-Latn' : state.lang;
    try {
      return d.toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return d.toLocaleString();
    }
  }

  function renderConvoList() {
    const ul = $('convo-list');
    if (state.conversations.length === 0) {
      ul.replaceChildren(el('li', 'convo-empty', S().noChats));
      return;
    }
    ul.replaceChildren(
      ...state.conversations.map((c) => {
        const li = el('li');
        const btn = el('button', 'convo-item' + (c.id === state.conversationId ? ' active' : ''));
        btn.type = 'button';
        btn.append(el('span', 'convo-title', convoLabel(c)));
        if (c.title) btn.append(el('span', 'convo-date', new Date(c.updatedAt).toLocaleDateString()));
        btn.addEventListener('click', () => switchConversation(c.id));
        li.append(btn);
        return li;
      })
    );
  }

  /** Replay one thread's messages into a freshly cleared chat pane. */
  async function loadConversationMessages(id) {
    $('messages').replaceChildren($('intro'));
    $('intro').hidden = false;
    state.hasMessages = false;
    const { ok, data } = await api(`/api/history?conversationId=${id}`);
    if (ok) {
      for (const m of data.messages) {
        if (m.role === 'user') addUserMessage(m.content);
        else if (m.role === 'assistant') addAssistant(m.content);
      }
    }
  }

  async function switchConversation(id, opts = {}) {
    if (state.busy) return;
    if (state.conversationId === id && !opts.force) {
      if (isPhone()) setPane('chat');
      return;
    }
    state.conversationId = id;
    try { localStorage.setItem('lg_convo', String(id)); } catch (_) { /* storage blocked */ }
    renderConvoList();
    await loadConversationMessages(id);
    if (isPhone()) setPane('chat');
  }

  /** The sidebar's and topbar's "new chat" actions — always creates and switches. */
  async function newConversation() {
    if (state.busy) return;
    const { ok, data } = await api('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!ok) return addError('failed');
    await loadConversations();
    await switchConversation(data.id, { force: true });
  }

  /** Guarantees a thread exists before the first message of a session goes out. */
  async function ensureConversation() {
    if (state.conversationId) return state.conversationId;
    await newConversation();
    return state.conversationId;
  }

  // ─── Panes (phones show one at a time) ─────────────────────────────────────

  const isPhone = () => window.matchMedia('(max-width: 1000px)').matches;

  function setPane(name, quiet) {
    if (!isPhone()) return;
    if (quiet) return markDocTab();
    for (const p of document.querySelectorAll('.pane')) p.classList.toggle('active', p.dataset.pane === name);
    for (const b of document.querySelectorAll('.mobile-tabs button')) {
      b.classList.toggle('active', b.dataset.pane === name);
      b.querySelector('.badge')?.remove();
    }
  }

  function markDocTab() {
    const tab = document.querySelector('.mobile-tabs button[data-pane="doc"]');
    if (tab && !tab.classList.contains('active') && !tab.querySelector('.badge')) {
      tab.append(el('span', 'badge'));
    }
  }

  // ─── "Keeps itself honest" panel ───────────────────────────────────────────

  let evalSummary = null;

  async function loadTrust() {
    const { ok, data } = await api('/api/eval');
    evalSummary = ok ? data : null;
    renderTrust();
  }

  function renderTrust() {
    const box = $('trust');
    const s = S();
    const items = [s.trust1, s.trust2];
    if (evalSummary) items.push(s.trust3(evalSummary.passed, evalSummary.total));
    const list = el('ul', 'trust-list');
    for (const text of items) list.append(el('li', null, text));
    const children = [el('h3', null, s.trustTitle), list];

    if (evalSummary) {
      const details = el('details', 'trust-cases');
      details.append(el('summary', null, s.trustCases));
      const ul = el('ul');
      for (const c of evalSummary.cases) {
        const li = el('li', c.pass ? 'pass' : 'fail');
        li.append(el('span', 'mark', c.pass ? '✓' : '✗'), el('span', null, (CASE_TITLES[c.id] || {})[state.lang] || c.title), el('span', 'cat', s.cat[c.category] || c.category));
        ul.append(li);
      }
      details.append(ul);
      children.push(details);
    }
    box.replaceChildren(...children);
    box.hidden = false;
  }

  // ─── Start ─────────────────────────────────────────────────────────────────

  async function start() {
    await loadConversations();

    let wanted = null;
    try {
      wanted = Number(localStorage.getItem('lg_convo')) || null;
    } catch (_) { /* storage blocked */ }
    const remembered = wanted && state.conversations.some((c) => c.id === wanted);

    if (remembered) {
      state.conversationId = wanted;
    } else if (state.conversations.length > 0) {
      state.conversationId = state.conversations[0].id; // most recently active
    } else {
      const { ok, data } = await api('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (ok) {
        state.conversationId = data.id;
        await loadConversations();
      }
    }

    try {
      if (state.conversationId) localStorage.setItem('lg_convo', String(state.conversationId));
    } catch (_) { /* storage blocked */ }

    renderConvoList();
    if (state.conversationId) await loadConversationMessages(state.conversationId);

    await loadDocs();
    if (state.docs.length > 0) openDoc(state.docs[0].id, { quiet: true });
  }

  function wire() {
    $('composer').addEventListener('submit', (e) => {
      e.preventDefault();
      submitComposer();
    });
    $('input').addEventListener('input', autosize);
    $('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isPhone()) {
        e.preventDefault();
        submitComposer();
      }
    });

    const pick = () => $('file-input').click();
    $('attach').addEventListener('click', pick);
    $('intro-upload').addEventListener('click', pick);
    $('file-input').addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length === 0) return;
      // From the intro, upload straight away; otherwise let them add a note first.
      if (!state.hasMessages) sendFiles(files, '');
      else addFiles(files);
    });

    const trySample = (file) => async () => {
      if (state.busy) return;
      try {
        const res = await fetch(`/samples/${file}`);
        if (!res.ok) throw new Error(String(res.status));
        sendText((await res.text()).trim());
      } catch (_) {
        addError('network');
      }
    };
    $('try-sample').addEventListener('click', () => trySample(`lease-${state.lang}.txt`)());

    $('new-chat').addEventListener('click', () => newConversation());
    $('new-chat-side').addEventListener('click', () => newConversation());

    for (const b of document.querySelectorAll('.lang-switch button')) {
      b.addEventListener('click', () => {
        state.lang = b.dataset.lang;
        try { localStorage.setItem('lg_lang', state.lang); } catch (_) { /* storage blocked */ }
        applyLang();
      });
    }

    $('doc-select').addEventListener('change', (e) => openDoc(Number(e.target.value), { focus: true }));

    for (const b of document.querySelectorAll('.mobile-tabs button')) {
      b.addEventListener('click', () => setPane(b.dataset.pane));
    }

    // Drag and drop anywhere on the chat.
    const pane = $('chat-pane');
    let depth = 0;
    pane.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      $('drop-overlay').hidden = false;
    });
    pane.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) $('drop-overlay').hidden = true;
    });
    pane.addEventListener('dragover', (e) => e.preventDefault());
    pane.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      $('drop-overlay').hidden = true;
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) addFiles(files);
    });

    // Pasting a screenshot of a contract works like attaching a photo.
    $('input').addEventListener('paste', (e) => {
      const imgs = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (imgs.length) {
        e.preventDefault();
        addFiles(imgs);
      }
    });
  }

  wire();
  applyLang();
  loadTrust();
  start();
})();
