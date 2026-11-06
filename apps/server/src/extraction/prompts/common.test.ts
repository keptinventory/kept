import { describe, expect, it } from 'vitest';
import { languageList } from './common.js';

describe('languageList()', () => {
  it('names every language Kept ships, and passes others as their code', () => {
    expect(languageList(['en', 'ar', 'fr', 'de', 'it', 'vi', 'uk', 'es', 'xx'])).toBe(
      'en (English), ar (Arabic), fr (French), de (German), it (Italian), vi (Vietnamese), uk (Ukrainian), es (Spanish), xx (xx)',
    );
  });
});
