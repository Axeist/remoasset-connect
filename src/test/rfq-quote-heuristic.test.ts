import { describe, expect, it } from 'vitest';
import { cartSpecsFromRfqLines, heuristicMap } from '@/lib/rfq-quote-map';

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
