import { type RefObject, useEffect } from 'react';
import { useLayout, useRequestSize } from 'skybridge/web';

/**
 * Keep the host informed of the referenced element's content height, so it can
 * size the widget to the view.
 *
 * Reports on mount and on every later size change, clamped to the ceiling the
 * host publishes. Whether the widget actually resizes is the host's decision;
 * one that ignores sizing discards the report.
 */
export function useAutoHeight(ref: RefObject<HTMLElement | null>) {
  const requestSize = useRequestSize();
  const { maxHeight } = useLayout();

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    let reported = 0;
    const report = () => {
      const contentHeight = target.scrollHeight;
      const height = Math.ceil(maxHeight != null ? Math.min(contentHeight, maxHeight) : contentHeight);
      if (height === reported) return;
      reported = height;
      // A host that refuses must not surface as a rejection. Forgetting the
      // height lets the next resize retry it rather than suppressing it.
      requestSize({ height }).catch(() => {
        reported = 0;
      });
    };

    const observer = new ResizeObserver(report);
    observer.observe(target);
    report();
    return () => observer.disconnect();
  }, [ref, requestSize, maxHeight]);
}
