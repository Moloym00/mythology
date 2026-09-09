'use client';
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ELEMENTS, type Element } from '@/lib/game/engine';

export function MemoryCard({
  id,
  element,
  description,
  selected,
  index,
  count,
  onSelect,
  onLift,
  onOffer,
}: {
  id: number;
  element: Element;
  description: string;
  selected: boolean;
  index: number;
  count: number;
  onSelect: () => void;
  onLift: () => void;
  onOffer: (card: number, seat: number) => void;
}) {
  const gesture = useRef<{ x: number; y: number; dragged: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const angle = Math.max(-5, Math.min(5, (index - (count - 1) / 2) * 2));
  return (
    <button
      type="button"
      className={`memory tactile-card e-${ELEMENTS.indexOf(element)} ${selected ? 'selected' : ''} ${offset ? 'in-hand' : ''}`}
      style={
        {
          '--fan': `${angle}deg`,
          ...(offset
            ? {
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 35}deg)`,
              }
            : {}),
        } as CSSProperties
      }
      aria-pressed={selected}
      aria-label={`${element} · ${description}${selected ? ' · 已选中' : ''}`}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        suppressClick.current = false;
        gesture.current = { x: e.clientX, y: e.clientY, dragged: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = gesture.current;
        if (!start) return;
        const x = e.clientX - start.x,
          y = e.clientY - start.y;
        if (!start.dragged && Math.hypot(x, y) > 7) {
          start.dragged = true;
          onLift();
        }
        if (start.dragged) setOffset({ x, y });
      }}
      onPointerUp={(e) => {
        const start = gesture.current;
        gesture.current = null;
        setOffset(null);
        if (start?.dragged) {
          suppressClick.current = true;
          const seat = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('[data-seat-index]')
            ?.getAttribute('data-seat-index');
          if (seat !== null && seat !== undefined) onOffer(id, Number(seat));
        }
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setOffset(null);
        suppressClick.current = false;
      }}
      onLostPointerCapture={() => {
        gesture.current = null;
        setOffset(null);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !gesture.current) return;
        gesture.current = null;
        setOffset(null);
        suppressClick.current = true;
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect();
      }}
    >
      <span className="card-corner" aria-hidden="true">
        {element}
      </span>
      <span className="card-sigil">{element}</span>
      <small>{description}</small>
      <span className="card-corner bottom" aria-hidden="true">
        {element}
      </span>
    </button>
  );
}
