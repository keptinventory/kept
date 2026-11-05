import { readFileSync } from 'node:fs';
import { TOOL_DEFS, type ToolName } from '@kept/mcp';
import { ASSISTANT_OUTPUT, MODULE_IDS, REASONING_ALLOWANCE } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { requestTokens } from '../ai/call.js';
import type { KeptMessage } from '../ai/convert.js';
import { MOCK_SCRIPTS_PATH } from '../ai/mock-script.js';
import { toolsIn } from '../tools/context.js';
import { fitToCeiling } from './fit.js';
import { instructionsFor, toolSpecOf } from './prompt.js';
import { askOf, CORE_TOOLS, offeredTools } from './select.js';

const owner = { userId: 'u', mfa: true, scope: 'write' as const };
/** Every tool the assistant may call with every module on, as an owner. */
const ALL = toolsIn(owner, 'assistant', 'owner', new Set(MODULE_IDS));
const offered = (question: string, used: string[] = []) =>
  offeredTools(ALL, { questions: [question], used })[0] as ToolName[];

describe('choosing the tools a step offers', () => {
  it('a question naming no topic gets the core: finding things and the everyday changes', () => {
    expect(offered('Are you working?')).toEqual(ALL.filter((t) => CORE_TOOLS.includes(t)));
    expect(offered('Are you working?')).toEqual([
      'capabilities',
      'list_locations',
      'search_things',
      'where_is',
      'get_thing',
      'list_contents',
      'add_thing',
      'update_thing',
      'move_thing',
      'mark_seen',
    ]);
  });

  it.each([
    ['Who borrowed the ladder?', 'lend_thing'],
    ['I lent the drill to Louis', 'lend_thing'],
    ['Louis gave the ladder back', 'return_thing'],
    ['The drill came back', 'return_thing'],
    ['Il trapano è tornato', 'return_thing'],
    ['أعرت المثقاب لبروس', 'lend_thing'],
    ['J’ai prêté la perceuse à Louis', 'lend_thing'],
    ['Ich habe die Leiter verliehen', 'lend_thing'],
    ['Ho prestato il trapano a Louis', 'lend_thing'],
    ['I handed the camera kit to Talia', 'lend_thing'],
    ['Ich habe Peter die Kamera übergeben', 'lend_thing'],
    ['What is due this week?', 'upcoming'],
    ['ما الصيانة القادمة؟', 'upcoming'],
    ['Was ist diese Woche fällig?', 'upcoming'],
    ['Quali sono le scadenze?', 'upcoming'],
    ['I cleaned the filter, mark the task done', 'complete_schedule'],
    ['Postpone the boiler service to May', 'snooze_schedule'],
    ['Where is the receipt for the TV?', 'find_documents'],
    ['أين فاتورة التلفزيون؟', 'find_documents'],
    ['Où est la facture de la télé ?', 'find_documents'],
    ['The TV has a two-year warranty', 'add_warranty'],
    ['Open a claim for the broken kettle', 'open_claim'],
    ['الغلاية عليها ضمان سنتين', 'add_warranty'],
    ['I filled up the car: 40 litres', 'log_fuel'],
    ['Die Inspektion am Auto ist gemacht', 'log_service'],
    ['The odometer reads 52,300 km', 'log_reading'],
    ['فولت العربية بنزين', 'log_fuel'],
    ['Abbiamo fatto il pieno di benzina', 'log_fuel'],
    ['We ran out of AA batteries', 'adjust_stock'],
    ['خلص الصابون', 'adjust_stock'],
    ['What happened to the kettle?', 'thing_history'],
    ['Who moved the HD webcam?', 'thing_history'],
    ['Add a shelf in the study', 'create_place'],
    ['Rename the study to Office', 'update_place'],
    ['Put the shelves in custom order', 'update_place'],
    ['Turn the crates into boxes', 'turn_into_boxes'],
    ['حوّل الرفوف إلى صناديق', 'turn_into_boxes'],
    ['Renommer la pièce en bureau', 'update_place'],
    ['I want to add a photo of the receipt', 'attach_link'],
    ['Tag the tent and the cool box camping', 'tag_things'],
    ['Which tags do we have?', 'list_tags'],
    ['ضع وسم التخييم على الخيمة', 'tag_things'],
    ['Quels tags avons-nous ?', 'list_tags'],
    ['Turn the Kallax on its side', 'update_place'],
    ['Add a kitchen, 4 by 3 metres', 'create_place'],
    ['Tourne la bibliothèque sur le côté', 'update_place'],
    ['Ajoute une cuisine de 4 mètres sur 3', 'create_place'],
    ['Leg das Kallax auf die Seite', 'update_place'],
    ['Füge eine Küche hinzu, 4 mal 3 Meter', 'create_place'],
    ['Metti il Kallax sul fianco', 'update_place'],
    ['Aggiungi una cucina di 4 metri per 3', 'create_place'],
    ['اقلب الكالاكس على جنبه', 'update_place'],
    ['أضف مطبخ ٤ في ٣ متر', 'create_place'],
    ['Cho mượn máy khoan cho Louis', 'lend_thing'],
    ['Louis đã trả cái thang', 'return_thing'],
    ['Lịch bảo dưỡng nào đến hạn tuần này?', 'upcoming'],
    ['Hóa đơn của TV ở đâu?', 'find_documents'],
    ['Hoá đơn của TV ở đâu?', 'find_documents'],
    ['TV còn bảo hành không?', 'add_warranty'],
    ['Tôi vừa đổ xăng cho xe máy', 'log_fuel'],
    ['Thêm một phòng bếp 4 x 3 mét', 'create_place'],
    ['Xoay tủ sách nằm nghiêng', 'update_place'],
    ['Chuyển các kệ thành hộp', 'turn_into_boxes'],
    ['Gắn thẻ cắm trại cho cái lều', 'tag_things'],
    ['Pin AA còn lại bao nhiêu?', 'adjust_stock'],
    ['Ai đã chuyển webcam HD?', 'thing_history'],
    // A room with its size, said as people say it.
    ['Add a bedroom, 4 by 3', 'create_place'],
    ['Add a bathroom 2.5 x 2 m', 'create_place'],
    ['Add a kitchen, 4m by 3m', 'create_place'],
    ['Ajoute une chambre de 4 sur 3', 'create_place'],
    ['Füge ein Schlafzimmer hinzu, 4 x 3 m', 'create_place'],
    ['Leg ein Badezimmer an', 'create_place'],
    ['Aggiungi una camera da letto 4x3', 'create_place'],
    ['un bagno di 3 per 2 m', 'create_place'],
    ['أضف مطبخ ٤ في ٣', 'create_place'],
    ['Pin AA còn mấy cái?', 'adjust_stock'],
    ['Lịch bảo trì của máy lọc nước', 'upcoming'],
    // Ukrainian, inflected as it is asked.
    ['Я позичив дриль Луїсу', 'lend_thing'],
    ['Позичила драбину Брюсу', 'lend_thing'],
    ['Кому я дав камеру?', 'lend_thing'],
    ['У кого драбина?', 'lend_thing'],
    ['Хто взяв камеру?', 'lend_thing'],
    ['Брюс забрав камеру', 'lend_thing'],
    ['Ми передали камеру Талії', 'lend_thing'],
    ['Луїс повернув драбину', 'return_thing'],
    ['Дриль повернули', 'return_thing'],
    ['Що треба зробити цього тижня?', 'upcoming'],
    ['Що на цьому тижні?', 'upcoming'],
    ['Яке обслуговування прострочене?', 'upcoming'],
    ['Нагадай про фільтр', 'upcoming'],
    ['Який наступний термін?', 'upcoming'],
    ['Завдання виконано', 'complete_schedule'],
    ['Відклади обслуговування котла на травень', 'snooze_schedule'],
    ['Де чек на телевізор?', 'find_documents'],
    ['Де чек?', 'find_documents'],
    ['Немає чека на чайник', 'find_documents'],
    ['Знайди квитанцію', 'find_documents'],
    ['Де інструкція до чайника?', 'find_documents'],
    ['Покажи документи на телевізор', 'find_documents'],
    ['Рахунку за чайник немає', 'find_documents'],
    ['У телевізора гарантія на два роки', 'add_warranty'],
    ['Чайник ще на гарантії?', 'add_warranty'],
    ['Гарантійний талон на чайник', 'add_warranty'],
    ['Відкрий рекламацію на чайник', 'open_claim'],
    ['Чайник зламався', 'open_claim'],
    ['Телевізор не працює, потрібен ремонт', 'open_claim'],
    ['Заправив автомобіль: 40 літрів', 'log_fuel'],
    ['Залив бензин в авто', 'log_fuel'],
    ['Заправив мою машину', 'log_fuel'],
    ['Пробіг 52 300 км', 'log_reading'],
    ['Показання лічильника електроенергії', 'log_reading'],
    ['Пройшов техогляд автівки', 'log_service'],
    ['Замінили шини на зимові', 'log_service'],
    ['Замінив масло в машині', 'log_service'],
    ['Закінчились батарейки AA', 'adjust_stock'],
    ['Скільки мила залишилось?', 'adjust_stock'],
    ['Поповни запас мила', 'adjust_stock'],
    ['Запасів батарейок немає', 'adjust_stock'],
    ['Використали всі фільтри', 'adjust_stock'],
    ['Що сталося з чайником?', 'thing_history'],
    ['Хто перемістив вебкамеру?', 'thing_history'],
    ['Історія телевізора', 'thing_history'],
    ['Коли я купив чайник?', 'thing_history'],
    ['Додай полицю в кабінеті', 'create_place'],
    ['Створи кімнату', 'create_place'],
    ['Що у спальні?', 'create_place'],
    ['Шафа в коридорі', 'create_place'],
    ['Перейменуй кабінет на офіс', 'update_place'],
    ['Зміни порядок полиць', 'update_place'],
    ['Поверни Kallax на бік', 'update_place'],
    ['Перетвори ящики на коробки', 'turn_into_boxes'],
    ['Додай фото чека', 'attach_link'],
    ['Постав тег кемпінг на намет', 'tag_things'],
    ['Які теги у нас є?', 'list_tags'],
    ['Познач намет міткою', 'tag_things'],
    ['Скільки міток?', 'list_tags'],
    // A Ukrainian room with its size; a phone's "х" is often the Cyrillic letter.
    ['Додай майстерню 4 на 3', 'create_place'],
    ['Додай майстерню 4 м на 3 м', 'create_place'],
    ['Додай майстерню, 4 метри на 3', 'create_place'],
    ['Майстерня 3,5 на 2,5', 'create_place'],
    ['Майстерня 4х3', 'create_place'],
  ] as const)('“%s” offers %s', (question, tool) => {
    expect(offered(question)).toContain(tool);
    // The core is always there.
    for (const t of CORE_TOOLS) expect(offered(question)).toContain(t);
  });

  it.each([
    ['What size is the TV?', 'create_place'],
    ['How long is the HDMI cable? What length?', 'create_place'],
    ['Who turned the heater on?', 'update_place'],
    ['Where is the upright vacuum?', 'update_place'],
    ['Where is the 5 metre tape measure?', 'create_place'],
    ['Dov’è il metro a nastro?', 'create_place'],
    ['Dov’è la ruota di scorta?', 'update_place'],
    ['Wo ist der Drehmomentschlüssel?', 'update_place'],
    ['Où est le mètre ruban ?', 'create_place'],
    ['Where is my camera?', 'create_place'],
    ['كم كيلومتر على العداد؟', 'create_place'],
    ['Máy ảnh ở đâu?', 'create_place'],
    ['Tủ lạnh mua khi nào?', 'create_place'],
    ['Trả lời giúp tôi: cái khoan ở đâu?', 'return_thing'],
    ['Thẻ nhớ ở đâu?', 'tag_things'],
    ['Lịch sử của cái TV', 'upcoming'],
    ['Đồ du lịch để ở đâu?', 'upcoming'],
    ['Де мій фотоапарат?', 'create_place'],
    ['Де спальний мішок?', 'create_place'],
    ['Де кухонний ніж?', 'create_place'],
    ['Де місцевий путівник?', 'create_place'],
    ['Де кімнатна рослина?', 'create_place'],
    ['Де ванночка?', 'create_place'],
    ['Де сканер?', 'create_place'],
    ['Де шафран?', 'create_place'],
    ['Який розмір телевізора?', 'create_place'],
    ['Де рулетка на 5 метрів?', 'create_place'],
    ['Хто увімкнув обігрівач?', 'update_place'],
    ['Де вертикальний пилосос?', 'update_place'],
    ['Все в порядку?', 'update_place'],
    ['Де паперові рушники?', 'find_documents'],
    ['Де пральна машина?', 'log_fuel'],
    ['Де автор цієї книги?', 'log_fuel'],
    ['Де автомат?', 'log_fuel'],
    ['Де шинка?', 'log_fuel'],
    ['Де газонокосарка?', 'log_fuel'],
    ['Де бензопила?', 'log_fuel'],
    ['Де вершкове масло?', 'log_service'],
    ['Де сервіз?', 'log_service'],
    ['Де запасне колесо?', 'adjust_stock'],
    ['Я залишила ключі на столі', 'adjust_stock'],
    ['Де розкладний стіл?', 'upcoming'],
    ['Де термінал?', 'upcoming'],
    ['Де графіка до книги?', 'upcoming'],
    ['Давно купив дриль', 'lend_thing'],
    ['Де передавач?', 'lend_thing'],
    ['Де віддалений пульт?', 'lend_thing'],
    ['Де поверхня столу?', 'return_thing'],
    ['Де колиска?', 'thing_history'],
  ] as const)('“%s” is an ordinary question: no %s', (question, tool) => {
    expect(offered(question)).not.toContain(tool);
  });

  it('matches a word’s start in Latin scripts: “scarves” is not a car', () => {
    expect(offered('Where are the winter scarves?')).not.toContain('log_fuel');
    expect(offered('Where are the winter scarves?')).not.toContain('log_service');
  });

  it('matches Vietnamese whole words with their tone marks: “muốn” (want) is not “mượn” (borrow)', () => {
    expect(offered('Tôi muốn tìm máy khoan')).not.toContain('lend_thing');
    expect(offered('Tôi muốn tìm máy khoan')).toEqual(offered('Are you working?'));
  });

  it('matches a Ukrainian stem at a word’s start, and a short word whole: “чекаю” (wait) is not “чек”', () => {
    // A stem matches at a word’s start: “коли” (when) finds “Коли я…”, but a whole short
    // keyword must not run into a longer word — “колишній” (former) is not “коли”.
    expect(offered('Де колишній телевізор?')).toEqual(offered('Are you working?'));
    // “чекаю” (I wait) is not the receipt stem “чека/чек”.
    expect(offered('Я чекаю на посилку')).toEqual(offered('Are you working?'));
  });

  it('folds й and ї in Ukrainian on both sides, whichever way a keyboard writes them', () => {
    expect(offered('Що у гарантіі?')).toContain('add_warranty');
    expect(offered('Перейменуи кабінет')).toContain('update_place');
    expect(offered('Перейменуй кабінет'.normalize('NFD'))).toContain('update_place');
  });

  it('keeps a tool the thread already used, and one the model asked for and was not offered', () => {
    expect(offered('and the drill?', ['lend_thing'])).toContain('lend_thing');
    expect(offered('and the drill?', ['start_move'])).not.toContain('start_move');
  });

  it('never offers a tool the person may not call, in the order the registry lists them', () => {
    const viewer = toolsIn(owner, 'assistant', 'viewer', new Set(MODULE_IDS));
    const picked = offeredTools(viewer, { questions: ['I lent the drill to Louis'], used: [] })[0];
    expect(picked?.every((t) => TOOL_DEFS[t].scope === 'read')).toBe(true);
    expect(picked).toEqual(viewer.filter((t) => picked?.includes(t)));
  });

  it('moving tools are MCP’s only: a moving question still finds things, with no moving tool', () => {
    const picked = offered('Which boxes are still packed for the move?');
    expect(picked).toContain('search_things');
    expect(picked).toContain('list_contents');
    expect(picked.some((t) => TOOL_DEFS[t].module === 'moving')).toBe(false);
  });

  it('answers smaller fallbacks: the latest question alone, then the core', () => {
    const tiers = offeredTools(ALL, {
      questions: ['Who borrowed the ladder?', 'and is the TV warranty still good?'],
      used: [],
    });
    expect(tiers[0]).toContain('lend_thing');
    expect(tiers[0]).toContain('add_warranty');
    expect(tiers[1]).not.toContain('lend_thing');
    expect(tiers[1]).toContain('add_warranty');
    expect(tiers.at(-1)).toEqual(offered('Are you working?'));
  });

  it('the thread’s last questions and the tools it called', () => {
    const user = (text: string): KeptMessage => ({ role: 'user', parts: [{ type: 'text', text }] });
    const messages: KeptMessage[] = [
      user('one'),
      user('two'),
      {
        role: 'assistant',
        parts: [{ type: 'tool_call', callId: 'c1', tool: 'lend_thing', input: {} }],
      },
      user('three'),
      user('four'),
    ];
    expect(askOf(messages)).toEqual({ questions: ['two', 'three', 'four'], used: ['lend_thing'] });
  });
});

describe('the evaluation set’s scripted tools are offered for its questions', () => {
  type Case = { id: string; question: string; mock?: { calls?: { tool: string }[] }[] };
  const cases = (JSON.parse(readFileSync(MOCK_SCRIPTS_PATH, 'utf8')) as { cases: Case[] }).cases;
  it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const picked = offered(c.question);
    for (const step of c.mock ?? []) {
      for (const call of step.calls ?? []) expect(picked, call.tool).toContain(call.tool);
    }
  });
});

describe('the first request fits Groq’s free tier (8,000 tokens a minute)', () => {
  const locations = [
    {
      id: '0b6f3a52-6c1e-4f43-9c1a-2f4f8c1d9e01',
      name: 'Home',
      role: 'owner' as const,
      canWrite: true,
    },
    {
      id: '7d2e9c44-1a5b-4e7f-8b3c-5a6d7e8f9a02',
      name: 'Garage',
      role: 'owner' as const,
      canWrite: true,
    },
  ];
  const instructions = instructionsFor({ locale: 'en', locations, context: null, writes: true });
  const maxOut = ASSISTANT_OUTPUT.maxTokens + REASONING_ALLOWANCE.low;
  const size = (tools: readonly ToolName[], question: string, out: number) =>
    requestTokens('groq', {
      instructions,
      tools: tools.map((t) => toolSpecOf(t)),
      messages: [{ role: 'user', parts: [{ type: 'text', text: question }] }],
      maxOutputTokens: out,
    });

  it('every module on, two locations: under 8,000 with the whole output allowance', () => {
    const tokens = size(offered('Are you working?'), 'Are you working?', maxOut);
    expect(tokens).toBeLessThan(8000 * 0.95);
    const fitted = fitToCeiling({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Are you working?' }] }],
      maxOut,
      floor: ASSISTANT_OUTPUT.expectedToolStep + REASONING_ALLOWANCE.low,
      ceiling: 8000,
      measure: (m, out) =>
        requestTokens('groq', {
          instructions,
          tools: offered('Are you working?').map((t) => toolSpecOf(t)),
          messages: m,
          maxOutputTokens: out,
        }),
    });
    expect(fitted?.maxOut).toBe(maxOut);
  });

  it('a question on every topic still fits with the step’s output floor', () => {
    const question =
      'Who borrowed the ladder, what is due, where is the TV receipt and warranty, log the car fuel, we ran out of soap, add a shelf';
    const tiers = offeredTools(ALL, { questions: [question], used: [] });
    const floor = ASSISTANT_OUTPUT.expectedToolStep + REASONING_ALLOWANCE.low;
    expect(tiers.some((t) => size(t, question, floor) <= 8000 * 0.95)).toBe(true);
  });
});
