'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TextOverlayBox } from './TextOverlayBox';
import { OverlayToolbar } from './OverlayToolbar';
import type {
  TextOverlay,
  TextOverlayStyle,
  TextOverlayAlignment,
} from '@/lib/text-overlay-utils';
import {
  getTouchDistance,
  normalizePosition,
  clampPosition,
  clampFontSize,
} from '@/lib/text-overlay-utils';

interface TextOverlayEditorProps {
  imageUrl: string;
  imageOffsetY: number;
  textOverlays: TextOverlay[];
  onSave: (overlays: TextOverlay[]) => void;
  onCancel: () => void;
}

interface DragState {
  overlayId: string;
  startX: number;
  startY: number;
  overlayStartX: number;
  overlayStartY: number;
}

interface PinchState {
  overlayId: string;
  initialDistance: number;
  initialFontSize: number;
}

export function TextOverlayEditor({
  imageUrl,
  imageOffsetY,
  textOverlays: initialOverlays,
  onSave,
  onCancel,
}: TextOverlayEditorProps) {
  // Local state for editing
  const [overlays, setOverlays] = useState<TextOverlay[]>(initialOverlays);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Container ref for dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Touch state
  const dragStateRef = useRef<DragState | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Get selected overlay
  const selectedOverlay = overlays.find((o) => o.id === selectedId);

  // Handle alignment change
  const handleAlignmentChange = useCallback(
    (alignment: TextOverlayAlignment) => {
      if (!selectedId) return;
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedId ? { ...o, alignment } : o))
      );
    },
    [selectedId]
  );

  // Handle style change
  const handleStyleChange = useCallback(
    (style: TextOverlayStyle) => {
      if (!selectedId) return;
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedId ? { ...o, style } : o))
      );
    },
    [selectedId]
  );

  // Handle max width change
  const handleMaxWidthChange = useCallback(
    (maxWidth: number) => {
      if (!selectedId) return;
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedId ? { ...o, maxWidth } : o))
      );
    },
    [selectedId]
  );

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        // Single touch - start drag
        const touch = e.touches[0];

        // Find which overlay was touched (if any)
        const target = e.target as HTMLElement;
        const overlayElement = target.closest('[data-overlay-id]');

        if (overlayElement) {
          const overlayId = overlayElement.getAttribute('data-overlay-id');
          if (overlayId) {
            const overlay = overlays.find((o) => o.id === overlayId);
            if (overlay) {
              setSelectedId(overlayId);
              dragStateRef.current = {
                overlayId,
                startX: touch.clientX,
                startY: touch.clientY,
                overlayStartX: overlay.x,
                overlayStartY: overlay.y,
              };
            }
          }
        } else {
          // Touched outside overlays - deselect
          setSelectedId(null);
        }
      } else if (e.touches.length === 2 && selectedId) {
        // Two-finger touch - start pinch
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = getTouchDistance(touch1, touch2);
        const overlay = overlays.find((o) => o.id === selectedId);

        if (overlay) {
          // Stop drag if active
          dragStateRef.current = null;

          pinchStateRef.current = {
            overlayId: selectedId,
            initialDistance: distance,
            initialFontSize: overlay.fontSize,
          };
        }
      }
    },
    [overlays, selectedId]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && dragStateRef.current) {
        // Single touch drag
        const touch = e.touches[0];
        const drag = dragStateRef.current;

        const deltaX = touch.clientX - drag.startX;
        const deltaY = touch.clientY - drag.startY;

        // Convert pixel delta to normalized coordinates
        const normalizedDeltaX = deltaX / containerSize.width;
        const normalizedDeltaY = deltaY / containerSize.height;

        // Calculate new position
        const newX = drag.overlayStartX + normalizedDeltaX;
        const newY = drag.overlayStartY + normalizedDeltaY;

        // Clamp to safe bounds
        const clamped = clampPosition(newX, newY);

        setOverlays((prev) =>
          prev.map((o) =>
            o.id === drag.overlayId ? { ...o, x: clamped.x, y: clamped.y } : o
          )
        );
      } else if (e.touches.length === 2 && pinchStateRef.current) {
        // Two-finger pinch resize
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = getTouchDistance(touch1, touch2);
        const pinch = pinchStateRef.current;

        // Calculate scale
        const scale = currentDistance / pinch.initialDistance;
        const newFontSize = clampFontSize(pinch.initialFontSize * scale);

        setOverlays((prev) =>
          prev.map((o) =>
            o.id === pinch.overlayId ? { ...o, fontSize: newFontSize } : o
          )
        );
      }
    },
    [containerSize]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    dragStateRef.current = null;
    pinchStateRef.current = null;
  }, []);

  // Calculate object position for background image
  const getObjectPosition = () => {
    const yPercent = imageOffsetY * 100;
    return `50% ${yPercent}%`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{
        touchAction: 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-center border-b border-white/10 bg-black/50 p-4"
        style={{
          paddingTop: `calc(1rem + var(--safe-area-inset-top))`,
        }}
      >
        <h2 className="text-lg font-semibold text-white">Edit Text</h2>
      </div>

      {/* Canvas area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4 pb-48">
        <div
          ref={containerRef}
          className="relative w-full max-w-md overflow-hidden rounded-lg"
          style={{
            aspectRatio: '3/4',
            maxHeight: 'calc(100vh - 300px)',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Background image */}
          <img
            src={imageUrl}
            alt="Slide background"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: getObjectPosition(),
            }}
            draggable={false}
          />

          {/* Text overlays */}
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              data-overlay-id={overlay.id}
              className="absolute inset-0"
            >
              <TextOverlayBox
                overlay={overlay}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                isSelected={overlay.id === selectedId}
                isEditing={true}
                onSelect={() => setSelectedId(overlay.id)}
              />
            </div>
          ))}

          {/* Instructions overlay (shown briefly) */}
          {overlays.length > 0 && !selectedId && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4">
              <div className="rounded-lg bg-black/70 px-4 py-2 text-center text-sm text-white">
                <p>Tap to select, drag to move</p>
                <p className="text-white/60">Pinch to resize</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <OverlayToolbar
        selectedOverlayId={selectedId}
        currentAlignment={selectedOverlay?.alignment ?? 'center'}
        currentStyle={selectedOverlay?.style ?? 'pill'}
        currentMaxWidth={selectedOverlay?.maxWidth ?? 0.6}
        onAlignmentChange={handleAlignmentChange}
        onStyleChange={handleStyleChange}
        onMaxWidthChange={handleMaxWidthChange}
        onDone={() => onSave(overlays)}
        onCancel={onCancel}
      />
    </div>
  );
}
