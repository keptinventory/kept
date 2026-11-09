import type { PdfWords } from './types.js';

// Arabic: every PDF's words, following the web catalogue's wording (apps/web/src/locales/ar/
// messages.po) for every term the app already uses: conditions, lifecycles, "Unplaced",
// "Serial number", "Contents".

const arCount = new Intl.PluralRules('ar');

const inventory: PdfWords['inventory'] = {
  title: 'تقرير الجرد',
  things: 'الأشياء',
  places: 'الأماكن',
  photos: 'بصور',
  totals: 'الإجمالي حسب العملة',
  contents: 'المحتويات',
  page: 'صفحة',
  of: 'من',
  serial: 'الرقم التسلسلي',
  subtotal: 'الإجمالي الفرعي',
  bought: 'تاريخ الشراء',
  confidential: 'خاص: سجل بما تملكه. احفظه بعناية كما تحفظ ما فيه.',
  empty: 'لا شيء يطابق هذا التقرير.',
  unplaced: 'بلا مكان',
  trashed: 'في المهملات',
  allLocations: 'كل المواقع',
  locationsList: (names) => `يشمل ${names}`,
  generated: (who, when) => `أنشأه ${who}، ${when}`,
  moneyPartial: 'تظهر الأسعار فقط في المواقع التي يمكنك فيها رؤية المال.',
  thingCount: (n, f) => {
    switch (arCount.select(n)) {
      case 'zero':
        return 'لا أشياء';
      case 'one':
        return 'شيء واحد';
      case 'two':
        return 'شيئان';
      case 'few':
        return `${f} أشياء`;
      case 'many':
        return `${f} شيئًا`;
      default:
        return `${f} شيء`;
    }
  },
  filterPlaces: 'الأماكن',
  filterTypes: 'الأنواع',
  filterTags: 'الوسوم',
  withEnded: 'يشمل الأشياء التي لم تعد مستخدمة',
  withTrashed: 'يشمل الأشياء التي في المهملات',
  condition: { new: 'جديد', good: 'جيد', fair: 'مقبول', poor: 'سيئ', broken: 'معطوب' },
  lifecycle: {
    archived: 'مؤرشف',
    sold: 'بِيع',
    given_away: 'أُهدي',
    lost: 'مفقود',
    disposed: 'تم التخلص منه',
    stolen: 'سُرق',
    destroyed: 'أُتلف',
    returned_to_owner: 'أُعيد إلى مالكه',
  },
};

const readable: PdfWords['readable'] = {
  title: 'نسخة مقروءة',
  intro:
    'كل ما في هذا الموقع كما حفظه Kept. تُفتح بالمتصفح وحده: الصور والإيصالات والمستندات تُفتح من الملفات التي بجانبها.',
  exported: (when) => `صُدّرت في ${when}`,
  places: 'الأماكن',
  things: 'الأشياء',
  photo: 'صورة',
  name: 'الاسم',
  shortId: 'المعرّف القصير',
  type: 'النوع',
  brandModel: 'العلامة والطراز',
  quantity: 'الكمية',
  condition: 'الحالة',
  tags: 'الوسوم',
  lastSeen: 'آخر مرة شوهد',
  files: 'الملفات',
  inside: 'داخل',
  ownPage: 'في صفحة خاصة',
  spreadsheets: 'جداول البيانات (CSV)',
  pdf: 'تقرير الجرد (PDF)',
  pdfLeftOut: (_n, max) =>
    `لم يُضمَّن تقرير الجرد (PDF): يتسع لـ ${max} شيء على الأكثر. كل الأشياء مدرجة أدناه وفي things.csv.`,
  pdfFailed: 'تعذّر إنشاء تقرير الجرد (PDF) هذه المرة. كل الأشياء مدرجة أدناه.',
  moneyHidden: 'الأسعار غير مضمّنة: إنها مخفية عن الشخص الذي صدّر هذه النسخة.',
  secretsWithheld:
    'القيم السرية غير مضمّنة: صُدّرت هذه النسخة بدونها. ملفات البيانات تذكر كل حقل كانت له قيمة.',
  empty: 'لا شيء هنا.',
  fileRole: {
    photo: 'صورة',
    receipt: 'إيصال',
    invoice: 'فاتورة',
    manual: 'دليل',
    warranty_doc: 'ضمان',
    proof: 'إثبات',
    condition_out: 'الحالة عند الإعارة',
    condition_in: 'الحالة عند الإرجاع',
    registration: 'رخصة',
    document: 'مستند',
  },
  conditions: { new: 'جديد', good: 'جيد', fair: 'مقبول', poor: 'سيئ', broken: 'معطوب' },
  lifecycles: {
    archived: 'مؤرشف',
    sold: 'بِيع',
    given_away: 'أُهدي',
    lost: 'مفقود',
    disposed: 'تم التخلص منه',
    stolen: 'سُرق',
    destroyed: 'أُتلف',
    returned_to_owner: 'أُعيد إلى مالكه',
  },
};

const insurance: PdfWords['insurance'] = {
  title: 'تقرير التأمين',
  totals: 'الإجمالي حسب العملة',
  converted: (ccy) => `بعملة ${ccy}:`,
  subtotal: 'الإجمالي الفرعي',
  thing: 'الشيء',
  purchase: 'الشراء',
  value: 'القيمة الآن',
  receipts: 'الإيصالات',
  serial: 'الرقم التسلسلي',
  page: 'صفحة',
  of: 'من',
  empty: 'لا شيء لعرضه.',
  asOf: (day) => `حتى ${day}`,
  owner: (name) => `المالك: ${name}`,
  generated: (who, when) => `أنشأه ${who}، ${when}`,
  ratesOf: (days) => `بأسعار صرف ${days}`,
  purchaseFallback: 'الأشياء التي لا تقييم لها تُحسب بسعر شرائها.',
  noMoney: 'المبالغ مخفية عنك في هذا الموقع.',
  incident: {
    burglary: 'سطو',
    fire: 'حريق',
    flood: 'فيضان',
    loss: 'فقدان',
    other: 'حادث',
  },
  police: (ref) => `رقم محضر الشرطة: ${ref}`,
  insurer: (ref) => `رقم مطالبة التأمين: ${ref}`,
  occurred: (day) => `بتاريخ ${day}`,
};

const condition: PdfWords['condition'] = {
  title: 'تقرير حالة السكن',
  kinds: { move_in: 'عند الاستلام', move_out: 'عند التسليم' },
  conditions: { good: 'جيد', fair: 'مقبول', poor: 'سيئ', damaged: 'متضرر' },
  notRecorded: 'لم تُسجَّل',
  rooms: 'الغرف',
  photos: 'الصور',
  notes: 'ملاحظات',
  page: 'صفحة',
  of: 'من',
  contents: 'المحتويات',
  confidential: 'خاص: سجل بحالة هذا السكن. شاركه مع المالك أو الوكيل فقط.',
  empty: 'لا غرف في هذا التقرير.',
  notInReport: 'ليست في هذا التقرير.',
  photoNote: 'وقت كل صورة هو وقت استلام Kept لها.',
  draft: 'لم يُنهَ بعد: قد يتغير هذا التقرير.',
  started: (who) => `بدأه ${who}`,
  finished: (who, when) => `أنهاه ${who}، ${when}`,
  generated: (who, when) => `أنشأه ${who}، ${when}`,
  more: (n) => `${n} أخرى في Kept`,
};

const move: PdfWords['move'] = {
  title: 'قوائم محتويات الصناديق',
  box: (n) => `صندوق ${n}`,
  goesTo: 'يذهب إلى',
  noRoom: 'لم تُحدَّد الغرفة بعد',
  contents: (n) => `المحتويات (${n})`,
  empty: 'لا شيء في هذا الصندوق بعد.',
  quantity: 'الكمية',
  id: 'المعرّف',
  holds: (n) => `فيه ${n}`,
  more: (n) => `${n} أخرى في Kept`,
  states: { packed: 'مُعبّأ', in_transit: 'في الطريق', unpacked: 'تم تفريغه' },
  route: (from, to) => `${from} ← ${to}`,
  scan: 'امسح الرمز لترى هذا الصندوق في Kept وتفرغه.',
  generated: (who, when) => `طبعه ${who}، ${when}`,
  none: 'لا صناديق للطباعة.',
};

const vehicle: PdfWords['vehicle'] = {
  title: 'سجل المركبة',
  cover: {
    type: 'النوع',
    shortId: 'الرمز القصير',
    vin: 'رقم الشاسيه',
    plate: 'رقم اللوحة',
    location: 'الموقع',
    odometer: 'العداد',
  },
  readings: 'سجل العداد',
  proofs: 'صور العداد',
  services: 'الصيانة',
  fuel: 'الوقود',
  documents: 'المستندات',
  date: 'التاريخ',
  reading: 'القراءة',
  source: 'المصدر',
  by: 'بواسطة',
  proof: 'صورة',
  item: 'البند',
  qty: 'الكمية',
  amount: 'المبلغ',
  total: 'الإجمالي',
  year: 'السنة',
  fills: 'التعبئات',
  fuelAmount: 'الوقود',
  name: 'المستند',
  issued: 'تاريخ الإصدار',
  expires: 'تاريخ الانتهاء',
  state: 'الحالة',
  cost: 'التكلفة',
  page: 'صفحة',
  of: 'من',
  contents: 'المحتويات',
  confidential: 'خاص: سجل مركبة واحدة. شاركه مع من يحتاجه فقط.',
  none: 'لا شيء مسجل.',
  readingsCount: 'القراءات',
  servicesCount: 'الصيانات',
  proofsCount: 'صور العداد',
  documentsCount: 'المستندات',
  consumption: 'الاستهلاك، آخر ٥ تعبئات كاملة',
  perDistance: (unit) => `تكلفة الوقود لكل ${unit}، آخر ١٢ شهرًا`,
  monthly: 'الوقود شهريًا، آخر ١٢ شهرًا',
  noConsumption: 'لا توجد تعبئات كاملة كافية بقراءة بعد.',
  readingsNote:
    'كل قراءة بصورة أو مكتوبة يدويًا، وآخر قراءة في كل شهر. تظهر قراءات التعبئة والصيانة في أقسامها.',
  sources: {
    manual: 'يدويًا',
    photo: 'صورة',
    fuel: 'تعبئة',
    service: 'صيانة',
    import: 'مستورد',
    home_assistant: 'Home Assistant',
  },
  docKinds: {
    registration: 'الترخيص',
    insurance: 'التأمين',
    licence: 'الرخصة',
    inspection: 'الفحص',
    lease: 'عقد الإيجار',
    contract: 'العقد',
  },
  docStates: { current: 'ساري', expired: 'منتهٍ', renewed: 'جُدِّد' },
  units: { L: 'لتر', kWh: 'ك.و.س', gal: 'جالون' },
  distance: { km: 'كم', mi: 'ميل', h: 'ساعة' },
  generated: (who, when) => `أنشأه ${who}، ${when}`,
  asOf: (day) => `حتى ${day}`,
  range: (from, to) => `من ${from} إلى ${to}`,
  more: (n) => `${n} أخرى في Kept`,
  moreInvoices: (n) => `+${n}`,
  moneyHidden: 'التكاليف غير مذكورة: فهي مخفية عنك في هذا الموقع.',
  per100: (fuel, distance) => `${fuel}/١٠٠ ${distance}`,
};

export const AR: PdfWords = { inventory, readable, insurance, condition, move, vehicle };
