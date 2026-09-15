import { describe, expect, it } from 'vitest';
import { cartSpecsFromRfqLines, heuristicMap, money, pdfExtractIsUsable } from '@/lib/rfq-quote-map';

describe('heuristicMap', () => {
  it('matches a cart line from a markdown table and picks a unit price', () => {
    const excerpt = `
TABLES:
| Description | Qty | Unit | MRP |
| --- | --- | --- | --- |
| Apple MacBook Pro 14 M3 16GB 512GB | 2 | 150000 | 180000 |
| Shipping | 1 | 500 | |
`;
    const cart = cartSpecsFromRfqLines([
      {
        id: 'dev-1',
        brand: 'Apple',
        device_model: 'MacBook Pro 14',
        processor: 'M3',
        ram: '16GB',
        storage: '512GB',
        quantity: 2,
      },
    ]);
    const mapped = heuristicMap(excerpt, cart);
    expect(mapped.line_items[0]?.id).toBe('dev-1');
    expect(mapped.line_items[0]?.unit_price).toBe(150000);
    expect(mapped.extras.some((e) => /ship/i.test(e.label))).toBe(true);
  });
});

describe('money', () => {
  it('parses Indian lakh grouping', () => {
    expect(money('1,21,500')).toBe(121500);
    expect(money('n1,11,500')).toBe(111500);
    expect(money(0)).toBe(null);
  });
});

describe('pdfExtractIsUsable', () => {
  it('rejects ReportLab binary scrape', () => {
    const junk = 'opensource anonymous ReportLab PDF Library endstream endobj xref trailer';
    expect(pdfExtractIsUsable(junk)).toBe(false);
  });
  it('accepts a real quotation excerpt', () => {
    expect(pdfExtractIsUsable(
      'PRODUCT QUOTATION Macintel Solutions India HP ProBook 440 G11 Offer Price INR Including GST ThinkPad E16 Total Offer Value devices warranty shipping delivery working days',
    )).toBe(true);
  });
});
