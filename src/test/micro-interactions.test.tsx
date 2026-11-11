import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountUp } from '@/components/CountUp';
import { SwipeRow } from '@/components/SwipeRow';

describe('micro-interactions', () => {
  it('CountUp keeps prefix, suffix and shows the final value', async () => {
    render(<CountUp value="17%" duration={20} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(screen.getByText('17%')).toBeInTheDocument();
  });

  it('CountUp leaves non-numeric text alone', () => {
    render(<CountUp value="iSupport" />);
    expect(screen.getByText('iSupport')).toBeInTheDocument();
  });

  it('SwipeRow renders children untouched on mouse devices', () => {
    render(<SwipeRow onSwipeRight={() => {}}><p>Row</p></SwipeRow>);
    expect(screen.getByText('Row')).toBeInTheDocument();
  });
});
