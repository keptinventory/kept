/**
 * The demo's words (D241), in English and Arabic: the shipped map's own strings and their
 * translations from apps/web/src/locales/{en,ar}/messages.po, so the demo reads like the app. A
 * few the app has no use for (the sample note, Reset) are the demo's own. The other docs
 * languages show the English demo, as they show the English pages.
 */
import type { MapModelKey, MapRoomKind, MapSurface, ShapeGroup } from '@kept/shared';

export type Lang = 'en' | 'ar';
/** English, then Arabic. */
export type Two = readonly [string, string];

export const MODEL_NAMES: Record<MapModelKey, Two> = {
  sofa: ['Sofa', 'أريكة'],
  armchair: ['Armchair', 'كرسي بذراعين'],
  coffee_table: ['Coffee table', 'طاولة قهوة'],
  tv_stand: ['TV stand', 'حامل تلفاز'],
  cube_shelf: ['Cube shelf', 'رف مكعبات'],
  tall_plant: ['Tall plant', 'نبتة طويلة'],
  plant: ['Plant', 'نبتة'],
  succulent: ['Succulent', 'نبتة عصارية'],
  dining_chair: ['Dining chair', 'كرسي سفرة'],
  drawers: ['Chest of drawers', 'خزانة أدراج'],
  bedside: ['Bedside table', 'طاولة جانب السرير'],
  metal_shelf: ['Metal shelf', 'رف معدني'],
  tool_cart: ['Tool cart', 'عربة أدوات'],
  drill: ['Drill', 'مثقاب'],
  cardboard: ['Moving box', 'صندوق نقل'],
  crate: ['Crate', 'صندوق بلاستيكي'],
  basket: ['Basket', 'سلة'],
  outdoor_set: ['Bistro set', 'طقم طاولة وكراسي'],
  monobloc: ['Plastic chair', 'كرسي بلاستيكي'],
  planter: ['Planter', 'حوض زرع'],
  planter_long: ['Long planter', 'حوض زرع طويل'],
  ac_unit: ['AC outdoor unit', 'وحدة مكيف خارجية'],
  watering_can: ['Watering can', 'مرشة ري'],
  tv: ['TV', 'تلفاز'],
  bookshelf: ['Bookshelf', 'مكتبة كتب'],
  lamp: ['Floor lamp', 'مصباح أرضي'],
  counter: ['Kitchen counter', 'سطح مطبخ'],
  sink: ['Sink counter', 'سطح بحوض'],
  fridge: ['Fridge', 'ثلاجة'],
  coffee_machine: ['Coffee machine', 'آلة قهوة'],
  microwave: ['Microwave', 'ميكروويف'],
  dining: ['Dining table', 'طاولة سفرة'],
  bed: ['Bed', 'سرير'],
  wardrobe: ['Wardrobe', 'خزانة ملابس'],
  table_lamp: ['Table lamp', 'مصباح طاولة'],
  desk: ['Desk', 'مكتب'],
  monitor: ['Monitor', 'شاشة'],
  laptop: ['Laptop', 'حاسوب محمول'],
  monitor_arm: ['Monitor arm', 'ذراع شاشة'],
  dual_monitor_arm: ['Dual monitor arm', 'ذراع لشاشتين'],
  pc_tower: ['Desktop PC', 'كمبيوتر مكتبي'],
  keyboard: ['Keyboard', 'لوحة مفاتيح'],
  mouse: ['Mouse', 'فأرة'],
  webcam: ['Webcam', 'كاميرا ويب'],
  camera: ['Camera', 'كاميرا'],
  speaker: ['Desk speaker', 'سماعة مكتبية'],
  portable_speaker: ['Portable speaker', 'سماعة محمولة'],
  floor_speaker: ['Tall speaker', 'سماعة أرضية'],
  boombox: ['Boombox', 'سماعة حفلات'],
  smart_speaker: ['Smart speaker', 'سماعة ذكية'],
  soundbar: ['Soundbar', 'ساوند بار'],
  headphones: ['Headphones', 'سماعات رأس'],
  headset: ['Headset', 'سماعة بميكروفون'],
  earbuds: ['Earbuds', 'سماعات أذن'],
  router: ['Router', 'راوتر'],
  printer: ['Printer', 'طابعة'],
  console: ['Game console', 'جهاز ألعاب'],
  controller: ['Game controller', 'يد تحكم'],
  phone: ['Phone', 'هاتف'],
  tablet: ['Tablet', 'جهاز لوحي'],
  power_strip: ['Power strip', 'مشترك كهرباء'],
  external_drive: ['External drive', 'هارد خارجي'],
  mini_pc: ['Mini PC', 'كمبيوتر صغير'],
  nas: ['NAS', 'جهاز تخزين شبكي (NAS)'],
  sbc: ['Raspberry Pi or SBC', 'راسبيري باي أو حاسوب لوحة واحدة'],
  network_switch: ['Network switch', 'سويتش شبكة'],
  patch_panel: ['Patch panel', 'لوحة توصيل الشبكة'],
  ups: ['UPS', 'مزود طاقة احتياطي (UPS)'],
  device: ['Small device', 'جهاز صغير'],
  chair: ['Desk chair', 'كرسي مكتب'],
  cabinet: ['Filing cabinet', 'خزانة ملفات'],
  rack_24u: ['Server rack 24U', 'خزانة سيرفر ٢٤ وحدة'],
  rack_42u: ['Server rack 42U', 'خزانة سيرفر ٤٢ وحدة'],
  box: ['Storage box', 'صندوق تخزين'],
  washer: ['Washing machine', 'غسالة'],
  workbench: ['Workbench', 'طاولة عمل'],
  tool_wall: ['Tool wall', 'جدار الأدوات'],
  wall_tv: ['Wall TV', 'تلفزيون حائط'],
  wall_shelf: ['Wall shelf', 'رف حائط'],
  wall_cabinet: ['Wall cabinet', 'خزانة حائط'],
  rack_wall_6u: ['Wall rack 6U', 'خزانة شبكة حائط ٦ وحدات'],
  rack_wall_12u: ['Wall rack 12U', 'خزانة شبكة حائط ١٢ وحدة'],
  picture: ['Picture or mirror', 'لوحة أو مرآة'],
  clock: ['Wall clock', 'ساعة حائط'],
  hooks: ['Hooks', 'علّاقات'],
  car: ['Car', 'سيارة'],
  bike: ['Bike', 'دراجة'],
  water_tank: ['Water tank', 'خزان مياه'],
  dish: ['Satellite dish', 'طبق استقبال'],
  stairs: ['Stairs', 'درج'],
  stairwell: ['Stairwell', 'بئر الدرج'],
  zone: ['Area', 'منطقة'],
  item: ['Small thing', 'شيء صغير'],
};

/** The shape picker's groups (D249). */
export const GROUP_NAMES: Record<ShapeGroup, Two> = {
  furniture: ['Furniture', 'أثاث'],
  storage: ['Storage', 'تخزين'],
  wall: ['On the wall', 'على الحائط'],
  electronics: ['Electronics', 'إلكترونيات'],
  kitchen: ['Kitchen and laundry', 'المطبخ والغسيل'],
  tools: ['Tools', 'العدة'],
  outdoor: ['Plants and outdoor', 'نباتات وخارج المنزل'],
  vehicles: ['Vehicles', 'السيارات'],
  building: ['Stairs and areas', 'سلالم ومناطق'],
  other: ['Other', 'أخرى'],
};

export const ROOM_KIND_NAMES: Record<MapRoomKind, Two> = {
  room: ['Room', 'غرفة'],
  balcony: ['Balcony', 'شرفة'],
  terrace: ['Terrace', 'تراس'],
  garden: ['Garden', 'حديقة'],
};

export const SURFACE_NAMES: Record<MapSurface, Two> = {
  wood: ['Wood', 'خشب'],
  tile: ['Tiles', 'بلاط'],
  concrete: ['Concrete', 'خرسانة'],
  deck: ['Deck', 'ألواح خشبية'],
  grass: ['Grass', 'عشب'],
};

type Words = {
  sample: string;
  reset: string;
  install: string;
  mapOf: (name: string) => string;
  where: string;
  view: string;
  threeD: string;
  plan: string;
  arrange: string;
  done: string;
  pins: string;
  pin: Record<'low' | 'lent' | 'due', { long: string; short: string }>;
  arrangeTool: string;
  move: string;
  drawRoom: string;
  addFloor: string;
  cancel: string;
  hints: Record<'move' | 'room' | 'overlap' | 'blocked', string>;
  /** #301: where an arrow key moved the selected room, for screen readers. */
  movedRoom: Record<'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', (room: string) => string>;
  floor: string;
  allFloors: string;
  all: string;
  zoomIn: string;
  zoomOut: string;
  turnLeft: string;
  turnRight: string;
  home: string;
  detailed: string;
  glError: string;
  placesHere: string;
  noFloor: string;
  roomN: (n: string) => string;
  floorN: (n: string) => string;
  engine: {
    onIt: (name: string) => string;
    more: (n: number) => string;
    inside: (n: number) => string;
    openFloor: string;
    changeFloor: string;
  };
  close: string;
  open: string;
  whatsHere: (n: string) => string;
  insideN: (n: string) => string;
  details: string;
  less: string;
  turn: string;
  takeOff: string;
  upTo: (name: string) => string;
  downTo: (name: string) => string;
  size: (w: string, d: string) => string;
  things: (n: number, f: string) => string;
  thingsInside: (n: number, f: string) => string;
  onHost: (name: string) => string;
  within: Record<'low' | 'lent' | 'due', (n: string) => string>;
  low: (remaining: string, min: string) => string;
  lentTo: (who: string) => string;
  lentBack: (who: string, back: string) => string;
  someone: string;
  dueOn: (what: string, when: string) => string;
  overdue: (what: string, when: string) => string;
  dueWord: string;
  facts: {
    type: string;
    quantity: string;
    brand: string;
    model: string;
    serial: string;
    condition: string;
    tags: string;
  };
  noType: string;
  /** The label's QR code, as the app's card names it. */
  qrLabel: (code: string) => string;
  placesIn: (n: number, f: string) => string;
  /** The card's links into Kept: in the demo they lead to Install Kept. */
  openPlace: string;
  openThing: string;
  photograph: string;
  countRoom: string;
  /** "What's in" under the map (apps/web/src/map/whats-in.tsx). */
  list: {
    title: (name: string) => string;
    rooms: (n: number, f: string) => string;
    floors: (n: number, f: string) => string;
    /** After the bold count: "3 low". */
    sum: Record<'low' | 'lent' | 'due', string>;
    find: string;
    findLabel: string;
    show: string;
    byRoom: string;
    attention: string;
    nothingHere: string;
    nothingYet: string;
    more: (f: string) => string;
    fewer: string;
  };
  /** Cancel's question, and Done's Undo. */
  confirm: { title: string; body: string; throwAway: string };
  arranged: string;
  undo: string;
  undone: string;
  /** The shape picker's footer (#171): before, the link, between, the link, after. */
  shapesMore: [string, string, string, string, string];
  noPhoto: string;
  labelThing: string;
  labelPlace: string;
  onIt: string;
  findInside: (name: string) => string;
  findInsideLabel: string;
  nothingMatches: string;
  nothingYet: string;
  kind: string;
  surface: string;
  shape: string;
  /** D249: the card's shape line and the shape picker. */
  shapeLine: (shape: string, from: 'type' | 'name' | 'guess' | undefined) => string;
  change: string;
  pickShape: string;
  shapeFor: (name: string) => string;
  findShape: string;
  findShapeHint: string;
  shapes: string;
  suggested: string;
  noShape: (query: string) => string;
  putOnMap: string;
  findThingIn: (name: string) => string;
  findThingLabel: string;
  everythingOnMap: string;
  /** #138: a thing on a wall's Height, and where it hangs. */
  height: {
    label: string;
    lower: string;
    higher: string;
    help: string;
    value: (n: string) => string;
    onWall: (n: string) => string;
  };
  /** #137: Put on…, Add on it and Take off. */
  put: {
    putOn: string;
    addOn: string;
    putTitle: (name: string) => string;
    addTitle: (name: string) => string;
    onNow: (name: string) => string;
    takeOff: string;
    list: string;
    shapeOn: (shape: string, on: string) => string;
    nothing: (room: string) => string;
    nothingElse: (room: string) => string;
    toAdd: string;
    full: (n: number, f: string) => string;
    left: (n: number, f: string) => string;
    noMonitor: (room: string) => string;
    allOn: (room: string) => string;
    /** #152: Add on it's two lists. */
    onMap: string;
    notOnMap: string;
    putN: (n: number, f: string) => string;
    pick: string;
    onItNow: (names: string) => string;
    /** A list longer than eight gets a search (put-on.tsx). */
    findPlace: string;
    findIn: (room: string) => string;
    findThing: string;
  };
};

/** Arabic plural forms (zero, one, two, few, many, other), as the app's catalogue writes them. */
function arPlural(n: number, f: string, forms: [string, string, string, string, string, string]) {
  const rule = new Intl.PluralRules('ar').select(n);
  const i = ['zero', 'one', 'two', 'few', 'many', 'other'].indexOf(rule);
  return (forms[i < 0 ? 5 : i] ?? '').replace('#', f);
}

export const WORDS: Record<Lang, Words> = {
  en: {
    sample: 'A sample home, in your browser. Nothing you change is saved or sent anywhere.',
    reset: 'Reset',
    install: 'Install Kept',
    mapOf: (name) => `Map of ${name}`,
    where: 'Where you are on the map',
    view: 'View',
    threeD: '3D',
    plan: 'Plan',
    arrange: 'Arrange',
    done: 'Done',
    pins: 'Pins',
    pin: {
      low: { long: 'Low stock', short: 'Low' },
      lent: { long: 'Lent out', short: 'Lent' },
      due: { long: 'Due soon', short: 'Due' },
    },
    arrangeTool: 'Arrange tool',
    move: 'Move',
    drawRoom: 'Draw a room',
    addFloor: 'Add a floor',
    cancel: 'Cancel',
    hints: {
      move: 'Drag anything to move it. Drop small things on a counter, desk, shelf or box; wall things go on the nearest wall. To move a room, hold its floor, then drag. Drag its amber corner to resize it.',
      room: 'Drag on empty ground to draw a new room on this floor.',
      overlap: 'Rooms can’t overlap. Draw on empty ground.',
      blocked: 'Rooms can’t overlap.',
    },
    movedRoom: {
      ArrowUp: (room) => `Moved ${room} up.`,
      ArrowDown: (room) => `Moved ${room} down.`,
      ArrowLeft: (room) => `Moved ${room} left.`,
      ArrowRight: (room) => `Moved ${room} right.`,
    },
    floor: 'Floor',
    allFloors: 'All floors',
    all: 'All',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    turnLeft: 'Turn left',
    turnRight: 'Turn right',
    home: 'Show the whole floor',
    detailed: 'Detailed models',
    glError: 'This browser can’t draw the map.',
    placesHere: 'Places on this level',
    noFloor: 'Not on a floor',
    roomN: (n) => `Room ${n}`,
    floorN: (n) => `Floor ${n}`,
    engine: {
      onIt: (name) => `on it: ${name}`,
      more: (n) => `+${n} more`,
      inside: (n) => `${n} inside`,
      openFloor: 'click to open',
      changeFloor: 'click to change floor',
    },
    close: 'Close',
    open: 'Open',
    whatsHere: (n) => `What’s here · ${n}`,
    insideN: (n) => `Inside · ${n}`,
    details: 'Details',
    less: 'Less',
    turn: 'Turn',
    height: {
      label: 'Height',
      lower: 'Lower',
      higher: 'Higher',
      help: 'From the floor to its middle',
      value: (n) => `${n} m`,
      onWall: (n) => `On the wall, ${n} m up`,
    },
    takeOff: 'Take off the map',
    upTo: (name) => `Up to ${name}`,
    downTo: (name) => `Down to ${name}`,
    size: (w, d) => `${w} × ${d} m`,
    things: (n, f) => (n === 1 ? `${f} thing` : `${f} things`),
    thingsInside: (n, f) => (n === 1 ? `${f} thing inside` : `${f} things inside`),
    onHost: (name) => `on ${name}`,
    within: {
      low: (n) => `${n} running low inside`,
      lent: (n) => `${n} lent out inside`,
      due: (n) => `${n} due inside`,
    },
    low: (remaining, min) => `${remaining} left, keep at least ${min}`,
    lentTo: (who) => `Lent to ${who}`,
    lentBack: (who, back) => `Lent to ${who}, back by ${back}`,
    someone: 'someone',
    dueOn: (what, when) => `${what}: due ${when}`,
    overdue: (what, when) => `${what}: overdue since ${when}`,
    dueWord: 'Due',
    facts: {
      type: 'Type',
      quantity: 'Quantity',
      brand: 'Brand',
      model: 'Model',
      serial: 'Serial',
      condition: 'Condition',
      tags: 'Tags',
    },
    noType: 'No type',
    qrLabel: (code) => `QR label for ${code}`,
    placesIn: (n, f) => (n === 1 ? `${f} place in it` : `${f} places in it`),
    openPlace: 'Open the place',
    openThing: 'Open the thing',
    photograph: 'Photograph this room',
    countRoom: 'Count this room',
    list: {
      title: (name) => `What’s in ${name}`,
      rooms: (n, f) => (n === 1 ? `${f} room` : `${f} rooms`),
      floors: (n, f) => (n === 1 ? `${f} floor` : `${f} floors`),
      sum: { low: 'low', lent: 'lent', due: 'due' },
      find: 'Find a thing or a short ID',
      findLabel: 'Find a thing',
      show: 'Show',
      byRoom: 'By room',
      attention: 'Needs attention',
      nothingHere: 'Nothing here.',
      nothingYet: 'Nothing here yet.',
      more: (f) => `Show ${f} more`,
      fewer: 'Show fewer',
    },
    confirm: {
      title: 'Throw away these changes?',
      body: 'The map goes back to how it was.',
      throwAway: 'Throw away',
    },
    arranged: 'Map arranged',
    undo: 'Undo',
    undone: 'Undone',
    shapesMore: ['Missing a shape? ', 'Request it', ', or browse the ', 'shape library', '.'],
    noPhoto: 'No photo yet',
    labelThing: 'Label of this thing',
    labelPlace: 'Label of this place',
    onIt: 'On it',
    findInside: (name) => `Find inside ${name}`,
    findInsideLabel: 'Find inside',
    nothingMatches: 'Nothing matches.',
    nothingYet: 'Nothing in it yet.',
    kind: 'Kind',
    surface: 'Floor',
    shape: 'Shape',
    shapeLine: (shape, from) =>
      from === 'type'
        ? `Shape: ${shape}, from its type`
        : from === 'name'
          ? `Shape: ${shape}, from its name`
          : from === 'guess'
            ? `Shape: ${shape}, a guess`
            : `Shape: ${shape}`,
    change: 'Change',
    pickShape: 'Pick a shape',
    shapeFor: (name) => `Shape for ${name}`,
    findShape: 'Find a shape',
    findShapeHint: 'Find a shape: TV, shelf, box…',
    shapes: 'Shapes',
    suggested: 'Suggested',
    noShape: (q) =>
      `No shape matches “${q}”. Try Small thing or Small device, and give it a name that says what it is.`,
    putOnMap: 'Put on the map',
    findThingIn: (name) => `Find a thing in ${name}`,
    findThingLabel: 'Find a thing to put on the map',
    everythingOnMap: 'Everything here is on the map.',
    put: {
      putOn: 'Put on…',
      addOn: 'Add on it',
      putTitle: (name) => `Put ${name} on…`,
      addTitle: (name) => `Add on ${name}`,
      onNow: (name) => `On ${name}`,
      takeOff: 'Take off',
      list: 'What can carry it',
      shapeOn: (shape, on) => `${shape} · on ${on}`,
      nothing: (room) =>
        `Nothing in ${room} can carry it. Put a desk, a shelf or a monitor on the map first.`,
      nothingElse: (room) => `Nothing else in ${room} can carry it.`,
      toAdd: 'Things to add on it',
      full: (n, f) => (n === 1 ? 'Full: it holds one monitor.' : `Full: it holds ${f} monitors.`),
      left: (n, f) => (n === 1 ? 'Room for one more.' : `Room for ${f} more.`),
      noMonitor: (room) => `No monitor in ${room} is free.`,
      allOn: (room) => `Everything small in ${room} is on something already.`,
      onMap: 'On the map',
      notOnMap: 'Not on the map yet',
      putN: (_n, f) => `Put ${f} on it`,
      pick: 'Pick what goes on it',
      onItNow: (names) => `On it now: ${names}`,
      findPlace: 'Find a place to put it',
      findIn: (room) => `Find in ${room}`,
      findThing: 'Find a thing to add',
    },
  },
  ar: {
    sample: 'منزل تجريبي في متصفحك. لا يُحفظ أي شيء تغيّره ولا يُرسل إلى أي مكان.',
    reset: 'إعادة تعيين',
    install: 'ثبّت Kept',
    mapOf: (name) => `خريطة ${name}`,
    where: 'مكانك على الخريطة',
    view: 'العرض',
    threeD: 'ثلاثي الأبعاد',
    plan: 'مخطط',
    arrange: 'ترتيب',
    done: 'تم',
    pins: 'الدبابيس',
    pin: {
      low: { long: 'مخزون منخفض', short: 'منخفض' },
      lent: { long: 'مُعار', short: 'مُعار' },
      due: { long: 'يحين قريبًا', short: 'مستحق' },
    },
    arrangeTool: 'أداة الترتيب',
    move: 'نقل',
    drawRoom: 'ارسم غرفة',
    addFloor: 'أضف طابقًا',
    cancel: 'إلغاء',
    hints: {
      move: 'اسحب أي شيء لنقله. ضع الأشياء الصغيرة على سطح أو مكتب أو رف أو صندوق، وأشياء الحائط تُعلَّق على أقرب حائط. لنقل غرفة، اضغط مطولًا على أرضيتها ثم اسحب. اسحب زاويتها الكهرمانية لتغيير حجمها.',
      room: 'اسحب على أرض فارغة لرسم غرفة جديدة في هذا الطابق.',
      overlap: 'لا يمكن أن تتداخل الغرف. ارسم على أرض فارغة.',
      blocked: 'لا يمكن أن تتداخل الغرف.',
    },
    movedRoom: {
      ArrowUp: (room) => `نُقل «${room}» إلى الأعلى.`,
      ArrowDown: (room) => `نُقل «${room}» إلى الأسفل.`,
      ArrowLeft: (room) => `نُقل «${room}» إلى اليسار.`,
      ArrowRight: (room) => `نُقل «${room}» إلى اليمين.`,
    },
    floor: 'الطابق',
    allFloors: 'كل الطوابق',
    all: 'الكل',
    zoomIn: 'تكبير',
    zoomOut: 'تصغير',
    turnLeft: 'تدوير لليسار',
    turnRight: 'تدوير لليمين',
    home: 'اعرض الطابق كاملًا',
    detailed: 'نماذج مفصّلة',
    glError: 'لا يستطيع هذا المتصفح رسم الخريطة.',
    placesHere: 'الأماكن في هذا الطابق',
    noFloor: 'ليست على طابق',
    roomN: (n) => `غرفة ${n}`,
    floorN: (n) => `الطابق ${n}`,
    engine: {
      onIt: (name) => `عليه: ${name}`,
      more: (n) => `+${n} أخرى`,
      inside: (n) => `${n} بداخله`,
      openFloor: 'انقر للفتح',
      changeFloor: 'انقر لتغيير الطابق',
    },
    close: 'إغلاق',
    open: 'افتح',
    whatsHere: (n) => `ما هنا · ${n}`,
    insideN: (n) => `بداخله · ${n}`,
    details: 'التفاصيل',
    less: 'أقل',
    turn: 'تدوير',
    height: {
      label: 'الارتفاع',
      lower: 'أخفض',
      higher: 'أعلى',
      help: 'من الأرض إلى منتصفه',
      value: (n) => `${n} م`,
      onWall: (n) => `على الحائط، على ارتفاع ${n} م`,
    },
    takeOff: 'إزالة من الخريطة',
    upTo: (name) => `صعودًا إلى ${name}`,
    downTo: (name) => `نزولًا إلى ${name}`,
    size: (w, d) => `${w} × ${d} م`,
    things: (n, f) =>
      arPlural(n, f, ['لا أشياء', 'شيء واحد', 'شيئان', '# أشياء', '# شيئًا', '# شيء']),
    thingsInside: (n, f) =>
      arPlural(n, f, [
        'لا أشياء بداخله',
        'شيء واحد بداخله',
        'شيئان بداخله',
        '# أشياء بداخله',
        '# شيئًا بداخله',
        '# شيء بداخله',
      ]),
    onHost: (name) => `على ${name}`,
    within: {
      low: (n) => `${n} على وشك النفاد بداخله`,
      lent: (n) => `${n} مُعار من داخله`,
      due: (n) => `${n} مستحق بداخله`,
    },
    low: (remaining, min) => `بقي ${remaining}، والحد الأدنى ${min}`,
    lentTo: (who) => `مُعار إلى ${who}`,
    lentBack: (who, back) => `مُعار إلى ${who}، يعود بحلول ${back}`,
    someone: 'شخص ما',
    dueOn: (what, when) => `${what}: مستحق في ${when}`,
    overdue: (what, when) => `${what}: متأخر منذ ${when}`,
    dueWord: 'مستحق',
    facts: {
      type: 'النوع',
      quantity: 'الكمية',
      brand: 'العلامة التجارية',
      model: 'الطراز',
      serial: 'الرقم التسلسلي',
      condition: 'الحالة',
      tags: 'الوسوم',
    },
    noType: 'بلا نوع',
    qrLabel: (code) => `ملصق QR لـ ${code}`,
    placesIn: (n, f) =>
      arPlural(n, f, [
        'لا أماكن فيه',
        'مكان واحد فيه',
        'مكانان فيه',
        '# أماكن فيه',
        '# مكانًا فيه',
        '# مكان فيه',
      ]),
    openPlace: 'فتح المكان',
    openThing: 'افتح الشيء',
    photograph: 'صوّر هذه الغرفة',
    countRoom: 'عُدّ هذه الغرفة',
    list: {
      title: (name) => `ما في ${name}`,
      rooms: (n, f) =>
        arPlural(n, f, ['لا غرف', 'غرفة واحدة', 'غرفتان', '# غرف', '# غرفة', '# غرفة']),
      floors: (n, f) =>
        arPlural(n, f, ['لا طوابق', 'طابق واحد', 'طابقان', '# طوابق', '# طابقًا', '# طابق']),
      sum: { low: 'على وشك النفاد', lent: 'مُعار', due: 'مستحق' },
      find: 'ابحث عن شيء أو معرّف قصير',
      findLabel: 'ابحث عن شيء',
      show: 'العرض',
      byRoom: 'حسب الغرفة',
      attention: 'يحتاج انتباهًا',
      nothingHere: 'لا شيء هنا.',
      nothingYet: 'لا شيء هنا بعد.',
      more: (f) => `عرض ${f} أخرى`,
      fewer: 'عرض أقل',
    },
    confirm: {
      title: 'التخلّي عن هذه التغييرات؟',
      body: 'تعود الخريطة كما كانت.',
      throwAway: 'تخلَّ عنها',
    },
    arranged: 'رُتّبت الخريطة',
    undo: 'تراجع',
    undone: 'تم التراجع',
    shapesMore: ['ينقصك شكل؟ ', 'اطلبه', '، أو تصفّح ', 'مكتبة الأشكال', '.'],
    noPhoto: 'لا صورة بعد',
    labelThing: 'ملصق هذا الشيء',
    labelPlace: 'ملصق هذا المكان',
    onIt: 'عليه',
    findInside: (name) => `ابحث داخل ${name}`,
    findInsideLabel: 'ابحث بالداخل',
    nothingMatches: 'لا شيء يطابق.',
    nothingYet: 'لا شيء فيه بعد.',
    kind: 'النوع',
    surface: 'الأرضية',
    shape: 'الشكل',
    shapeLine: (shape, from) =>
      from === 'type'
        ? `الشكل: ${shape}، من نوعه`
        : from === 'name'
          ? `الشكل: ${shape}، من اسمه`
          : from === 'guess'
            ? `الشكل: ${shape}، تخمين`
            : `الشكل: ${shape}`,
    change: 'تغيير',
    pickShape: 'اختر شكلًا',
    shapeFor: (name) => `شكل ${name}`,
    findShape: 'ابحث عن شكل',
    findShapeHint: 'ابحث عن شكل: تلفاز، رف، صندوق…',
    shapes: 'الأشكال',
    suggested: 'مقترح',
    noShape: (q) =>
      `لا يوجد شكل يطابق «${q}». جرّب «شيء صغير» أو «جهاز صغير»، وأعطه اسمًا يقول ما هو.`,
    putOnMap: 'ضع على الخريطة',
    findThingIn: (name) => `ابحث عن شيء في ${name}`,
    findThingLabel: 'ابحث عن شيء لوضعه على الخريطة',
    everythingOnMap: 'كل ما هنا على الخريطة.',
    put: {
      putOn: 'ضع على…',
      addOn: 'أضف عليه',
      putTitle: (name) => `ضع ${name} على…`,
      addTitle: (name) => `أضف على ${name}`,
      onNow: (name) => `على ${name}`,
      takeOff: 'أنزله',
      list: 'ما يمكنه حمله',
      shapeOn: (shape, on) => `${shape} · على ${on}`,
      nothing: (room) => `لا شيء في ${room} يمكنه حمله. ضع مكتبًا أو رفًا أو شاشة على الخريطة أولًا.`,
      nothingElse: (room) => `لا شيء آخر في ${room} يمكنه حمله.`,
      toAdd: 'أشياء توضع عليه',
      full: (n, f) =>
        arPlural(n, f, [
          'ممتلئ: لا يحمل شاشات.',
          'ممتلئ: يحمل شاشة واحدة.',
          'ممتلئ: يحمل شاشتين.',
          'ممتلئ: يحمل # شاشات.',
          'ممتلئ: يحمل # شاشة.',
          'ممتلئ: يحمل # شاشة.',
        ]),
      left: (n, f) =>
        arPlural(n, f, [
          'لا مكان لمزيد.',
          'مكان لواحدة أخرى.',
          'مكان لاثنتين أخريين.',
          'مكان لـ# أخرى.',
          'مكان لـ# أخرى.',
          'مكان لـ# أخرى.',
        ]),
      noMonitor: (room) => `لا توجد شاشة متاحة في ${room}.`,
      allOn: (room) => `كل شيء صغير في ${room} موضوع على شيء بالفعل.`,
      onMap: 'على الخريطة',
      notOnMap: 'ليست على الخريطة بعد',
      putN: (n, f) =>
        arPlural(n, f, [
          'ضع # عليه',
          'ضع واحدًا عليه',
          'ضع اثنين عليه',
          'ضع # عليه',
          'ضع # عليه',
          'ضع # عليه',
        ]),
      pick: 'اختر ما يوضع عليه',
      onItNow: (names) => `عليه الآن: ${names}`,
      findPlace: 'ابحث عن مكان تضعه عليه',
      findIn: (room) => `ابحث في ${room}`,
      findThing: 'ابحث عن شيء لإضافته',
    },
  },
};

/** Numbers and dates as the app writes them (apps/web/src/lib/format.ts): Eastern digits in Arabic. */
export function formatter(lang: Lang) {
  const tag = lang === 'ar' ? 'ar-u-nu-arab' : 'en';
  const nf = new Intl.NumberFormat(tag);
  const day = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' });
  return {
    num: (n: number) => nf.format(n),
    day: (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return day.format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)).replace(/ /g, ' ');
    },
  };
}
