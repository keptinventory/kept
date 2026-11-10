import { pluralOf } from '../locale.js';
import type { PdfWords } from './types.js';

// Ukrainian: every PDF's words, as the English (en.ts); the web catalogue's terms (річ, місце,
// локація, Без місця, серійний номер) and its "ви". A count takes the noun in the form its number
// asks for: 1 річ, 2 речі, 5 речей, 1,5 речі. "Created by" is written impersonally
// ("Створено: …"), so a name needs no gender.

const things = (n: number, f: string) => {
  const form = pluralOf('uk', n);
  return form === 'one'
    ? `${f} річ`
    : form === 'few'
      ? `${f} речі`
      : form === 'many'
        ? `${f} речей`
        : `${f} речі`;
};

const condition = {
  new: 'Нове',
  good: 'Добрий',
  fair: 'Задовільний',
  poor: 'Поганий',
  broken: 'Зламано',
};

const lifecycle = {
  archived: 'В архіві',
  sold: 'Продано',
  given_away: 'Віддано',
  lost: 'Втрачено',
  disposed: 'Утилізовано',
  stolen: 'Викрадено',
  destroyed: 'Знищено',
  returned_to_owner: 'Повернуто власнику',
};

const inventory: PdfWords['inventory'] = {
  title: 'Інвентаризаційний звіт',
  things: 'Речі',
  places: 'Місця',
  photos: 'З фото',
  totals: 'Підсумки за валютами',
  contents: 'Зміст',
  page: 'Сторінка',
  of: 'з',
  serial: 'Серійний номер',
  subtotal: 'Проміжний підсумок',
  bought: 'Куплено',
  confidential:
    'Приватне: перелік того, що вам належить. Зберігайте його так само дбайливо, як речі, які в ньому перелічено.',
  empty: 'Цьому звіту ніщо не відповідає.',
  unplaced: 'Без місця',
  trashed: 'У кошику',
  allLocations: 'Усі локації',
  locationsList: (names) => `Охоплює: ${names}`,
  generated: (who, when) => `Створено: ${who}, ${when}`,
  moneyPartial: 'Ціни показано лише для локацій, де ви можете бачити суми.',
  thingCount: things,
  filterPlaces: 'Місця',
  filterTypes: 'Типи',
  filterTags: 'Теги',
  withEnded: 'Включно з речами, які більше не використовуються',
  withTrashed: 'Включно з речами в кошику',
  condition,
  lifecycle,
};

const readable: PdfWords['readable'] = {
  title: 'Копія для читання',
  intro:
    'Усе в цій локації, як його зберігав Kept. Щоб відкрити, достатньо браузера: фото, чеки й документи відкриваються з файлів поруч.',
  exported: (when) => `Експортовано ${when}`,
  places: 'Місця',
  things: 'Речі',
  photo: 'Фото',
  name: 'Назва',
  shortId: 'Короткий ID',
  type: 'Тип',
  brandModel: 'Марка й модель',
  quantity: 'Кількість',
  condition: 'Стан',
  tags: 'Теги',
  lastSeen: 'Востаннє бачено',
  files: 'Файли',
  inside: 'У',
  ownPage: 'На окремій сторінці',
  spreadsheets: 'Таблиці (CSV)',
  pdf: 'Інвентаризаційний звіт (PDF)',
  pdfLeftOut: (n, max) =>
    `Інвентаризаційний звіт (PDF) не додано: він вміщує щонайбільше ${things(n, max)}. Усі речі перелічено нижче та в things.csv.`,
  pdfFailed:
    'Цього разу не вдалося створити інвентаризаційний звіт (PDF). Усі речі перелічено нижче.',
  moneyHidden: 'Ціни не додано: їх приховано від людини, яка зробила цей експорт.',
  secretsWithheld:
    'Секретні значення не додано: цей експорт зроблено без них. Файли даних називають кожне поле, яке мало таке значення.',
  empty: 'Тут нічого немає.',
  fileRole: {
    photo: 'Фото',
    receipt: 'Чек',
    invoice: 'Рахунок',
    manual: 'Інструкція',
    warranty_doc: 'Гарантія',
    proof: 'Доказ',
    condition_out: 'Стан під час позичання',
    condition_in: 'Стан під час повернення',
    registration: 'Реєстрація',
    document: 'Документ',
  },
  conditions: condition,
  lifecycles: lifecycle,
};

const insurance: PdfWords['insurance'] = {
  title: 'Страховий звіт',
  totals: 'Підсумки за валютами',
  converted: (ccy) => `У ${ccy}:`,
  subtotal: 'Проміжний підсумок',
  thing: 'Річ',
  purchase: 'Покупка',
  value: 'Поточна вартість',
  receipts: 'Чеки',
  serial: 'Серійний номер',
  page: 'Сторінка',
  of: 'з',
  empty: 'Немає що перелічити.',
  asOf: (day) => `Станом на ${day}`,
  owner: (name) => `Власник: ${name}`,
  generated: (who, when) => `Створено: ${who}, ${when}`,
  ratesOf: (days) => `за курсами на ${days}`,
  purchaseFallback: 'Речі без оцінки враховано за ціною покупки.',
  noMoney: 'У цій локації суми від вас приховано.',
  incident: {
    burglary: 'Крадіжка зі зломом',
    fire: 'Пожежа',
    flood: 'Затоплення',
    loss: 'Втрата',
    other: 'Страхова подія',
  },
  police: (ref) => `Номер справи в поліції: ${ref}`,
  insurer: (ref) => `Номер справи у страховика: ${ref}`,
  occurred: (day) => `Дата події: ${day}`,
};

const conditionReport: PdfWords['condition'] = {
  title: 'Звіт про стан',
  kinds: { move_in: 'Заселення', move_out: 'Виселення' },
  conditions: { good: 'Добрий', fair: 'Задовільний', poor: 'Поганий', damaged: 'Пошкоджено' },
  notRecorded: 'Не записано',
  rooms: 'Кімнати',
  photos: 'Фото',
  notes: 'Нотатки',
  page: 'Сторінка',
  of: 'з',
  contents: 'Зміст',
  confidential:
    'Приватне: запис стану цього житла. Діліться ним з орендодавцем або агентом, і більше ні з ким.',
  empty: 'У цьому звіті немає кімнат.',
  notInReport: 'Немає в цьому звіті.',
  photoNote: 'Час кожного фото — це час, коли Kept його отримав.',
  draft: 'Не завершено: цей звіт ще може змінитися.',
  started: (who) => `Розпочато: ${who}`,
  finished: (who, when) => `Завершено: ${who}, ${when}`,
  generated: (who, when) => `Створено: ${who}, ${when}`,
  more: (n) => `ще ${n} у Kept`,
};

const move: PdfWords['move'] = {
  title: 'Аркуші вмісту',
  box: (n) => `Коробка ${n}`,
  goesTo: 'Призначається до',
  noRoom: 'Кімнату ще не вибрано',
  contents: (n) => `Вміст (${n})`,
  empty: 'У цій коробці ще нічого немає.',
  quantity: 'К-сть',
  id: 'ID',
  holds: (n) => `містить ${n}`,
  more: (n) => `ще ${n} у Kept`,
  states: { packed: 'Зібрано', in_transit: 'У дорозі', unpacked: 'Розпаковано' },
  route: (from, to) => `${from} → ${to}`,
  scan: 'Відскануйте код, щоб побачити цю коробку в Kept і розпакувати її.',
  generated: (who, when) => `Надруковано: ${who}, ${when}`,
  none: 'Немає коробок для друку.',
};

const vehicle: PdfWords['vehicle'] = {
  title: 'Історія транспортного засобу',
  cover: {
    type: 'Тип',
    shortId: 'Короткий ID',
    vin: 'VIN',
    plate: 'Номерний знак',
    location: 'Локація',
    odometer: 'Одометр',
  },
  readings: 'Історія одометра',
  proofs: 'Фото одометра',
  services: 'Сервісне обслуговування',
  fuel: 'Паливо',
  documents: 'Документи',
  date: 'Дата',
  reading: 'Показник',
  source: 'Джерело',
  by: 'Ким',
  proof: 'Фото',
  item: 'Позиція',
  qty: 'К-сть',
  amount: 'Сума',
  total: 'Разом',
  year: 'Рік',
  fills: 'Заправлення',
  fuelAmount: 'Паливо',
  name: 'Документ',
  issued: 'Видано',
  expires: 'Діє до',
  state: 'Статус',
  cost: 'Вартість',
  page: 'Сторінка',
  of: 'з',
  contents: 'Зміст',
  confidential:
    'Приватне: історія одного транспортного засобу. Діліться нею з тими, кому вона потрібна, і більше ні з ким.',
  none: 'Нічого не записано.',
  readingsCount: 'Показники',
  servicesCount: 'Обслуговування',
  proofsCount: 'Фото одометра',
  documentsCount: 'Документи',
  consumption: 'Витрата, останні 5 повних заправлень',
  perDistance: (unit) => `Вартість палива за ${unit}, останні 12 місяців`,
  monthly: 'Паливо за місяць, останні 12 місяців',
  noConsumption: 'Ще недостатньо повних заправлень із показником.',
  readingsNote:
    'Кожен показник із фото чи введений вручну, а також останній за кожен місяць. Заправлення й обслуговування показують власні показники у своїх розділах.',
  sources: {
    manual: 'Введено',
    photo: 'Фото',
    fuel: 'Заправлення',
    service: 'Сервіс',
    import: 'Імпортовано',
    home_assistant: 'Home Assistant',
  },
  docKinds: {
    registration: 'Реєстрація',
    insurance: 'Страхування',
    licence: 'Ліцензія',
    inspection: 'Перевірка',
    lease: 'Оренда',
    contract: 'Договір',
  },
  docStates: { current: 'Чинний', expired: 'Прострочено', renewed: 'Поновлено' },
  units: { L: 'л', kWh: 'кВт-год', gal: 'гал' },
  distance: { km: 'км', mi: 'миль', h: 'год' },
  generated: (who, when) => `Створено: ${who}, ${when}`,
  asOf: (day) => `Станом на ${day}`,
  range: (from, to) => `З ${from} по ${to}`,
  more: (n) => `ще ${n} у Kept`,
  moreInvoices: (n) => `+${n}`,
  moneyHidden: 'Витрати не додано: у цій локації їх від вас приховано.',
  per100: (fuel, distance) => `${fuel}/100 ${distance}`,
  mpg: (v) => `${v} миль на галон`,
  miPerKwh: (v) => `${v} миль/кВт-год`,
  perHour: (v, fuel) => `${v} ${fuel} на годину`,
};

export const UK: PdfWords = {
  inventory,
  readable,
  insurance,
  condition: conditionReport,
  move,
  vehicle,
};
