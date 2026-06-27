import { useEffect } from 'react';

export function useEscapeKey(enabled: boolean, onClose: () => void) {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onClose]);
}

export function useBodyScrollLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev;
    };
  }, [enabled]);
}
