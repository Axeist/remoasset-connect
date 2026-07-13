import { describe, expect, it } from 'vitest';
import {
  computeBidPricing,
  isClosedStatusName,
  matchRfqVendors,
} from '@/lib/rfq';

describe('rfq matching', () => {
  it('recognizes closed statuses', () => {
    expect(isClosedStatusName('Closed Won')).toBe(true);
    expect(isClosedStatusName('Won')).toBe(true);
    expect(isClosedStatusName('Prospect')).toBe(false);
  });

  it('matches closed + country + types + email', () => {
    const vendors = [
      {
        id: '1',
        company_name: 'A',
        email: 'a@x.com',
        country_ids: ['c1'],
        vendor_types: ['new_device'],
        status_name: 'Closed Won',
      },
      {
        id: '2',
        company_name: 'B',
        email: 'b@x.com',
        country_ids: ['c1'],
        vendor_types: ['warehouse'],
        status_name: 'Closed Won',
      },
      {
        id: '3',
        company_name: 'C',
        email: null,
        country_ids: ['c1'],
        vendor_types: ['new_device'],
        status_name: 'Closed Won',
      },
    ];
    const matched = matchRfqVendors(vendors, 'c1', ['new_device']);
    expect(matched.map((m) => m.id)).toEqual(['1']);
  });
});

describe('computeBidPricing', () => {
  it('computes discount and landed', () => {
    const p = computeBidPricing({
      quotedPrice: 800,
      mrpPrice: 1000,
      shippingFee: 50,
      taxFee: 0,
      otherFees: 0,
    });
    expect(p.discount_pct).toBe(20);
    expect(p.discount_amount).toBe(200);
    expect(p.total_landed).toBe(850);
  });
});
