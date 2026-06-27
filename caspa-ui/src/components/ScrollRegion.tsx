import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScrollRegionProps {
  children: ReactNode;
  className?: string;
  hint?: string;
}

export function ScrollRegion({ children, className, hint = 'Scroll for more' }: ScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setCanScrollDown(maxScroll > 4 && el.scrollTop < maxScroll - 4);
    setCanScrollUp(el.scrollTop > 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, children]);

  return (
    <div className={cn('relative min-h-0 flex-1', className)}>
      {canScrollUp && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#fffaf0] via-[#fffaf0]/80 to-transparent"
          aria-hidden
        />
      )}
      <div ref={ref} onScroll={update} className="menu-scroll custom-scrollbar h-full overflow-y-auto overscroll-y-contain">
        {children}
      </div>
      {canScrollDown && (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-[#fffaf0] via-[#fffaf0]/90 to-transparent"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#caa044] bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#98711d] shadow-sm">
              {hint}
              <ChevronDown className="h-3 w-3 animate-bounce" />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
