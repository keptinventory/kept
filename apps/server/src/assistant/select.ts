import type { ToolName } from '@kept/mcp';
import type { KeptMessage } from '../ai/convert.js';

// The tools one assistant step offers. Every tool's description and schema go to the model on
// every request, and a small per-minute limit counts them: Groq's free tier (8,000 tokens a
// minute) refuses a single request over it, and the 27 tools alone come to about 5,000 tokens.
// So a step offers what the question is about, chosen without a model call:
//
// - the core, always: finding things (where_is, search_things, get_thing, list_contents, the
//   locations) and the everyday changes (add, update, move, mark seen);
// - a topic's tools when the thread's last questions name it, by keywords in the six interface
//   languages (lending, schedules, warranties, documents, vehicles and meters, stock, history,
//   places and capture links, tags). A Latin-script keyword matches at a word's start; an Arabic one
//   anywhere (its prefixes join the word: الـ، و، ب، ل); a Vietnamese one as whole words, with its
//   tone marks kept, since folding them joins different words (mượn "borrow", muốn "want");
// - any tool the thread already called, or asked for and was not offered, so a follow-up
//   ("and the drill?") keeps its tools and the model can ask again;
// - never a tool the person may not call: `available` is already narrowed by module, role and
//   door (tools/context.ts toolsIn). The moving tools are MCP's only.
//
// The answer is a list of choices, largest first: the last questions' topics, the latest
// question's alone, then the core. The loop sends the first one that fits the provider's limit.

/** Offered on every step. */
export const CORE_TOOLS: readonly ToolName[] = Object.freeze([
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

type Lang = 'en' | 'fr' | 'de' | 'it' | 'ar' | 'vi';
type Topic = { tools: readonly ToolName[]; words: Readonly<Record<Lang, string>> };

/** Keywords per topic and language, `|` between them, written plainly: `normalise` (or, for
 * Vietnamese, `normaliseVi`) folds both sides the same way. Vietnamese writes some syllables
 * with the tone mark in two places (hóa, hoá); both are listed. */
const TOPICS: Readonly<Record<string, Topic>> = {
  history: {
    tools: ['thing_history'],
    words: {
      en: 'history|happened|who moved|who changed|who added|when did|last time',
      fr: 'historique|arrivé|qui a',
      de: 'verlauf|geschichte|passiert|wer hat|wann',
      it: 'cronologia|storia|successo|chi ha',
      ar: 'سجل|تاريخ|حصل|حدث|من نقل|من غير|متى',
      vi: 'lịch sử|đã xảy ra|chuyện gì|ai đã|ai chuyển|ai sửa|ai thêm|khi nào|lần cuối',
    },
  },
  documents: {
    tools: ['find_documents'],
    words: {
      en: 'receipt|manual|invoice|document|paperwork|pdf|instructions for',
      fr: 'reçu|facture|manuel|notice|mode d’emploi',
      de: 'beleg|quittung|rechnung|anleitung|handbuch|dokument',
      it: 'ricevuta|scontrino|fattura|manuale|documento|istruzioni',
      ar: 'إيصال|وصل|فاتورة|دليل|كتيب|مستند|وثيقة|ورق',
      vi: 'hóa đơn|hoá đơn|biên lai|tài liệu|giấy tờ|chứng từ|hướng dẫn sử dụng|sách hướng dẫn',
    },
  },
  // #313: changing a place (its name, kind, parent, order) and turning places into boxes.
  // #238/#372: turning furniture, and a room's size.
  places: {
    tools: ['create_place', 'update_place', 'turn_into_boxes', 'attach_link'],
    words: {
      en: 'place|room|bedroom|bathroom|kitchen|hallway|balcony|attic|basement|shelf|shelves|drawer|cupboard|cabinet|zone|create|photo|picture|scan|link|attach|rename|into a box|into boxes|custom order|move up|move down|rotate|on its side|stand it up|furniture|bookcase|bookshelf|wardrobe|dimensions',
      fr: 'pièce|chambre|cuisine|salle de bain|couloir|grenier|étagère|tiroir|placard|armoire|créer|lien|renommer|en boîte|en boîtes|ordre|tourner|tournez|tourne le|tourne la|tourne l’|pivot|sur le côté|meuble|bibliothèque',
      de: 'raum|zimmer|schlafzimmer|badezimmer|wohnzimmer|arbeitszimmer|kinderzimmer|küche|flur|dachboden|keller|regal|schublade|schrank|anlegen|erstell|foto|bild|umbenenn|in kisten|in eine kiste|reihenfolge|drehen|umdreh|auf die seite|auf der seite|möbel|bücherregal',
      it: 'stanza|camera da letto|bagno|cucina|corridoio|soffitta|cantina|scaffal|cassetto|armadio|crea|collegamento|rinomin|in scatol|ordine|girare|giralo|girala|gira il|gira la|gira lo|ruotare|ruotalo|ruotala|di lato|sul fianco|mobil|libreria',
      ar: 'غرفة|مطبخ|حمام|ممر|شرفة|بلكونة|رف|درج|خزانة|دولاب|مكان|أنشئ|صورة|رابط|تسمية|صندوق|صناديق|ترتيب|دوّر ال|اقلب|على جنبه|على جنبها|على الجنب|أثاث|مكتبة',
      vi: 'vị trí|phòng|kệ|giá sách|tủ quần áo|tủ sách|tủ đồ|ngăn kéo|nội thất|tạo|chụp|chụp ảnh|hình ảnh|quét|liên kết|đính kèm|đổi tên|thành hộp|thứ tự|xoay|nằm nghiêng|dựng đứng',
    },
  },
  schedules: {
    tools: ['upcoming', 'complete_schedule', 'snooze_schedule'],
    words: {
      en: 'due|overdue|schedul|remind|maintenance|upcoming|soon|expir|next|done|snooze|postpone|put off|later|task|this week|this month',
      fr: 'échéance|prévu|rappel|entretien|bientôt|prochain|fait|report|tâche',
      de: 'fällig|termin|erinner|wartung|bald|abgelaufen|läuft ab|nächst|erledigt|verschieb|aufgabe',
      it: 'scadenz|scade|promemoria|manutenzion|presto|prossim|fatto|rimand|posticip|compito',
      ar: 'موعد|مستحق|صيانة|تذكير|قريبا|تنتهي|ينتهي|القادم|خلصت|أجل|تأجيل|مهمة',
      vi: 'lịch trình|lịch bảo dưỡng|lịch hẹn|bảo dưỡng|bảo trì|đến hạn|quá hạn|nhắc|sắp tới|hết hạn|tiếp theo|xong|hoãn|dời|để sau|tác vụ|việc cần làm|tuần này|tháng này',
    },
  },
  lending: {
    tools: ['lend_thing', 'return_thing', 'borrow_thing', 'upcoming'],
    words: {
      en: 'lend|lent|loan|borrow|return|gave|give back|got back|came back|is back|brought back|back from|who has|hand over|handed|hand-over|handover',
      fr: 'prêt|emprunt|rendu|rendre|revenu|confié|remis',
      de: 'verleih|verlieh|geliehen|ausgeliehen|ausleih|leih|zurück|übergeb|übergab',
      it: 'prest|restitu|ridat|riavut|tornat|consegn|affidat',
      ar: 'أعار|أعرت|استعار|استلف|سلف|إعارة|رجع|أرجع|مع مين|عند مين|عند من|اقترض|سلمت|تسليم',
      vi: 'cho mượn|mượn|trả lại|đã trả|trả cho|trả về|lấy lại|nhận lại|ai đang giữ|ai giữ|đang giữ|bàn giao|giao cho',
    },
  },
  warranties: {
    tools: ['add_warranty', 'open_claim', 'update_claim', 'find_documents', 'upcoming'],
    words: {
      en: 'warrant|guarantee|claim|repair|broken|rma',
      fr: 'garantie|réclamation|réparation|panne|cassé',
      de: 'gewährleistung|reklamation|reparatur|kaputt|defekt',
      it: 'garanzia|reclamo|riparazion|rotto|guasto',
      ar: 'ضمان|كفالة|مطالبة|إصلاح|تصليح|عطل|مكسور|بايظ',
      vi: 'bảo hành|yêu cầu bảo hành|sửa chữa|đi sửa|hỏng|hư|đổi trả',
    },
  },
  vehicles: {
    tools: ['log_service', 'log_reading', 'log_fuel', 'upcoming'],
    words: {
      en: 'car|cars|vehicle|bike|motorbike|servic|oil|tyre|tire|mileage|odometer|km|miles|fuel|petrol|gas|diesel|refuel|filled up|fill up|fill-up|tank|reading|meter|hours|electricity',
      fr: 'voiture|véhicule|vidange|pneu|kilométrage|compteur|essence|carburant|gazole|plein|relevé',
      de: 'auto|fahrzeug|wagen|inspektion|ölwechsel|reifen|kilometer|tacho|benzin|zähler|getankt',
      it: 'macchina|veicolo|tagliando|olio|gomm|chilometr|contachilometri|benzina|carburante|gasolio|pieno|lettura|contatore',
      ar: 'سيارة|عربية|موتوسيكل|صيانة|زيت|كاوتش|إطار|عداد|كيلو|بنزين|وقود|سولار|فول|تفويل|قراءة|كهرباء',
      vi: 'xe|ô tô|phương tiện|bảo dưỡng|thay dầu|dầu|nhớt|lốp|số km|cây số|công tơ|công-tơ-mét|nhiên liệu|xăng|đổ xăng|đổ đầy|chỉ số|đồng hồ đo|đồng hồ điện|điện năng|kwh',
    },
  },
  // #209: the tags themselves; tagging one thing is update_thing's, in the core.
  tags: {
    tools: ['list_tags', 'tag_things'],
    words: {
      en: 'tag|tags|tagged|untag',
      fr: 'tag|étiquette',
      de: 'schlagwort|tag|tags|getaggt',
      it: 'tag|etichetta',
      ar: 'وسم|وسوم|موسوم|تاغ',
      vi: 'gắn thẻ|bỏ thẻ|các thẻ|thẻ nào|thẻ này',
    },
  },
  stock: {
    tools: ['adjust_stock', 'upcoming'],
    words: {
      en: 'stock|used up|use up|ran out|run out|running out|left|remaining|refill|restock|consumable|supply|supplies|top up',
      fr: 'reste|épuisé|consommable|réappro|utilisé',
      de: 'vorrat|bestand|aufgebraucht|übrig|verbrauch|nachfüll|leer',
      it: 'scorta|scorte|rimast|esaurit|consumabil|usat|finit',
      ar: 'مخزون|متبقي|باقي|نفد|نفذ|خلص|استهلك|كمية',
      vi: 'tồn kho|còn lại|còn bao nhiêu|còn mấy|sắp hết|dùng hết|hết rồi|vật tư|tiêu hao|bổ sung|nạp thêm|mua thêm|số lượng',
    },
  },
};

/**
 * Text folded for matching: lower case, accents off (é → e, ä → a), Arabic's alef forms as ا,
 * ta marbuta as ه, alef maqsura as ي, no tatweel or short vowels, and the curly apostrophe as
 * the straight one.
 */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/[’‘]/g, "'");
}

/** Vietnamese folded for matching: lower case and composed, tone marks kept. */
export function normaliseVi(s: string): string {
  return s.toLowerCase().normalize('NFC').replace(/[’‘]/g, "'");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Two patterns per topic: Latin keywords at a word's start and Arabic ones anywhere, on
 * `normalise`d text; Vietnamese ones as whole words, on `normaliseVi`d text. */
const PATTERNS: readonly [Topic, RegExp, RegExp][] = Object.values(TOPICS).map((topic) => {
  const list = (langs: Lang[], fold: (s: string) => string) =>
    langs.flatMap((l) => topic.words[l].split('|')).map((w) => escapeRe(fold(w)));
  const re = `(?<![\\p{L}\\p{N}])(?:${list(['en', 'fr', 'de', 'it'], normalise).join('|')})|${list(['ar'], normalise).join('|')}`;
  const vi = `(?<![\\p{L}\\p{N}])(?:${list(['vi'], normaliseVi).join('|')})(?![\\p{L}\\p{N}])`;
  return [topic, new RegExp(re, 'u'), new RegExp(vi, 'u')];
});

/** A size said as two numbers, "4 by 3", "2.5 x 2 m", "4 sur 3", "٤ في ٣": a room with its size
 * (#372). Words such as "size" or "metre" alone say too little (a TV's size, a tape measure). */
const DIMENSIONS =
  /\p{Nd}+(?:[.,٫]\p{Nd}+)?\s*(?:cm|m|metres?|meters?|metri|meter)?\s*(?:x|×|by|sur|per|mal|في)\s*\p{Nd}/u;

/** The tools of every topic `text` names. */
function topicTools(text: string): Set<ToolName> {
  const folded = normalise(text);
  const kept = normaliseVi(text);
  const out = new Set<ToolName>();
  for (const [topic, re, vi] of PATTERNS) {
    if (re.test(folded) || vi.test(kept)) for (const t of topic.tools) out.add(t);
  }
  if (DIMENSIONS.test(folded)) for (const t of TOPICS.places?.tools ?? []) out.add(t);
  return out;
}

export type Ask = {
  /** The thread's last questions, oldest first; the last is this turn's. */
  questions: readonly string[];
  /** Tool names the thread's model called, offered or not. */
  used: readonly string[];
};

/** How many of the thread's last questions choose the topics. */
const QUESTIONS = 3;

/** The thread's last questions and every tool it called. */
export function askOf(messages: readonly KeptMessage[]): Ask {
  const questions: string[] = [];
  const used = new Set<string>();
  for (const m of messages) {
    if (m.role === 'user') {
      const text = m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n');
      if (text) questions.push(text);
    }
    for (const p of m.parts) if (p.type === 'tool_call') used.add(p.tool);
  }
  return { questions: questions.slice(-QUESTIONS), used: [...used] };
}

/**
 * The tool sets a step may offer, largest first, each in `available`'s order: the last
 * questions' topics, the latest question's alone, the core. Repeats are left out.
 */
export function offeredTools(available: readonly ToolName[], ask: Ask): ToolName[][] {
  const used = new Set(ask.used);
  const pick = (topics: Set<ToolName>) =>
    available.filter((t) => CORE_TOOLS.includes(t) || used.has(t) || topics.has(t));
  const all = new Set<ToolName>();
  for (const q of ask.questions) for (const t of topicTools(q)) all.add(t);
  const latest = ask.questions.at(-1);
  const tiers = [pick(all), pick(latest ? topicTools(latest) : new Set()), pick(new Set())];
  return tiers.filter((t, i) => i === 0 || t.join() !== tiers[i - 1]?.join());
}
