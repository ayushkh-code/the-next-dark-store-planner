import { useEffect, useState } from 'react';

type VisitorCountState =
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'error' };

export function useVisitorCount(): VisitorCountState {
  const [state, setState] = useState<VisitorCountState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch('/api/visitors', { method: 'GET' });
        const data = (await res.json()) as { count?: number | null };

        if (cancelled) return;

        if (res.ok && typeof data.count === 'number') {
          setState({ status: 'ready', count: data.count });
        } else {
          setState({ status: 'error' });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error' });
        }
      }
    }

    void fetchCount();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
