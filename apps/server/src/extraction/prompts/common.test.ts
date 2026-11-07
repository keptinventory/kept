import { describe, expect, it } from 'vitest';
import { languageList } from './common.js';

describe('languageList()', () => {
  it('names every language Kept ships, and passes others as their code', () => {
    expect(languageList(['ar', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi', 'xx'])).toBe(
      'ar (Arabic), de (German), en (English), es (Spanish), fr (French), it (Italian), uk (Ukrainian), vi (Vietnamese), xx (xx)',
    );
  });
});
