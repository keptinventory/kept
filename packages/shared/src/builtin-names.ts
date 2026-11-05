/**
 * The built-in library's names in French, German and Italian (D204) and Ukrainian. English and
 * Arabic stay beside each definition in builtin-types.ts; these live here so that file keeps its
 * shape. The test checks every built-in type and field has all four. Vietnamese has no table, so
 * it falls back to English (see builtinTypeName/builtinFieldName).
 */
import { BUILTIN_TYPES, builtinType } from './builtin-types.js';

export type BuiltinNameLocale = 'en' | 'ar' | 'fr' | 'de' | 'it' | 'vi' | 'uk';
type More = {
  readonly fr: string;
  readonly de: string;
  readonly it: string;
  readonly uk: string;
  readonly vi?: string;
};

export const BUILTIN_TYPE_NAMES_MORE: Readonly<Record<string, More>> = {
  device: { fr: 'Appareil', de: 'Gerät', it: 'Dispositivo', uk: 'Пристрій' },
  furniture: { fr: 'Meubles', de: 'Möbel', it: 'Mobili', uk: 'Меблі' },
  appliance: {
    fr: 'Électroménager',
    de: 'Haushaltsgerät',
    it: 'Elettrodomestico',
    uk: 'Побутова техніка',
  },
  large_appliance: {
    fr: 'Gros électroménager',
    de: 'Großgerät',
    it: 'Grande elettrodomestico',
    uk: 'Велика побутова техніка',
  },
  small_appliance: {
    fr: 'Petit électroménager',
    de: 'Kleingerät',
    it: 'Piccolo elettrodomestico',
    uk: 'Дрібна побутова техніка',
  },
  electronics: { fr: 'Électronique', de: 'Elektronik', it: 'Elettronica', uk: 'Електроніка' },
  phone: { fr: 'Téléphone', de: 'Telefon', it: 'Telefono', uk: 'Телефон' },
  tablet: { fr: 'Tablette', de: 'Tablet', it: 'Tablet', uk: 'Планшет' },
  computer: { fr: 'Ordinateur', de: 'Computer', it: 'Computer', uk: 'Комп’ютер' },
  tv_display: {
    fr: 'TV / écran',
    de: 'TV / Bildschirm',
    it: 'TV / schermo',
    uk: 'Телевізор / екран',
  },
  network_device: {
    fr: 'Appareil réseau',
    de: 'Netzwerkgerät',
    it: 'Dispositivo di rete',
    uk: 'Мережевий пристрій',
  },
  camera: { fr: 'Appareil photo', de: 'Kamera', it: 'Fotocamera', uk: 'Камера' },
  console: { fr: 'Console de jeux', de: 'Spielkonsole', it: 'Console', uk: 'Ігрова консоль' },
  cable: { fr: 'Câble', de: 'Kabel', it: 'Cavo', uk: 'Кабель' },
  charger: {
    fr: 'Chargeur / alimentation',
    de: 'Ladegerät / Netzteil',
    it: 'Caricatore / alimentatore',
    uk: 'Зарядний пристрій / блок живлення',
  },
  tool: { fr: 'Outil', de: 'Werkzeug', it: 'Attrezzo', uk: 'Інструмент' },
  power_tool: {
    fr: 'Outil électrique',
    de: 'Elektrowerkzeug',
    it: 'Elettroutensile',
    uk: 'Електроінструмент',
  },
  box_bin: {
    fr: 'Boîte / bac',
    de: 'Kiste / Box',
    it: 'Scatola / contenitore',
    uk: 'Коробка / контейнер',
  },
  safe: { fr: 'Coffre-fort', de: 'Tresor', it: 'Cassaforte', uk: 'Сейф' },
  vehicle: { fr: 'Véhicule', de: 'Fahrzeug', it: 'Veicolo', uk: 'Транспортний засіб' },
  car: { fr: 'Voiture', de: 'Auto', it: 'Auto', uk: 'Автомобіль' },
  motorbike: { fr: 'Moto', de: 'Motorrad', it: 'Moto', uk: 'Мотоцикл' },
  bicycle: { fr: 'Vélo', de: 'Fahrrad', it: 'Bicicletta', uk: 'Велосипед' },
  generator: { fr: 'Groupe électrogène', de: 'Stromerzeuger', it: 'Generatore', uk: 'Генератор' },
  safety_equipment: {
    fr: 'Équipement de sécurité',
    de: 'Sicherheitsausrüstung',
    it: 'Dispositivi di sicurezza',
    uk: 'Засоби безпеки',
  },
  fire_extinguisher: { fr: 'Extincteur', de: 'Feuerlöscher', it: 'Estintore', uk: 'Вогнегасник' },
  first_aid_kit: {
    fr: 'Trousse de secours',
    de: 'Erste-Hilfe-Set',
    it: 'Kit di pronto soccorso',
    uk: 'Аптечка першої допомоги',
  },
  smoke_detector: {
    fr: 'Détecteur de fumée',
    de: 'Rauchmelder',
    it: 'Rilevatore di fumo',
    uk: 'Детектор диму',
  },
  child_car_seat: {
    fr: 'Siège auto enfant',
    de: 'Kindersitz',
    it: 'Seggiolino auto',
    uk: 'Дитяче автокрісло',
  },
  valuables: {
    fr: 'Objets de valeur',
    de: 'Wertsachen',
    it: 'Oggetti di valore',
    uk: 'Цінні речі',
  },
  collectible: {
    fr: 'Objet de collection',
    de: 'Sammlerstück',
    it: 'Oggetto da collezione',
    uk: 'Колекційний предмет',
  },
  consumables: {
    fr: 'Consommables',
    de: 'Verbrauchsmaterial',
    it: 'Materiali di consumo',
    uk: 'Витратні матеріали',
  },
  batteries: { fr: 'Piles', de: 'Batterien', it: 'Batterie', uk: 'Батарейки' },
  filters: { fr: 'Filtres', de: 'Filter', it: 'Filtri', uk: 'Фільтри' },
};

export const BUILTIN_FIELD_NAMES_MORE: Readonly<Record<string, More>> = {
  os: {
    fr: 'Système d’exploitation',
    de: 'Betriebssystem',
    it: 'Sistema operativo',
    uk: 'Операційна система',
  },
  os_version: {
    fr: 'Version du système',
    de: 'Systemversion',
    it: 'Versione del sistema',
    uk: 'Версія системи',
  },
  firmware: { fr: 'Firmware', de: 'Firmware', it: 'Firmware', uk: 'Мікропрограма' },
  mac_address: { fr: 'Adresse MAC', de: 'MAC-Adresse', it: 'Indirizzo MAC', uk: 'MAC-адреса' },
  linked_account: {
    fr: 'Compte lié ou identifiant',
    de: 'Verknüpftes Konto oder Login',
    it: 'Account collegato o login',
    uk: 'Пов’язаний обліковий запис або логін',
  },
  material: { fr: 'Matériau', de: 'Material', it: 'Materiale', uk: 'Матеріал' },
  dimensions: { fr: 'Dimensions', de: 'Abmessungen', it: 'Dimensioni', uk: 'Розміри' },
  imei: { fr: 'IMEI', de: 'IMEI', it: 'IMEI', uk: 'IMEI' },
  imei_2: { fr: 'Second IMEI', de: 'Zweite IMEI', it: 'Secondo IMEI', uk: 'Другий IMEI' },
  storage: { fr: 'Stockage', de: 'Speicher', it: 'Memoria', uk: 'Пам’ять' },
  cpu: { fr: 'CPU', de: 'CPU', it: 'CPU', uk: 'CPU' },
  ram: { fr: 'RAM', de: 'RAM', it: 'RAM', uk: 'RAM' },
  licence_key: {
    fr: 'Clé de licence',
    de: 'Lizenzschlüssel',
    it: 'Chiave di licenza',
    uk: 'Ліцензійний ключ',
  },
  screen_size: {
    fr: 'Taille de l’écran',
    de: 'Bildschirmgröße',
    it: 'Dimensioni schermo',
    uk: 'Розмір екрана',
  },
  wifi_password: {
    fr: 'Mot de passe Wi-Fi',
    de: 'Wi-Fi-Passwort',
    it: 'Password Wi-Fi',
    uk: 'Пароль Wi-Fi',
  },
  connector_a: { fr: 'Connecteur A', de: 'Stecker A', it: 'Connettore A', uk: 'Роз’єм A' },
  connector_b: { fr: 'Connecteur B', de: 'Stecker B', it: 'Connettore B', uk: 'Роз’єм B' },
  length: { fr: 'Longueur', de: 'Länge', it: 'Lunghezza', uk: 'Довжина' },
  wattage: { fr: 'Puissance', de: 'Leistung', it: 'Potenza', uk: 'Потужність' },
  connector: { fr: 'Connecteur', de: 'Stecker', it: 'Connettore', uk: 'Роз’єм' },
  voltage: { fr: 'Tension', de: 'Spannung', it: 'Tensione', uk: 'Напруга' },
  battery_platform: {
    fr: 'Système de batterie',
    de: 'Akkusystem',
    it: 'Piattaforma batteria',
    uk: 'Тип акумулятора',
  },
  combination: { fr: 'Combinaison', de: 'Kombination', it: 'Combinazione', uk: 'Комбінація' },
  vin: { fr: 'VIN', de: 'VIN', it: 'VIN', uk: 'VIN' },
  plate: { fr: 'Plaque d’immatriculation', de: 'Kennzeichen', it: 'Targa', uk: 'Номерний знак' },
  frame_number: {
    fr: 'Numéro de cadre',
    de: 'Rahmennummer',
    it: 'Numero di telaio',
    uk: 'Номер рами',
  },
  appraisal_value: {
    fr: 'Valeur d’expertise',
    de: 'Schätzwert',
    it: 'Valore di stima',
    uk: 'Оціночна вартість',
  },
  appraisal_date: {
    fr: 'Date d’expertise',
    de: 'Datum der Schätzung',
    it: 'Data della stima',
    uk: 'Дата оцінки',
  },
  edition: { fr: 'Édition', de: 'Ausgabe', it: 'Edizione', uk: 'Видання' },
  condition_grade: {
    fr: 'État de conservation',
    de: 'Erhaltungsgrad',
    it: 'Stato di conservazione',
    uk: 'Стан збереження',
  },
  provenance_notes: {
    fr: 'Notes sur la provenance',
    de: 'Notizen zur Herkunft',
    it: 'Note sulla provenienza',
    uk: 'Примітки про походження',
  },
  size: { fr: 'Format', de: 'Größe', it: 'Formato', uk: 'Формат' },
  chemistry: { fr: 'Technologie', de: 'Zellchemie', it: 'Chimica', uk: 'Тип елемента' },
  fits: { fr: 'Compatible avec', de: 'Passend für', it: 'Compatibile con', uk: 'Сумісний із' },
};

/** Every built-in field's English and Arabic names by key (unique along any chain: first wins). */
const FIELD_NAMES: ReadonlyMap<string, { en: string; ar: string }> = (() => {
  const out = new Map<string, { en: string; ar: string }>();
  for (const t of BUILTIN_TYPES)
    for (const f of t.fields) if (!out.has(f.key)) out.set(f.key, f.names);
  return out;
})();

/** A built-in type's name in `locale`; undefined for a key that isn't built in. */
export function builtinTypeName(key: string, locale: BuiltinNameLocale): string | undefined {
  const names = builtinType(key)?.names;
  if (!names) return undefined;
  if (locale === 'en' || locale === 'ar') return names[locale];
  return BUILTIN_TYPE_NAMES_MORE[key]?.[locale] ?? names.en;
}

/** A built-in field's label in `locale`; undefined for a key that isn't built in. */
export function builtinFieldName(key: string, locale: BuiltinNameLocale): string | undefined {
  const names = FIELD_NAMES.get(key);
  if (!names) return undefined;
  if (locale === 'en' || locale === 'ar') return names[locale];
  return BUILTIN_FIELD_NAMES_MORE[key]?.[locale] ?? names.en;
}
