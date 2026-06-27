import { useEffect, useRef, useState } from 'react';

/** Honest stage advancement for long local AI runs — no fake percentages. */
export function useStagedProgress(
  stages: string[],
  pending: boolean,
  advanceEveryMs = 12_000,
) {
  const [activeStage, setActiveStage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!pending) {
      setActiveStage(0);
      setElapsedSeconds(0);
      startedAt.current = null;
      return undefined;
    }

    startedAt.current = Date.now();
    const tick = window.setInterval(() => {
      if (startedAt.current) {
        setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 1000);

    const advance = window.setInterval(() => {
      setActiveStage((current) => Math.min(current + 1, stages.length - 1));
    }, advanceEveryMs);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(advance);
    };
  }, [pending, stages.length, advanceEveryMs]);

  return { activeStage, elapsedSeconds };
}
