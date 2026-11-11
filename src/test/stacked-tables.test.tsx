import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { labelStackedTables } from '@/components/StackedTables';

describe('stacked tables', () => {
  it('labels each cell with its column header and flags full-width rows', () => {
    const { container } = render(
      <Table mobileCards>
        <TableHeader><TableRow><TableHead /><TableHead>Company</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          <TableRow><TableCell>x</TableCell><TableCell>Acme</TableCell><TableCell>Won</TableCell></TableRow>
          <TableRow><TableCell colSpan={3}>Expanded details</TableCell></TableRow>
        </TableBody>
      </Table>,
    );
    labelStackedTables(container);
    const cells = container.querySelectorAll('tbody tr:first-child td');
    expect(cells[0].getAttribute('data-label')).toBe('');
    expect(cells[1].getAttribute('data-label')).toBe('Company');
    expect(cells[2].getAttribute('data-label')).toBe('Status');
    expect(container.querySelector('tbody tr:last-child td')?.hasAttribute('data-span')).toBe(true);
    expect(container.querySelector('table')?.classList.contains('rt-cards')).toBe(true);
  });
});
