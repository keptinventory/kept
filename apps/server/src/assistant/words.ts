// The assistant's fixed sentences: what the thread says when Kept,
// not the model, answers. Stored as the answer's text in the question's interface language,
// so the thread reads the same on every device. The location's name is the person's own text,
// isolated with FSI…PDI so it reads correctly inside a right-to-left sentence (lib/bidi.ts's rule
// on the web).

export type WordsLocale = 'ar' | 'de' | 'en' | 'es' | 'fr' | 'it' | 'uk' | 'vi';

const FSI = '⁨';
const PDI = '⁩';
const iso = (s: string) => `${FSI}${s}${PDI}`;

const LOCALES: readonly WordsLocale[] = ['ar', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi'];

export function wordsLocale(locale: string): WordsLocale {
  const base = locale.slice(0, 2).toLowerCase();
  return LOCALES.find((l) => l === base) ?? 'en';
}

const VIEWER: Record<WordsLocale, (location: string) => string> = {
  ar: (l) => `لا يمكن للمشاهدين إجراء تغييرات هنا. اطلب ذلك من أحد مسؤولي ${iso(l)}.`,
  de: (l) => `Betrachter können hier nichts ändern. Frag eine Admin-Person von ${iso(l)}.`,
  en: (l) => `Viewers can't make changes here. Ask an admin of ${iso(l)}.`,
  es: (l) =>
    `Los espectadores no pueden hacer cambios aquí. Pídele a un administrador de ${iso(l)}.`,
  fr: (l) =>
    `Les lecteurs ne peuvent rien modifier ici. Demandez à un administrateur de ${iso(l)}.`,
  it: (l) => `Chi visualizza non può fare modifiche qui. Chiedi a un amministratore di ${iso(l)}.`,
  uk: (l) =>
    `Спостерігачі не можуть вносити тут зміни. Запитайте адміністратора локації «${iso(l)}».`,
  vi: (l) => `Người xem không thể thay đổi ở đây. Hãy nhờ một quản trị viên của ${iso(l)}.`,
};

const NO_CHANGES: Record<WordsLocale, string> = {
  ar: 'لا يمكنك إجراء تغييرات هنا.',
  de: 'Du kannst hier nichts ändern.',
  en: "You can't make changes here.",
  es: 'No puedes hacer cambios aquí.',
  fr: 'Vous ne pouvez rien modifier ici.',
  it: 'Non puoi fare modifiche qui.',
  uk: 'Ви не можете вносити тут зміни.',
  vi: 'Bạn không thể thay đổi ở đây.',
};

const NO_ANSWER: Record<WordsLocale, string> = {
  ar: 'لم أتمكن من إكمال هذه الإجابة. اسأل مرة أخرى، وربما بشكل أدق.',
  de: 'Ich konnte die Antwort nicht abschließen. Frag noch einmal, vielleicht genauer.',
  en: "I couldn't finish that answer. Ask again, perhaps more narrowly.",
  es: 'No pude terminar esa respuesta. Pregunta otra vez, quizá de forma más concreta.',
  fr: "Je n'ai pas pu terminer cette réponse. Reposez la question, peut-être plus précisément.",
  it: 'Non sono riuscito a completare la risposta. Chiedi di nuovo, magari in modo più preciso.',
  uk: 'Мені не вдалося сформувати повну відповідь. Запитайте ще раз, можливо, конкретніше.',
  vi: 'Tôi không thể hoàn thành câu trả lời đó. Hãy hỏi lại, có thể cụ thể hơn.',
};

/** A viewer asked for a change, and the model tried one anyway. */
export function viewerRefusal(locale: string, locationName: string | null): string {
  const w = wordsLocale(locale);
  return locationName ? VIEWER[w](locationName) : NO_CHANGES[w];
}

/** The turn ran out of steps or time without an answer. */
export function noAnswer(locale: string): string {
  return NO_ANSWER[wordsLocale(locale)];
}
