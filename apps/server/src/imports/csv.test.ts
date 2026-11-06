import { describe, expect, it } from 'vitest';
import { numberCell, parseBoolean, parsePrice, parseQuantity } from './csv.js';

// A comma is a decimal mark or a thousands mark, and a sheet from Spain, France or Germany writes
// the first. Reading `2,5` as 25 is silent, so the rule is tested here cell by cell.

describe('parseQuantity', () => {
  it.each([
    ['2,5', 2.5],
    ['0,5', 0.5],
    ['1,5', 1.5],
    ['12,50', 12.5],
    ['0,125', 0.125],
    ['1.234,5', 1234.5],
    ['1 234,5', 1234.5],
  ])('reads the comma in %s as a decimal mark', (cell, expected) => {
    expect(parseQuantity(cell)).toBe(expected);
  });

  it.each([
    ['1,234', 1234],
    ['1,234,567', 1234567],
    ['1,234.5', 1234.5],
    ['3', 3],
    ['2.5', 2.5],
  ])('keeps %s as it was', (cell, expected) => {
    expect(parseQuantity(cell)).toBe(expected);
  });

  it.each([
    ['٣٤٥', 345],
    ['٢٫٥', 2.5],
    ['١٬٢٣٤', 1234],
    ['١٬٢٣٤٫٥', 1234.5],
  ])('keeps the Arabic marks in %s', (cell, expected) => {
    expect(parseQuantity(cell)).toBe(expected);
  });

  it('refuses more decimals than a quantity holds', () => {
    expect(parseQuantity('0,1234')).toBeNull();
  });
});

describe('a number custom field', () => {
  it.each([
    ['2,5', 2.5],
    ['-2,5', -2.5],
    ['0,125', 0.125],
    ['1.234,5', 1234.5],
    ['1,234', 1234],
    ['1,234,567', 1234567],
    ['1,234.5', 1234.5],
    ['-3', -3],
    ['٢٫٥', 2.5],
    ['١٬٢٣٤', 1234],
  ])('reads %s', (cell, expected) => {
    expect(numberCell(cell)).toBe(expected);
  });

  it('is undefined for what is not a number', () => {
    expect(numberCell('a few')).toBeUndefined();
  });
});

describe('parsePrice', () => {
  it.each([
    ['12,50', '12.5'],
    ['1.234,50', '1234.5'],
    ['1 234,50', '1234.5'],
    ['1,234', '1234'],
    ['1,234.50', '1234.5'],
  ])('reads %s', (cell, expected) => {
    expect(parsePrice(cell)).toBe(expected);
  });
});

describe('parseBoolean', () => {
  it.each(['sí', 'SÍ', 'так', 'Так', 'có', 'Có'])('reads %s as yes', (cell) => {
    expect(parseBoolean(cell)).toBe(true);
  });

  it.each(['ні', 'Ні', 'không', 'Không'])('reads %s as no', (cell) => {
    expect(parseBoolean(cell)).toBe(false);
  });
});
