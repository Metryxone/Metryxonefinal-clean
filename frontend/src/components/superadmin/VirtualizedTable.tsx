import React, { useRef, useState, useCallback, useMemo } from 'react';

// Lightweight, dependency-free row virtualization (windowing). Renders only the
// rows currently in (or near) the viewport, so a list of thousands of rows stays
// responsive. Header is sticky. Designed for fixed-height rows.
export interface VirtualizedTableProps<T> {
  items: T[];
  rowHeight: number;
  height?: number;              // viewport height in px (default 480)
  overscan?: number;           // extra rows above/below the window (default 8)
  header?: React.ReactNode;    // sticky header row
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  rowKey?: (item: T, index: number) => React.Key;
  'data-testid'?: string;
}

export function VirtualizedTable<T>({
  items,
  rowHeight,
  height = 480,
  overscan = 8,
  header,
  renderRow,
  emptyState,
  className = '',
  rowKey,
  ...rest
}: VirtualizedTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const total = items.length;
  const totalHeight = total * rowHeight;

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
    const end = Math.min(total, start + visibleCount);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, rowHeight, height, overscan, total]);

  const visible = items.slice(startIndex, endIndex);

  return (
    <div className={className} {...rest}>
      {header && (
        <div className="sticky top-0 z-10 bg-gray-50 border-b">{header}</div>
      )}
      {total === 0 ? (
        <div data-testid="virtualized-empty">{emptyState}</div>
      ) : (
        <div
          ref={viewportRef}
          onScroll={onScroll}
          style={{ height, overflowY: 'auto', position: 'relative' }}
          data-testid="virtualized-viewport"
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${startIndex * rowHeight}px)` }}>
              {visible.map((item, i) => {
                const index = startIndex + i;
                return (
                  <div
                    key={rowKey ? rowKey(item, index) : index}
                    style={{ height: rowHeight }}
                  >
                    {renderRow(item, index)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VirtualizedTable;
