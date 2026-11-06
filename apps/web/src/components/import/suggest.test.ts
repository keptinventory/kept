/**
 * The stepper's guesses: fields from headers in every language, Arabic included; a field
 * that takes one column goes to the first; the date format and the place separator from values.
 */
import { describe, expect, it } from 'vitest';
import {
  dateFormatsFor,
  fieldFromHeader,
  homeboxMapping,
  normaliseHeader,
  separatorFor,
  suggestMapping,
} from './suggest';

describe('fields from headers', () => {
  it('reads Arabic headers, with or without the article, hamza and tatweel', () => {
    expect(fieldFromHeader('الاسم')).toBe('name');
    expect(fieldFromHeader('اسم')).toBe('name');
    expect(fieldFromHeader('المكان')).toBe('place_path');
    expect(fieldFromHeader('الكميـــة')).toBe('quantity');
    expect(fieldFromHeader('تاريخ الشراء')).toBe('purchased_on');
    expect(fieldFromHeader('السعر')).toBe('price');
    expect(fieldFromHeader('رقم الأصل')).toBe('legacy_code');
    expect(fieldFromHeader('الماركة')).toBe('brand');
    expect(fieldFromHeader('ملاحظات')).toBe('notes');
  });

  it('reads English, French, German and Italian, ignoring case, accents and brackets', () => {
    expect(fieldFromHeader('Item Name')).toBe('name');
    expect(fieldFromHeader('Purchase Price (EGP)')).toBe('price');
    expect(fieldFromHeader('Désignation')).toBe('name');
    expect(fieldFromHeader('Numéro de série')).toBe('serial');
    expect(fieldFromHeader('Kaufdatum')).toBe('purchased_on');
    expect(fieldFromHeader('Händler')).toBe('vendor');
    expect(fieldFromHeader('Quantità')).toBe('quantity');
    expect(fieldFromHeader('Colore')).toBe('colour');
  });

  it.each([
    ['Producto', 'name'],
    ['Cantidad', 'quantity'],
    ['Marca', 'brand'],
    ['Modelo', 'model'],
    ['Número de serie', 'serial'],
    ['Código de barras', 'barcode'],
    ['Color', 'colour'],
    ['Estado', 'condition'],
    ['Notas', 'notes'],
    ['Descripción', 'notes'],
    ['Etiquetas', 'tags'],
    ['Ubicación', 'place_path'],
    ['Categoría', 'type'],
    ['Otros nombres', 'aliases'],
    ['Fecha de compra', 'purchased_on'],
    ['Tienda', 'vendor'],
    ['Precio', 'price'],
    ['Moneda', 'currency'],
    ['Código', 'legacy_code'],
    ['Mi código', 'own_code'],
    ['Назва', 'name'],
    ['Кількість', 'quantity'],
    ['Бренд', 'brand'],
    ['Модель', 'model'],
    ['Серійний номер', 'serial'],
    ['Штрихкод', 'barcode'],
    ['Колір', 'colour'],
    ['Стан', 'condition'],
    ['Нотатки', 'notes'],
    ['Теги', 'tags'],
    ['Локація', 'place_path'],
    ['Тип', 'type'],
    ['Інші назви', 'aliases'],
    ['Дата покупки', 'purchased_on'],
    ['Магазин', 'vendor'],
    ['Ціна', 'price'],
    ['Валюта', 'currency'],
    ['Інструкція', 'manual_url'],
    ['Код', 'legacy_code'],
    ['Мій код', 'own_code'],
    ['Tên', 'name'],
    ['Số lượng', 'quantity'],
    ['Thương hiệu', 'brand'],
    ['Số sê-ri', 'serial'],
    ['Mã vạch', 'barcode'],
    ['Màu sắc', 'colour'],
    ['Tình trạng', 'condition'],
    ['Ghi chú', 'notes'],
    ['Thẻ', 'tags'],
    ['Vị trí', 'place_path'],
    ['Loại', 'type'],
    ['Tên khác', 'aliases'],
    ['Ngày mua', 'purchased_on'],
    ['Cửa hàng', 'vendor'],
    ['Giá', 'price'],
    ['Tiền tệ', 'currency'],
    ['Sách hướng dẫn', 'manual_url'],
    ['Mã', 'legacy_code'],
    ['Mã của tôi', 'own_code'],
    ['so luong', 'quantity'], // typed without its marks
    ['Nº de serie', 'serial'],
    ['N° de série', 'serial'],
    ['Серійний №', 'serial'],
    ['Дата придбання', 'purchased_on'],
    ['Mô hình', 'model'],
    ['Produit', 'name'],
    ['Libellé', 'name'],
    ['Intitulé', 'name'],
    ['Artículo', 'name'],
    ['Producto', 'name'],
  ])('reads %s as %s', (header, field) => {
    expect(fieldFromHeader(header)).toBe(field);
  });

  it.each(['The', 'Ten', 'TEN', 'Hang', 'MA', 'Ma', 'Hàng', 'Tèn'])(
    "doesn't take %s for a Vietnamese word it only looks like without its marks",
    (header) => {
      expect(fieldFromHeader(header)).toBeNull();
    },
  );

  it.each([
    ['Thẻ', 'tags'],
    ['THẺ', 'tags'],
    ['Thẻ'.normalize('NFD'), 'tags'],
    ['Tên', 'name'],
    ['Tên (máy)', 'name'],
    ['Hãng', 'brand'],
    ['Mã', 'legacy_code'],
    ['Mã:', 'legacy_code'],
  ])('still reads %s with its marks', (header, field) => {
    expect(fieldFromHeader(header)).toBe(field);
  });

  it('reads Nombre as the name in a Spanish sheet, and as how many in a French one', () => {
    expect(suggestMapping(['Nombre', 'Cantidad', 'Precio'])).toEqual({
      Nombre: 'name',
      Cantidad: 'quantity',
      Precio: 'price',
    });
    expect(suggestMapping(['Désignation', 'Nombre', 'Prix'])).toEqual({
      Désignation: 'name',
      Nombre: 'quantity',
      Prix: 'price',
    });
    expect(suggestMapping(['Produit', 'Nombre', 'Prix'])).toEqual({
      Produit: 'name',
      Nombre: 'quantity',
      Prix: 'price',
    });
    expect(suggestMapping(['Libellé', 'Nombre'])).toEqual({ Libellé: 'name', Nombre: 'quantity' });
  });

  it('takes Nombre as the name once another column says how many', () => {
    expect(suggestMapping(['Nombre', 'Artículo', 'Cantidad'])).toEqual({
      Nombre: 'name',
      Artículo: 'ignore',
      Cantidad: 'quantity',
    });
    expect(suggestMapping(['Nom', 'Nombre', 'Quantité'])).toEqual({
      Nom: 'name',
      Nombre: 'ignore',
      Quantité: 'quantity',
    });
  });

  it('takes Nombre alone as the name', () => {
    expect(suggestMapping(['Nombre', 'Precio'])).toEqual({ Nombre: 'name', Precio: 'price' });
    expect(suggestMapping(['Nombre'])).toEqual({ Nombre: 'name' });
  });

  it("looks past a Homebox export's HB. prefix", () => {
    expect(fieldFromHeader('HB.name')).toBe('name');
    expect(fieldFromHeader('HB.location')).toBe('place_path');
    expect(fieldFromHeader('HB.labels')).toBe('tags');
    expect(fieldFromHeader('HB.asset_id')).toBe('legacy_code');
    expect(fieldFromHeader('HB.import_ref')).toBe('source_id');
    expect(fieldFromHeader('HB.purchase_from')).toBe('vendor');
  });

  it("leaves a header it doesn't know alone", () => {
    expect(fieldFromHeader('Wattage')).toBeNull();
    expect(normaliseHeader('  Serial   No. ')).toBe('serial no');
  });

  it('maps a single-valued field once, and a list field from every column that names it', () => {
    expect(suggestMapping(['الاسم', 'Name', 'Notes', 'Comments', 'المكان', 'Wattage'])).toEqual({
      الاسم: 'name',
      Name: 'ignore',
      Notes: 'notes',
      Comments: 'notes',
      المكان: 'place_path',
      Wattage: 'ignore',
    });
  });
});

describe('values', () => {
  it('finds the date format the dates read in, and says when it is ambiguous', () => {
    expect(dateFormatsFor(['31/12/2024', '١٢/٠٣/٢٠٢٤'])).toEqual(['DD/MM/YYYY']);
    expect(dateFormatsFor(['12/31/2024'])).toEqual(['MM/DD/YYYY']);
    expect(dateFormatsFor(['2024-03-12', ''])).toEqual(['YYYY-MM-DD']);
    expect(dateFormatsFor(['03/04/2024'])).toEqual(['DD/MM/YYYY', 'MM/DD/YYYY']);
    expect(dateFormatsFor(['soon'])).toEqual([]);
  });

  it('picks the separator the place paths use most', () => {
    expect(separatorFor(['Garage / Shelf A', 'Kitchen/Drawer'])).toBe('/');
    expect(separatorFor(['المطبخ > الرف'])).toBe('>');
    expect(separatorFor(['Garage'])).toBe('>');
  });
});

describe("a Homebox spreadsheet's mapping", () => {
  it('maps every column Homebox writes, from v0.10.3 to v0.27.0, and leaves the preset its own', () => {
    const columns = [
      'HB.import_ref',
      'HB.parent_import_ref',
      'HB.url',
      'HB.location',
      'HB.labels',
      'HB.tags',
      'HB.asset_id',
      'HB.archived',
      'HB.name',
      'HB.quantity',
      'HB.description',
      'HB.insured',
      'HB.notes',
      'HB.purchase_price',
      'HB.purchase_from',
      'HB.purchase_time',
      'HB.purchase_date',
      'HB.manufacturer',
      'HB.model_number',
      'HB.serial_number',
      'HB.lifetime_warranty',
      'HB.warranty_expires',
      'HB.warranty_details',
      'HB.sold_to',
      'HB.sold_price',
      'HB.sold_time',
      'HB.sold_date',
      'HB.sold_notes',
      'HB.field.Colour',
    ];
    expect(homeboxMapping(columns)).toEqual({
      'HB.import_ref': 'source_id',
      'HB.parent_import_ref': 'ignore',
      'HB.url': 'ignore',
      'HB.location': 'place_path',
      'HB.labels': 'tags',
      'HB.tags': 'tags',
      'HB.asset_id': 'ignore',
      'HB.archived': 'ignore',
      'HB.name': 'name',
      'HB.quantity': 'quantity',
      'HB.description': 'notes',
      'HB.insured': 'ignore',
      'HB.notes': 'notes',
      'HB.purchase_price': 'price',
      'HB.purchase_from': 'vendor',
      'HB.purchase_time': 'purchased_on',
      'HB.purchase_date': 'purchased_on',
      'HB.manufacturer': 'brand',
      'HB.model_number': 'model',
      'HB.serial_number': 'serial',
      'HB.lifetime_warranty': 'ignore',
      'HB.warranty_expires': 'ignore',
      'HB.warranty_details': 'ignore',
      'HB.sold_to': 'ignore',
      'HB.sold_price': 'ignore',
      'HB.sold_time': 'ignore',
      'HB.sold_date': 'ignore',
      'HB.sold_notes': 'ignore',
      'HB.field.Colour': 'ignore',
    });
  });
});
