'use client';

import { forwardRef, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { TextOverlay } from '@/lib/text-overlay-utils';
import { scaleFont, denormalizePosition, normalizePosition, clampPosition } from '@/lib/text-overlay-utils';
import {
  calculatePillLines,
  generatePillPath,
  generateNotchFills,
  getTotalHeight,
  getDefaultPillConfig,
  getPillHeight,
} from '@/lib/text-pill-renderer';

interface TextOverlayBoxProps {
  overlay: TextOverlay;
  containerWidth: number;
  containerHeight: number;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onChange?: (updates: Partial<TextOverlay>) => void;
}

type DragState = {
  isDragging: boolean;
  startX: number;
  startY: number;
  startOverlayY: number;
};

type ResizeState = {
  isResizing: boolean;
  startX: number;
  startMaxWidth: number;
  side: 'left' | 'right';
};

/**
 * Renders a single text overlay with the chosen style.
 * Supports drag-to-reposition and resize handles when selected.
 * Pill style uses SVG for precise text wrapping and backgrounds.
 */
export const TextOverlayBox = forwardRef<HTMLDivElement, TextOverlayBoxProps>(
  function TextOverlayBox(
    {
      overlay,
      containerWidth,
      containerHeight,
      isSelected = false,
      isEditing = false,
      onSelect,
      onChange,
    },
    ref
  ) {
    const { text, x, y, fontSize, alignment, style, maxWidth } = overlay;
    const internalRef = useRef<HTMLDivElement>(null);
    const combinedRef = (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    // Drag state
    const [dragState, setDragState] = useState<DragState>({
      isDragging: false,
      startX: 0,
      startY: 0,
      startOverlayY: 0,
    });

    // Resize state
    const [resizeState, setResizeState] = useState<ResizeState>({
      isResizing: false,
      startX: 0,
      startMaxWidth: 0,
      side: 'right',
    });

    // Scale font size based on container width
    const scaledFontSize = scaleFont(fontSize, containerWidth);

    // Calculate position
    const position = denormalizePosition(x, y, containerWidth, containerHeight);

    // Calculate margin
    const margin = containerWidth * 0.05;
    const innerWidth = containerWidth - margin * 2;

    const isPill = style === 'pill';

    // Calculate pill layout with overlay's maxWidth setting
    const pillConfig = useMemo(
      () => getDefaultPillConfig(scaledFontSize, innerWidth, alignment, maxWidth),
      [scaledFontSize, innerWidth, alignment, maxWidth]
    );

    const pillLines = useMemo(
      () => (isPill ? calculatePillLines(text, pillConfig, innerWidth) : []),
      [isPill, text, pillConfig, innerWidth]
    );

    const pillPath = useMemo(
      () => (isPill ? generatePillPath(pillLines, pillConfig) : ''),
      [isPill, pillLines, pillConfig]
    );

    const notchPath = useMemo(
      () => (isPill ? generateNotchFills(pillLines, pillConfig) : ''),
      [isPill, pillLines, pillConfig]
    );

    const totalHeight = useMemo(
      () => (isPill ? getTotalHeight(pillLines, pillConfig) : 0),
      [isPill, pillLines, pillConfig]
    );

    // Use ref for onChange to avoid stale closure in event listeners
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Drag handlers
    const handleDragStart = useCallback(
      (clientX: number, clientY: number) => {
        if (!isSelected || !onChangeRef.current) return;
        setDragState({
          isDragging: true,
          startX: clientX,
          startY: clientY,
          startOverlayY: y,
        });
      },
      [isSelected, y]
    );

    const handleDragMove = useCallback(
      (clientY: number) => {
        if (!dragState.isDragging || !onChangeRef.current) return;
        const deltaY = clientY - dragState.startY;
        const normalizedDeltaY = deltaY / containerHeight;
        const newY = clampPosition(x, dragState.startOverlayY + normalizedDeltaY).y;
        onChangeRef.current({ y: newY });
      },
      [dragState.isDragging, dragState.startY, dragState.startOverlayY, containerHeight, x]
    );

    const handleDragEnd = useCallback(() => {
      setDragState((prev) => ({ ...prev, isDragging: false }));
    }, []);

    // Resize handlers
    const handleResizeStart = useCallback(
      (clientX: number, side: 'left' | 'right') => {
        if (!isSelected || !onChangeRef.current) return;
        setResizeState({
          isResizing: true,
          startX: clientX,
          startMaxWidth: maxWidth,
          side,
        });
      },
      [isSelected, maxWidth]
    );

    const handleResizeMove = useCallback(
      (clientX: number) => {
        if (!resizeState.isResizing || !onChangeRef.current) return;
        const deltaX = clientX - resizeState.startX;
        // For symmetric resizing, multiply by 2 since we resize from both sides
        const normalizedDeltaX = (deltaX / innerWidth) * 2;
        const multiplier = resizeState.side === 'right' ? 1 : -1;
        const newMaxWidth = Math.max(0.3, Math.min(0.95, resizeState.startMaxWidth + normalizedDeltaX * multiplier));
        onChangeRef.current({ maxWidth: newMaxWidth });
      },
      [resizeState.isResizing, resizeState.startX, resizeState.startMaxWidth, resizeState.side, innerWidth]
    );

    const handleResizeEnd = useCallback(() => {
      setResizeState((prev) => ({ ...prev, isResizing: false }));
    }, []);

    // Mouse event handlers
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!isSelected || !onChangeRef.current) {
          if (onSelect) {
            e.stopPropagation();
            onSelect();
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleDragStart(e.clientX, e.clientY);
      },
      [isSelected, onSelect, handleDragStart]
    );

    const handleResizeMouseDown = useCallback(
      (e: React.MouseEvent, side: 'left' | 'right') => {
        e.preventDefault();
        e.stopPropagation();
        handleResizeStart(e.clientX, side);
      },
      [handleResizeStart]
    );

    // Touch event handlers
    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (!isSelected || !onChangeRef.current) {
          if (onSelect) {
            e.stopPropagation();
            onSelect();
          }
          return;
        }
        if (e.touches.length === 1) {
          e.stopPropagation();
          const touch = e.touches[0];
          handleDragStart(touch.clientX, touch.clientY);
        }
      },
      [isSelected, onSelect, handleDragStart]
    );

    const handleResizeTouchStart = useCallback(
      (e: React.TouchEvent, side: 'left' | 'right') => {
        e.stopPropagation();
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          handleResizeStart(touch.clientX, side);
        }
      },
      [handleResizeStart]
    );

    // Global mouse/touch move and end handlers
    useEffect(() => {
      if (!dragState.isDragging && !resizeState.isResizing) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (dragState.isDragging) {
          handleDragMove(e.clientY);
        } else if (resizeState.isResizing) {
          handleResizeMove(e.clientX);
        }
      };

      const handleMouseUp = () => {
        handleDragEnd();
        handleResizeEnd();
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          if (dragState.isDragging) {
            handleDragMove(touch.clientY);
          } else if (resizeState.isResizing) {
            handleResizeMove(touch.clientX);
          }
        }
      };

      const handleTouchEnd = () => {
        handleDragEnd();
        handleResizeEnd();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }, [
      dragState.isDragging,
      resizeState.isResizing,
      handleDragMove,
      handleDragEnd,
      handleResizeMove,
      handleResizeEnd,
    ]);

    // Resize handle component
    const ResizeHandle = ({ side }: { side: 'left' | 'right' }) => (
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-12 bg-blue-500 rounded-full cursor-ew-resize hover:bg-blue-600 active:bg-blue-700 transition-colors z-10 flex items-center justify-center"
        style={{
          [side]: -8,
        }}
        onMouseDown={(e) => handleResizeMouseDown(e, side)}
        onTouchStart={(e) => handleResizeTouchStart(e, side)}
      >
        <div className="w-0.5 h-6 bg-white/60 rounded-full" />
      </div>
    );

    if (isPill) {
      const { paddingX, paddingY, lineHeight } = pillConfig;

      return (
        <div
          ref={combinedRef}
          className="absolute select-none"
          style={{
            left: margin,
            top: position.y,
            width: innerWidth,
            height: totalHeight,
            transform: `translateY(-50%)`,
            touchAction: isSelected && onChange ? 'none' : 'auto',
            cursor: isSelected && onChange ? (dragState.isDragging ? 'grabbing' : 'grab') : 'pointer',
          }}
          onClick={(e) => {
            if (!isSelected && onSelect) {
              e.stopPropagation();
              onSelect();
            }
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Selection indicator with resize handles */}
          {isSelected && onChange && (
            <>
              <div
                className="pointer-events-none absolute -inset-2 rounded-lg border-2 border-blue-500 bg-blue-500/10"
                style={{ zIndex: -1 }}
              />
              <ResizeHandle side="left" />
              <ResizeHandle side="right" />
            </>
          )}

          {/* SVG background */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={innerWidth}
            height={totalHeight}
            style={{ overflow: 'visible' }}
          >
            <path d={pillPath} fill="#ffffff" />
            {notchPath && <path d={notchPath} fill="#ffffff" />}
          </svg>

          {/* Text lines */}
          {pillLines.map((line, index) => (
            <span
              key={index}
              className="absolute pointer-events-none"
              style={{
                left: line.x + paddingX,
                top: line.y + paddingY,
                fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                fontWeight: 600,
                fontSize: scaledFontSize,
                color: '#000000',
                lineHeight: lineHeight,
                whiteSpace: 'pre',
              }}
            >
              {line.text || '\u00A0'}
            </span>
          ))}
        </div>
      );
    }

    // Outline style
    return (
      <div
        ref={combinedRef}
        className="absolute select-none"
        style={{
          left: margin,
          top: position.y,
          width: innerWidth,
          transform: `translateY(-50%)`,
          textAlign: alignment,
          touchAction: isSelected && onChange ? 'none' : 'auto',
          cursor: isSelected && onChange ? (dragState.isDragging ? 'grabbing' : 'grab') : 'pointer',
        }}
        onClick={(e) => {
          if (!isSelected && onSelect) {
            e.stopPropagation();
            onSelect();
          }
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Selection indicator with resize handles */}
        {isSelected && onChange && (
          <>
            <div
              className="pointer-events-none absolute -inset-2 rounded-lg border-2 border-blue-500 bg-blue-500/10"
              style={{ zIndex: -1 }}
            />
            <ResizeHandle side="left" />
            <ResizeHandle side="right" />
          </>
        )}
        <span
          className="text-overlay-outline whitespace-pre-wrap pointer-events-none"
          style={{ fontSize: scaledFontSize }}
        >
          {text}
        </span>
      </div>
    );
  }
);

/**
 * Standalone render component for export.
 * This renders the text overlay without selection/editing features.
 */
export function TextOverlayRender({
  overlay,
  containerWidth,
  containerHeight,
}: {
  overlay: TextOverlay;
  containerWidth: number;
  containerHeight: number;
}) {
  const { text, x, y, fontSize, alignment, style, maxWidth } = overlay;

  // Scale font size based on container width
  const scaledFontSize = scaleFont(fontSize, containerWidth);

  // Calculate position
  const position = denormalizePosition(x, y, containerWidth, containerHeight);

  // Calculate margin
  const margin = containerWidth * 0.05;
  const innerWidth = containerWidth - margin * 2;

  const isPill = style === 'pill';

  if (isPill) {
    const pillConfig = getDefaultPillConfig(scaledFontSize, innerWidth, alignment, maxWidth);
    const pillLines = calculatePillLines(text, pillConfig, innerWidth);
    const pillPath = generatePillPath(pillLines, pillConfig);
    const notchPath = generateNotchFills(pillLines, pillConfig);
    const totalHeight = getTotalHeight(pillLines, pillConfig);
    const { paddingX, paddingY, lineHeight } = pillConfig;

    return (
      <div
        className="absolute"
        style={{
          left: margin,
          top: position.y,
          width: innerWidth,
          height: totalHeight,
          transform: `translateY(-50%)`,
        }}
      >
        {/* SVG background */}
        <svg
          className="absolute inset-0"
          width={innerWidth}
          height={totalHeight}
          style={{ overflow: 'visible' }}
        >
          <path d={pillPath} fill="#ffffff" />
          {notchPath && <path d={notchPath} fill="#ffffff" />}
        </svg>

        {/* Text lines */}
        {pillLines.map((line, index) => (
          <span
            key={index}
            className="absolute"
            style={{
              left: line.x + paddingX,
              top: line.y + paddingY,
              fontFamily: 'var(--font-poppins), Poppins, sans-serif',
              fontWeight: 600,
              fontSize: scaledFontSize,
              color: '#000000',
              lineHeight: lineHeight,
              whiteSpace: 'pre',
            }}
          >
            {line.text || '\u00A0'}
          </span>
        ))}
      </div>
    );
  }

  // Outline style
  return (
    <div
      className="absolute"
      style={{
        left: margin,
        top: position.y,
        width: innerWidth,
        transform: `translateY(-50%)`,
        textAlign: alignment,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-poppins), Poppins, sans-serif',
          fontWeight: 700,
          fontSize: scaledFontSize,
          color: '#ffffff',
          lineHeight: 1.6,
          textShadow: `-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000`,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}
