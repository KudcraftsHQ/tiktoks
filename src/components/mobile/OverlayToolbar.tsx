'use client';

import { AlignLeft, AlignCenter, AlignRight, Type, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { TextOverlayStyle, TextOverlayAlignment } from '@/lib/text-overlay-utils';

interface OverlayToolbarProps {
  selectedOverlayId: string | null;
  currentAlignment: TextOverlayAlignment;
  currentStyle: TextOverlayStyle;
  currentMaxWidth: number;
  onAlignmentChange: (alignment: TextOverlayAlignment) => void;
  onStyleChange: (style: TextOverlayStyle) => void;
  onMaxWidthChange: (maxWidth: number) => void;
  onDone: () => void;
  onCancel: () => void;
}

export function OverlayToolbar({
  selectedOverlayId,
  currentAlignment,
  currentStyle,
  currentMaxWidth,
  onAlignmentChange,
  onStyleChange,
  onMaxWidthChange,
  onDone,
  onCancel,
}: OverlayToolbarProps) {
  const hasSelection = selectedOverlayId !== null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-sm"
      style={{
        paddingBottom: `calc(1rem + var(--safe-area-inset-bottom))`,
      }}
    >
      {/* Controls row - only show when a text box is selected */}
      {hasSelection && (
        <div className="flex flex-col gap-3 border-b border-white/10 p-3">
          {/* Top row: Alignment and Style */}
          <div className="flex items-center justify-center gap-4">
            {/* Alignment controls */}
            <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${
                  currentAlignment === 'left'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                }`}
                onClick={() => onAlignmentChange('left')}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${
                  currentAlignment === 'center'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                }`}
                onClick={() => onAlignmentChange('center')}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${
                  currentAlignment === 'right'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                }`}
                onClick={() => onAlignmentChange('right')}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Style controls */}
            <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 px-3 ${
                  currentStyle === 'pill'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                }`}
                onClick={() => onStyleChange('pill')}
              >
                <Square className="mr-1.5 h-4 w-4 fill-current" />
                <span className="text-xs">Pill</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 px-3 ${
                  currentStyle === 'outline'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                }`}
                onClick={() => onStyleChange('outline')}
              >
                <Type className="mr-1.5 h-4 w-4" />
                <span className="text-xs">Outline</span>
              </Button>
            </div>
          </div>

          {/* Bottom row: Max Width slider */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-white/60 whitespace-nowrap">Width</span>
            <Slider
              value={[currentMaxWidth * 100]}
              onValueChange={([value]) => onMaxWidthChange(value / 100)}
              min={50}
              max={95}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-white/80 w-10 text-right">{Math.round(currentMaxWidth * 100)}%</span>
          </div>
        </div>
      )}

      {/* Hint when no selection */}
      {!hasSelection && (
        <div className="border-b border-white/10 p-3 text-center">
          <p className="text-sm text-white/60">Tap a text box to edit</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 p-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button size="lg" className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
