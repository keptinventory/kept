/**
 * The built-in library's names in French, German and Italian (D204), Ukrainian and Spanish. English
 * and Arabic stay beside each definition in builtin-types.ts; these live here so that file keeps its
 * shape. The test checks every built-in type and field has each of them. Vietnamese has no table,
 * so it falls back to English (see builtinTypeName/builtinFieldName).
 */
import { BUILTIN_TYPES, builtinType } from './builtin-types.js';

export type BuiltinNameLocale = 'en' | 'ar' | 'fr' | 'de' | 'it' | 'vi' | 'uk' | 'es';
type More = {
  readonly fr: string;
  readonly de: string;
  readonly it: string;
  readonly uk: string;
  readonly es: string;
  readonly vi?: string;
};

export const BUILTIN_TYPE_NAMES_MORE: Readonly<Record<string, More>> = {
  device: { fr: 'Appareil', de: 'Gerät', it: 'Dispositivo', uk: 'Пристрій', es: 'Dispositivo' },
  furniture: { fr: 'Meubles', de: 'Möbel', it: 'Mobili', uk: 'Меблі', es: 'Muebles' },
  appliance: {
    fr: 'Électroménager',
    de: 'Haushaltsgerät',
    it: 'Elettrodomestico',
    uk: 'Побутова техніка',
    es: 'Electrodoméstico',
  },
  large_appliance: {
    fr: 'Gros électroménager',
    de: 'Großgerät',
    it: 'Grande elettrodomestico',
    uk: 'Велика побутова техніка',
    es: 'Gran electrodoméstico',
  },
  small_appliance: {
    fr: 'Petit électroménager',
    de: 'Kleingerät',
    it: 'Piccolo elettrodomestico',
    uk: 'Дрібна побутова техніка',
    es: 'Pequeño electrodoméstico',
  },
  electronics: {
    fr: 'Électronique',
    de: 'Elektronik',
    it: 'Elettronica',
    uk: 'Електроніка',
    es: 'Electrónica',
  },
  phone: { fr: 'Téléphone', de: 'Telefon', it: 'Telefono', uk: 'Телефон', es: 'Teléfono' },
  tablet: { fr: 'Tablette', de: 'Tablet', it: 'Tablet', uk: 'Планшет', es: 'Tableta' },
  computer: { fr: 'Ordinateur', de: 'Computer', it: 'Computer', uk: 'Комп’ютер', es: 'Ordenador' },
  tv_display: {
    fr: 'TV / écran',
    de: 'TV / Bildschirm',
    it: 'TV / schermo',
    uk: 'Телевізор / екран',
    es: 'TV / pantalla',
  },
  network_device: {
    fr: 'Appareil réseau',
    de: 'Netzwerkgerät',
    it: 'Dispositivo di rete',
    uk: 'Мережевий пристрій',
    es: 'Dispositivo de red',
  },
  camera: { fr: 'Appareil photo', de: 'Kamera', it: 'Fotocamera', uk: 'Камера', es: 'Cámara' },
  console: {
    fr: 'Console de jeux',
    de: 'Spielkonsole',
    it: 'Console',
    uk: 'Ігрова консоль',
    es: 'Videoconsola',
  },
  cable: { fr: 'Câble', de: 'Kabel', it: 'Cavo', uk: 'Кабель', es: 'Cable' },
  charger: {
    fr: 'Chargeur / alimentation',
    de: 'Ladegerät / Netzteil',
    it: 'Caricatore / alimentatore',
    uk: 'Зарядний пристрій / блок живлення',
    es: 'Cargador / fuente de alimentación',
  },
  tool: { fr: 'Outil', de: 'Werkzeug', it: 'Attrezzo', uk: 'Інструмент', es: 'Herramienta' },
  power_tool: {
    fr: 'Outil électrique',
    de: 'Elektrowerkzeug',
    it: 'Elettroutensile',
    uk: 'Електроінструмент',
    es: 'Herramienta eléctrica',
  },
  box_bin: {
    fr: 'Boîte / bac',
    de: 'Kiste / Box',
    it: 'Scatola / contenitore',
    uk: 'Коробка / контейнер',
    es: 'Caja / contenedor',
  },
  safe: { fr: 'Coffre-fort', de: 'Tresor', it: 'Cassaforte', uk: 'Сейф', es: 'Caja fuerte' },
  vehicle: {
    fr: 'Véhicule',
    de: 'Fahrzeug',
    it: 'Veicolo',
    uk: 'Транспортний засіб',
    es: 'Vehículo',
  },
  car: { fr: 'Voiture', de: 'Auto', it: 'Auto', uk: 'Автомобіль', es: 'Coche' },
  motorbike: { fr: 'Moto', de: 'Motorrad', it: 'Moto', uk: 'Мотоцикл', es: 'Moto' },
  bicycle: { fr: 'Vélo', de: 'Fahrrad', it: 'Bicicletta', uk: 'Велосипед', es: 'Bicicleta' },
  generator: {
    fr: 'Groupe électrogène',
    de: 'Stromerzeuger',
    it: 'Generatore',
    uk: 'Генератор',
    es: 'Generador',
  },
  safety_equipment: {
    fr: 'Équipement de sécurité',
    de: 'Sicherheitsausrüstung',
    it: 'Dispositivi di sicurezza',
    uk: 'Засоби безпеки',
    es: 'Equipo de seguridad',
  },
  fire_extinguisher: {
    fr: 'Extincteur',
    de: 'Feuerlöscher',
    it: 'Estintore',
    uk: 'Вогнегасник',
    es: 'Extintor',
  },
  first_aid_kit: {
    fr: 'Trousse de secours',
    de: 'Erste-Hilfe-Set',
    it: 'Kit di pronto soccorso',
    uk: 'Аптечка першої допомоги',
    es: 'Botiquín de primeros auxilios',
  },
  smoke_detector: {
    fr: 'Détecteur de fumée',
    de: 'Rauchmelder',
    it: 'Rilevatore di fumo',
    uk: 'Детектор диму',
    es: 'Detector de humo',
  },
  child_car_seat: {
    fr: 'Siège auto enfant',
    de: 'Kindersitz',
    it: 'Seggiolino auto',
    uk: 'Дитяче автокрісло',
    es: 'Silla infantil para coche',
  },
  valuables: {
    fr: 'Objets de valeur',
    de: 'Wertsachen',
    it: 'Oggetti di valore',
    uk: 'Цінні речі',
    es: 'Objetos de valor',
  },
  collectible: {
    fr: 'Objet de collection',
    de: 'Sammlerstück',
    it: 'Oggetto da collezione',
    uk: 'Колекційний предмет',
    es: 'Objeto de colección',
  },
  consumables: {
    fr: 'Consommables',
    de: 'Verbrauchsmaterial',
    it: 'Materiali di consumo',
    uk: 'Витратні матеріали',
    es: 'Consumibles',
  },
  batteries: { fr: 'Piles', de: 'Batterien', it: 'Batterie', uk: 'Батарейки', es: 'Pilas' },
  filters: { fr: 'Filtres', de: 'Filter', it: 'Filtri', uk: 'Фільтри', es: 'Filtros' },
};

export const BUILTIN_FIELD_NAMES_MORE: Readonly<Record<string, More>> = {
  os: {
    fr: 'Système d’exploitation',
    de: 'Betriebssystem',
    it: 'Sistema operativo',
    uk: 'Операційна система',
    es: 'Sistema operativo',
  },
  os_version: {
    fr: 'Version du système',
    de: 'Systemversion',
    it: 'Versione del sistema',
    uk: 'Версія системи',
    es: 'Versión del sistema',
  },
  firmware: { fr: 'Firmware', de: 'Firmware', it: 'Firmware', uk: 'Мікропрограма', es: 'Firmware' },
  mac_address: {
    fr: 'Adresse MAC',
    de: 'MAC-Adresse',
    it: 'Indirizzo MAC',
    uk: 'MAC-адреса',
    es: 'Dirección MAC',
  },
  linked_account: {
    fr: 'Compte lié ou identifiant',
    de: 'Verknüpftes Konto oder Login',
    it: 'Account collegato o login',
    uk: 'Пов’язаний обліковий запис або логін',
    es: 'Cuenta vinculada o inicio de sesión',
  },
  material: { fr: 'Matériau', de: 'Material', it: 'Materiale', uk: 'Матеріал', es: 'Material' },
  dimensions: {
    fr: 'Dimensions',
    de: 'Abmessungen',
    it: 'Dimensioni',
    uk: 'Розміри',
    es: 'Dimensiones',
  },
  imei: { fr: 'IMEI', de: 'IMEI', it: 'IMEI', uk: 'IMEI', es: 'IMEI' },
  imei_2: {
    fr: 'Second IMEI',
    de: 'Zweite IMEI',
    it: 'Secondo IMEI',
    uk: 'Другий IMEI',
    es: 'Segundo IMEI',
  },
  storage: { fr: 'Stockage', de: 'Speicher', it: 'Memoria', uk: 'Пам’ять', es: 'Almacenamiento' },
  cpu: { fr: 'CPU', de: 'CPU', it: 'CPU', uk: 'CPU', es: 'CPU' },
  ram: { fr: 'RAM', de: 'RAM', it: 'RAM', uk: 'RAM', es: 'RAM' },
  licence_key: {
    fr: 'Clé de licence',
    de: 'Lizenzschlüssel',
    it: 'Chiave di licenza',
    uk: 'Ліцензійний ключ',
    es: 'Clave de licencia',
  },
  screen_size: {
    fr: 'Taille de l’écran',
    de: 'Bildschirmgröße',
    it: 'Dimensioni schermo',
    uk: 'Розмір екрана',
    es: 'Tamaño de pantalla',
  },
  wifi_password: {
    fr: 'Mot de passe Wi-Fi',
    de: 'Wi-Fi-Passwort',
    it: 'Password Wi-Fi',
    uk: 'Пароль Wi-Fi',
    es: 'Contraseña de Wi-Fi',
  },
  connector_a: {
    fr: 'Connecteur A',
    de: 'Stecker A',
    it: 'Connettore A',
    uk: 'Роз’єм A',
    es: 'Conector A',
  },
  connector_b: {
    fr: 'Connecteur B',
    de: 'Stecker B',
    it: 'Connettore B',
    uk: 'Роз’єм B',
    es: 'Conector B',
  },
  length: { fr: 'Longueur', de: 'Länge', it: 'Lunghezza', uk: 'Довжина', es: 'Longitud' },
  wattage: { fr: 'Puissance', de: 'Leistung', it: 'Potenza', uk: 'Потужність', es: 'Potencia' },
  connector: { fr: 'Connecteur', de: 'Stecker', it: 'Connettore', uk: 'Роз’єм', es: 'Conector' },
  voltage: { fr: 'Tension', de: 'Spannung', it: 'Tensione', uk: 'Напруга', es: 'Voltaje' },
  battery_platform: {
    fr: 'Système de batterie',
    de: 'Akkusystem',
    it: 'Piattaforma batteria',
    uk: 'Тип акумулятора',
    es: 'Sistema de batería',
  },
  combination: {
    fr: 'Combinaison',
    de: 'Kombination',
    it: 'Combinazione',
    uk: 'Комбінація',
    es: 'Combinación',
  },
  vin: { fr: 'VIN', de: 'VIN', it: 'VIN', uk: 'VIN', es: 'VIN' },
  plate: {
    fr: 'Plaque d’immatriculation',
    de: 'Kennzeichen',
    it: 'Targa',
    uk: 'Номерний знак',
    es: 'Matrícula',
  },
  frame_number: {
    fr: 'Numéro de cadre',
    de: 'Rahmennummer',
    it: 'Numero di telaio',
    uk: 'Номер рами',
    es: 'Número de cuadro',
  },
  appraisal_value: {
    fr: 'Valeur d’expertise',
    de: 'Schätzwert',
    it: 'Valore di stima',
    uk: 'Оціночна вартість',
    es: 'Valor de tasación',
  },
  appraisal_date: {
    fr: 'Date d’expertise',
    de: 'Datum der Schätzung',
    it: 'Data della stima',
    uk: 'Дата оцінки',
    es: 'Fecha de tasación',
  },
  edition: { fr: 'Édition', de: 'Ausgabe', it: 'Edizione', uk: 'Видання', es: 'Edición' },
  condition_grade: {
    fr: 'État de conservation',
    de: 'Erhaltungsgrad',
    it: 'Stato di conservazione',
    uk: 'Стан збереження',
    es: 'Estado de conservación',
  },
  provenance_notes: {
    fr: 'Notes sur la provenance',
    de: 'Notizen zur Herkunft',
    it: 'Note sulla provenienza',
    uk: 'Примітки про походження',
    es: 'Notas de procedencia',
  },
  size: { fr: 'Format', de: 'Größe', it: 'Formato', uk: 'Формат', es: 'Formato' },
  chemistry: {
    fr: 'Technologie',
    de: 'Zellchemie',
    it: 'Chimica',
    uk: 'Тип елемента',
    es: 'Química',
  },
  fits: {
    fr: 'Compatible avec',
    de: 'Passend für',
    it: 'Compatibile con',
    uk: 'Сумісний із',
    es: 'Compatible con',
  },
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
