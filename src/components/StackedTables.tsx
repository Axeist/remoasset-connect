import { useEffect } from 'react';

/**
 * Phone layout for list tables: any <table class="rt-cards"> turns into a stack of cards below 768px (see index.css).
 * This labels each cell with its column header so the card can show "Status: Qualified" style rows.
 * The DOM, click handlers and keyboard behaviour are untouched; it only adds data-label attributes.
 */
export function labelStackedTables(root: ParentNode = document) {
  root.querySelectorAll<HTMLTableElement>('table.rt-cards').forEach((table) => {
    const heads = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').replace(/\s+/g, ' ').trim());
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        if (!(cell instanceof HTMLElement)) return;
        if (cell.hasAttribute('colspan') && Number(cell.getAttribute('colspan')) > 1) {
          cell.setAttribute('data-span', '1');
          return;
        }
        const label = heads[i] ?? '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      });
    });
  });
}

export function StackedTables() {
  useEffect(() => {
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => labelStackedTables());
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
