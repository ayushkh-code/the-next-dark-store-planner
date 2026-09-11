import { useVisitorCount } from '../hooks/useVisitorCount';

function formatCount(n: number): string {
  return n.toLocaleString('en-IN');
}

export function VisitorCount() {
  const state = useVisitorCount();

  const display =
    state.status === 'ready'
      ? formatCount(state.count)
      : state.status === 'loading'
        ? '—'
        : null;

  if (display === null) {
    return null;
  }

  return (
    <p className="visitor-count" aria-live="polite">
      <span className="visitor-count__value mono">{display}</span>
      <span className="visitor-count__label">visitors</span>
    </p>
  );
}
