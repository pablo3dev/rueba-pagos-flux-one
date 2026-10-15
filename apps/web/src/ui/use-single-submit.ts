import { useRef, useState } from 'react';

export function useSingleSubmit(): {
  pending: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
} {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);

  const run = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      await action();
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  return { pending, run };
}
