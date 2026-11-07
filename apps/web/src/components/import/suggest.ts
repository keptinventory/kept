/**
 * The import stepper's guesses: which field each column is, from its header in any of
 * Kept's languages ("Name", "الاسم", "Désignation"); which date format the dates are in; and
 * which separator the place paths use. Guesses only fill the form: the person changes any of them,
 * and the server's dry run checks every cell again.
 */
import {
  DATE_FORMATS,
  type DateFormat,
  HB_CSV_PRESET_COLUMNS,
  type MappableField,
  parseCsvDate,
} from '@kept/shared';

/** Fields at most one column can map to; every other field takes several (the server's MULTI). */
export const MULTI_FIELDS: ReadonlySet<string> = new Set([
  'notes',
  'tags',
  'aliases',
  'legacy_code',
  'own_code',
  'ignore',
]);

/** A header as it's compared: lowercase, no diacritics, tatweel or punctuation, one space. */
export function normaliseHeader(header: string): string {
  return header
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^ال(?=\p{L}{2})/u, '')
    .replace(/\s+/g, ' ');
}

/**
 * Header words per field, in every language Kept speaks, compared after normaliseHeader() (so
 * Arabic is listed without its article: "اسم" matches "الاسم"; Vietnamese and Spanish without
 * their marks is the same word).
 */
const WORDS: Record<Exclude<MappableField, `custom.${string}` | 'ignore'>, string[]> = {
  name: [
    'name',
    'item',
    'item name',
    'thing',
    'title',
    'product',
    'product name',
    'اسم',
    'صنف',
    'منتج',
    'nom',
    'article',
    'designation',
    'objet',
    'produit',
    'libellé',
    'intitulé',
    'bezeichnung',
    'artikel',
    'gegenstand',
    'nome',
    'oggetto',
    'articolo',
    'producto',
    'nombre del producto',
    'articulo',
    'objeto',
    'denominacion',
    'titulo',
    'назва',
    'найменування',
    'річ',
    'товар',
    'tên',
    'tên đồ vật',
    'đồ vật',
    'sản phẩm',
    'tên sản phẩm',
    'mặt hàng',
  ],
  quantity: [
    'quantity',
    'qty',
    'count',
    'number of items',
    'كمية',
    'عدد',
    'quantite',
    'qte',
    'nombre',
    'menge',
    'anzahl',
    'stuck',
    'quantita',
    'qta',
    'cantidad',
    'cant',
    'unidades',
    'кількість',
    'к-сть',
    'số lượng',
    'sl',
  ],
  brand: [
    'brand',
    'make',
    'maker',
    'manufacturer',
    'ماركة',
    'علامة التجارية',
    'علامة تجارية',
    'شركة المصنعة',
    'مصنع',
    'marque',
    'fabricant',
    'marke',
    'hersteller',
    'marca',
    'produttore',
    'fabricante',
    'бренд',
    'виробник',
    'марка',
    'thương hiệu',
    'hãng',
    'nhãn hiệu',
    'nhà sản xuất',
  ],
  model: [
    'model',
    'model number',
    'موديل',
    'طراز',
    'modele',
    'modell',
    'modello',
    'modelo',
    'numero de modelo',
    'модель',
    'номер моделі',
    'kiểu máy',
    'mã model',
    'mô hình',
  ],
  serial: [
    'serial',
    'serial number',
    'serial no',
    'sn',
    's n',
    'رقم تسلسلي',
    'رقم التسلسلي',
    'سيريال',
    'numero de serie',
    'n de serie',
    'seriennummer',
    'numero di serie',
    'matricola',
    'serie',
    'nro de serie',
    'nº de serie',
    'серійний номер',
    'серійний',
    'серійний №',
    'số sê-ri',
    'số seri',
    'số serial',
  ],
  barcode: [
    'barcode',
    'ean',
    'upc',
    'gtin',
    'باركود',
    'رمز شريطي',
    'code barres',
    'code a barres',
    'strichcode',
    'barcode nummer',
    'codice a barre',
    'codigo de barras',
    'штрихкод',
    'штрих код',
    'mã vạch',
  ],
  colour: ['colour', 'color', 'لون', 'couleur', 'farbe', 'colore', 'колір', 'màu sắc', 'màu'],
  condition: [
    'condition',
    'state',
    'حالة',
    'etat',
    'zustand',
    'condizione',
    'stato',
    'estado',
    'condicion',
    'стан',
    'tình trạng',
    'trạng thái',
  ],
  notes: [
    'notes',
    'note',
    'description',
    'comments',
    'comment',
    'remarks',
    'ملاحظات',
    'ملاحظة',
    'وصف',
    'remarques',
    'commentaire',
    'notizen',
    'notiz',
    'beschreibung',
    'bemerkungen',
    'descrizione',
    'commenti',
    'notas',
    'nota',
    'observaciones',
    'comentarios',
    'comentario',
    'descripcion',
    'нотатки',
    'нотатка',
    'опис',
    'коментарі',
    'коментар',
    'примітки',
    'примітка',
    'ghi chú',
    'mô tả',
    'nhận xét',
  ],
  tags: [
    'tags',
    'tag',
    'labels',
    'وسوم',
    'وسم',
    'تصنيفات',
    'etiquettes',
    'mots cles',
    'schlagworter',
    'etichette',
    'etiquetas',
    'etiqueta',
    'palabras clave',
    'теги',
    'тег',
    'мітки',
    'ключові слова',
    'thẻ',
    'nhãn',
    'từ khóa',
  ],
  place_path: [
    'place',
    'location',
    'room',
    'where',
    'path',
    'place path',
    'مكان',
    'موقع',
    'غرفة',
    'emplacement',
    'lieu',
    'piece',
    'ort',
    'standort',
    'raum',
    'lagerort',
    'posizione',
    'luogo',
    'stanza',
    'lugar',
    'ubicacion',
    'habitacion',
    'donde',
    'місце',
    'локація',
    'кімната',
    'де',
    'шлях',
    'місце зберігання',
    'місцезнаходження',
    'vị trí',
    'địa điểm',
    'phòng',
    'nơi để',
  ],
  type: [
    'type',
    'category',
    'kind',
    'نوع',
    'فئة',
    'categorie',
    'typ',
    'kategorie',
    'tipo',
    'categoria',
    'вид',
    'тип',
    'категорія',
    'loại',
    'danh mục',
  ],
  aliases: [
    'aliases',
    'alias',
    'also known as',
    'other names',
    'أسماء أخرى',
    'اسماء اخرى',
    'autres noms',
    'andere namen',
    'altri nomi',
    'otros nombres',
    'otro nombre',
    'інші назви',
    'інша назва',
    'псевдоніми',
    'tên khác',
    'bí danh',
  ],
  purchased_on: [
    'purchase date',
    'purchased',
    'purchased on',
    'purchase time',
    'date purchased',
    'bought',
    'bought on',
    'date bought',
    'تاريخ الشراء',
    'تاريخ شراء',
    'date d achat',
    'achete le',
    'kaufdatum',
    'gekauft am',
    'data di acquisto',
    'data acquisto',
    'fecha de compra',
    'fecha compra',
    'comprado el',
    'дата покупки',
    'дата купівлі',
    'куплено',
    'придбано',
    'дата придбання',
    'ngày mua',
  ],
  vendor: [
    'vendor',
    'shop',
    'store',
    'seller',
    'retailer',
    'purchased from',
    'purchase from',
    'bought from',
    'where bought',
    'متجر',
    'بائع',
    'محل',
    'magasin',
    'vendeur',
    'boutique',
    'handler',
    'geschaft',
    'verkaufer',
    'negozio',
    'venditore',
    'vendedor',
    'tienda',
    'proveedor',
    'comercio',
    'продавець',
    'магазин',
    'постачальник',
    'де куплено',
    'người bán',
    'cửa hàng',
    'nơi mua',
  ],
  price: [
    'price',
    'cost',
    'purchase price',
    'amount paid',
    'paid',
    'سعر',
    'ثمن',
    'تكلفة',
    'prix',
    'cout',
    'preis',
    'kaufpreis',
    'kosten',
    'prezzo',
    'costo',
    'precio',
    'precio de compra',
    'coste',
    'ціна',
    'вартість',
    'ціна покупки',
    'оплачено',
    'giá',
    'giá mua',
    'chi phí',
  ],
  currency: [
    'currency',
    'عملة',
    'devise',
    'monnaie',
    'wahrung',
    'valuta',
    'moneda',
    'divisa',
    'валюта',
    'tiền tệ',
  ],
  manual_url: [
    'manual',
    'manual url',
    'manual link',
    'user manual',
    'دليل',
    'دليل الاستخدام',
    'كتيب',
    'manuel',
    'mode d emploi',
    'handbuch',
    'anleitung',
    'bedienungsanleitung',
    'manuale',
    'manual de usuario',
    'enlace del manual',
    'інструкція',
    'посібник',
    'посібник користувача',
    'sách hướng dẫn',
    'hướng dẫn',
  ],
  legacy_code: [
    'code',
    'asset id',
    'asset tag',
    'asset number',
    'inventory number',
    'label',
    'label code',
    'رمز',
    'كود',
    'رقم الأصل',
    'رقم الاصل',
    'رقم الجرد',
    'numero d inventaire',
    'code inventaire',
    'inventarnummer',
    'anlagennummer',
    'numero di inventario',
    'codice',
    'codigo',
    'numero de inventario',
    'codigo de inventario',
    'код',
    'інвентарний номер',
    'етикетка',
    'мітка',
    'mã',
    'mã tài sản',
    'số kiểm kê',
  ],
  own_code: [
    'own code',
    'my code',
    'kept code',
    'رمزي',
    'الرمز الخاص',
    'كودي',
    'mon code',
    'code personnel',
    'eigener code',
    'mein code',
    'codice personale',
    'mio codice',
    'mi codigo',
    'codigo propio',
    'codigo personal',
    'власний код',
    'мій код',
    'mã của tôi',
    'mã riêng',
  ],
  source_id: [
    'id',
    'uuid',
    'guid',
    'ref',
    'reference',
    'import ref',
    'row id',
    'item id',
    'معرف',
    'مرجع',
    'referencia',
    'identificador',
    'ідентифікатор',
    'mã định danh',
    'tham chiếu',
  ],
};

const LOOKUP = (() => {
  const map = new Map<string, MappableField>();
  for (const [field, words] of Object.entries(WORDS)) {
    for (const w of words) map.set(normaliseHeader(w), field as MappableField);
  }
  return map;
})();

/** Vietnamese words that without their marks are other words ("The", "Ten", "Hang", "MA"; "Hàng"
 * is another Vietnamese word), so a header only means them with the marks. */
const MARKS_REQUIRED: ReadonlyMap<string, string> = new Map(
  ['tên', 'thẻ', 'hãng', 'mã'].map((word) => [normaliseHeader(word), word]),
);

/** A header compared with its marks: composed, lowercase, no brackets or punctuation. */
function markedHeader(header: string): string {
  return header
    .normalize('NFC')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/** The field a header names, or null. A Homebox export's `HB.` prefix is looked past. */
export function fieldFromHeader(header: string): MappableField | null {
  const h = normaliseHeader(header);
  const word = MARKS_REQUIRED.get(h);
  if (word && markedHeader(header) !== word) return null;
  return LOOKUP.get(h) ?? LOOKUP.get(h.replace(/^hb /, '')) ?? null;
}

/**
 * "Nombre" is French for how many and Spanish for the name. WORDS holds the French. Another column
 * saying how many means the Spanish; otherwise another column naming the thing means the French;
 * alone it's the name, since every sheet has one.
 */
function fieldIn(column: string, columns: readonly string[]): MappableField | null {
  const field = fieldFromHeader(column);
  if (normaliseHeader(column) !== 'nombre') return field;
  const others = columns.filter((c) => normaliseHeader(c) !== 'nombre').map(fieldFromHeader);
  if (others.includes('quantity')) return 'name';
  return others.includes('name') ? 'quantity' : 'name';
}

/**
 * A mapping for these headers: each column its guessed field, or `ignore`. A field that takes one
 * column goes to the first column that names it; a later one is left for the person to choose.
 */
export function suggestMapping(columns: readonly string[]): Record<string, MappableField> {
  const out: Record<string, MappableField> = {};
  const used = new Set<string>();
  for (const column of columns) {
    const field = fieldIn(column, columns);
    if (field && (MULTI_FIELDS.has(field) || !used.has(field))) {
      out[column] = field;
      used.add(field);
    } else out[column] = 'ignore';
  }
  return out;
}

/** Homebox's own headers, every version's spelling (`HB.labels` became `HB.tags` in v0.23,
 * `HB.purchase_time` became `HB.purchase_date` in v0.26). */
const HOMEBOX_FIELDS: Readonly<Record<string, MappableField>> = {
  'HB.import_ref': 'source_id',
  'HB.location': 'place_path',
  'HB.labels': 'tags',
  'HB.tags': 'tags',
  'HB.name': 'name',
  'HB.quantity': 'quantity',
  'HB.description': 'notes',
  'HB.notes': 'notes',
  'HB.purchase_price': 'price',
  'HB.purchase_from': 'vendor',
  'HB.purchase_time': 'purchased_on',
  'HB.purchase_date': 'purchased_on',
  'HB.manufacturer': 'brand',
  'HB.model_number': 'model',
  'HB.serial_number': 'serial',
};

/**
 * A Homebox spreadsheet's mapping (shared isHomeboxCsv): its known headers to their fields, the
 * columns the server's Homebox preset reads itself (HB_CSV_PRESET_COLUMNS) left unmapped, and
 * anything else (custom fields, `HB.parent_import_ref`) not imported unless the person maps it.
 */
export function homeboxMapping(columns: readonly string[]): Record<string, MappableField> {
  const out: Record<string, MappableField> = {};
  for (const column of columns) out[column] = HOMEBOX_FIELDS[column] ?? 'ignore';
  return out;
}

/** The columns the Homebox preset reads, so the mapping shows them as its own. */
export const HOMEBOX_PRESET: ReadonlySet<string> = new Set(HB_CSV_PRESET_COLUMNS);

/**
 * The date formats that read the most sampled dates (all of them, in a clean file), in
 * DATE_FORMATS' order: one when the file settles it, several when it doesn't (every day ≤ 12),
 * none when nothing reads. A date that doesn't read in any format (31/02) doesn't decide it.
 */
export function dateFormatsFor(values: readonly string[]): DateFormat[] {
  const sample = values.filter((v) => v.trim() !== '').slice(0, 500);
  const counts = DATE_FORMATS.map((f) => sample.filter((v) => parseCsvDate(v, f) !== null).length);
  const best = Math.max(0, ...counts);
  return best === 0 ? [] : DATE_FORMATS.filter((_, i) => counts[i] === best);
}

/** The separator the place paths use most: `>`, `/` or `\`; `>` when none appears. */
export function separatorFor(values: readonly string[]): '>' | '/' | '\\' {
  const counts = { '>': 0, '/': 0, '\\': 0 };
  for (const v of values.slice(0, 500)) {
    for (const ch of v) if (ch === '>' || ch === '/' || ch === '\\') counts[ch] += 1;
  }
  const best = (Object.entries(counts) as ['>' | '/' | '\\', number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return best && best[1] > 0 ? best[0] : '>';
}

/** A custom field's key as registry keys are written, for the `custom.<key>` choice. */
export const CUSTOM_KEY = /^[a-z][a-z0-9_]{0,39}$/;
