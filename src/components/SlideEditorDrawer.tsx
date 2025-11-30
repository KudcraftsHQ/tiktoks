'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, AlignLeft, AlignCenter, AlignRight, Square, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SlideThumbnail } from './SlideThumbnail';
import { TextOverlayBox } from '@/components/mobile/TextOverlayBox';
import type { RemixSlideType } from '@/lib/validations/remix-schema';
import type { TextOverlay, TextOverlayAlignment, TextOverlayStyle } from '@/lib/text-overlay-utils';
import { generateOverlayId, parseTextToOverlays } from '@/lib/text-overlay-utils';
import { getProxiedImageUrlById } from '@/lib/image-proxy';
import { toast } from 'sonner';

interface SlideEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slides: RemixSlideType[];
  draftId: string;
  draftName: string;
  initialSlideIndex?: number;
  onSave: (slideId: string, overlays: TextOverlay[], imageOffsetY: number) => Promise<boolean>;
}

/**
 * Convert saved textBoxes back to mobile TextOverlay format
 */
function textBoxesToOverlays(textBoxes: any[]): TextOverlay[] {
  if (!Array.isArray(textBoxes) || textBoxes.length === 0) {
    return [];
  }

  return textBoxes.map((box) => ({
    id: box.id || generateOverlayId(),
    text: box.text || '',
    x: box.x ?? 0.5,
    y: box.y ?? 0.5,
    fontSize: box.fontSize ?? 48,
    alignment: (box.textAlign || 'center') as TextOverlayAlignment,
    style: (box._mobileStyle || (box.backgroundOpacity > 0 ? 'pill' : 'outline')) as TextOverlayStyle,
    maxWidth: box._mobileMaxWidth ?? box.width ?? 0.6,
  }));
}

/**
 * Get image URL from slide's background layers using cacheAssetId
 */
function getSlideImageUrl(slide: RemixSlideType): string | null {
  const imageLayer = slide.backgroundLayers?.find(
    (layer) => layer.type === 'image' && layer.cacheAssetId
  );
  if (!imageLayer?.cacheAssetId) return null;
  return getProxiedImageUrlById(imageLayer.cacheAssetId);
}

/**
 * Get saved image offset from slide
 */
function getSlideImageOffset(slide: any): number {
  return slide._mobileImageOffsetY ?? 0.5;
}

export function SlideEditorDrawer({
  isOpen,
  onClose,
  slides,
  draftId,
  draftName,
  initialSlideIndex = 0,
  onSave,
}: SlideEditorDrawerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSlideIndex);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [imageOffsetY, setImageOffsetY] = useState(0.5);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<{ slideId: string; overlays: TextOverlay[]; imageOffsetY: number } | null>(null);

  const currentSlide = slides[currentSlideIndex];
  const imageUrl = currentSlide ? getSlideImageUrl(currentSlide) : null;

  // Load overlays when slide changes
  useEffect(() => {
    if (!currentSlide) return;

    // Load from textBoxes if available, otherwise parse paraphrasedText
    const slideAny = currentSlide as any;
    console.log('[SlideEditorDrawer] Loading slide:', {
      id: currentSlide.id,
      hasTextBoxes: !!slideAny.textBoxes,
      textBoxesLength: slideAny.textBoxes?.length,
      paraphrasedText: currentSlide.paraphrasedText,
    });

    if (slideAny.textBoxes && slideAny.textBoxes.length > 0) {
      const overlays = textBoxesToOverlays(slideAny.textBoxes);
      console.log('[SlideEditorDrawer] Loaded from textBoxes:', overlays);
      setOverlays(overlays);
    } else if (currentSlide.paraphrasedText) {
      const overlays = parseTextToOverlays(currentSlide.paraphrasedText);
      console.log('[SlideEditorDrawer] Parsed from paraphrasedText:', overlays);
      setOverlays(overlays);
    } else {
      console.log('[SlideEditorDrawer] No text content found');
      setOverlays([]);
    }

    setImageOffsetY(getSlideImageOffset(slideAny));
    setSelectedOverlayId(null);
  }, [currentSlide]);

  // Update preview size using ResizeObserver for accurate dimensions
  useEffect(() => {
    if (!previewRef.current || !isOpen) return;

    const updateSize = () => {
      if (previewRef.current) {
        const width = previewRef.current.clientWidth;
        if (width > 0) {
          // 3:4 aspect ratio
          const height = (width * 4) / 3;
          setPreviewSize({ width, height });
        }
      }
    };

    // Use ResizeObserver for accurate size detection during transitions
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(previewRef.current);

    // Also update on window resize
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isOpen]);

  // Reset to initial slide when drawer opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSlideIndex(initialSlideIndex);
    }
  }, [isOpen, initialSlideIndex]);

  const selectedOverlay = useMemo(
    () => overlays.find((o) => o.id === selectedOverlayId) || null,
    [overlays, selectedOverlayId]
  );

  // Auto-save function with debounce
  const scheduleAutoSave = useCallback(
    (newOverlays: TextOverlay[], newImageOffsetY: number) => {
      if (!currentSlide) return;

      // Store pending save data
      pendingSaveRef.current = {
        slideId: currentSlide.id,
        overlays: newOverlays,
        imageOffsetY: newImageOffsetY,
      };

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Schedule new save after 500ms of inactivity
      saveTimeoutRef.current = setTimeout(async () => {
        const pendingSave = pendingSaveRef.current;
        if (!pendingSave) return;

        setIsSaving(true);
        try {
          await onSave(pendingSave.slideId, pendingSave.overlays, pendingSave.imageOffsetY);
          pendingSaveRef.current = null;
        } catch (error) {
          console.error('Auto-save error:', error);
          toast.error('Failed to save');
        } finally {
          setIsSaving(false);
        }
      }, 500);
    },
    [currentSlide, onSave]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleOverlayChange = useCallback((id: string, updates: Partial<TextOverlay>) => {
    setOverlays((prev) => {
      const newOverlays = prev.map((o) => (o.id === id ? { ...o, ...updates } : o));
      scheduleAutoSave(newOverlays, imageOffsetY);
      return newOverlays;
    });
  }, [scheduleAutoSave, imageOffsetY]);

  const handleAlignmentChange = useCallback((alignment: TextOverlayAlignment) => {
    if (!selectedOverlayId) return;
    handleOverlayChange(selectedOverlayId, { alignment });
  }, [selectedOverlayId, handleOverlayChange]);

  const handleStyleChange = useCallback((style: TextOverlayStyle) => {
    if (!selectedOverlayId) return;
    handleOverlayChange(selectedOverlayId, { style });
  }, [selectedOverlayId, handleOverlayChange]);

  const handleMaxWidthChange = useCallback((maxWidth: number) => {
    if (!selectedOverlayId) return;
    handleOverlayChange(selectedOverlayId, { maxWidth });
  }, [selectedOverlayId, handleOverlayChange]);

  const handleFontSizeChange = useCallback((fontSize: number) => {
    if (!selectedOverlayId) return;
    handleOverlayChange(selectedOverlayId, { fontSize });
  }, [selectedOverlayId, handleOverlayChange]);

  const handleTextChange = useCallback((text: string) => {
    if (!selectedOverlayId) return;
    handleOverlayChange(selectedOverlayId, { text });
  }, [selectedOverlayId, handleOverlayChange]);

  const handleImageOffsetChange = useCallback((offset: number) => {
    setImageOffsetY(offset);
    scheduleAutoSave(overlays, offset);
  }, [scheduleAutoSave, overlays]);

  const handleAddTextBox = useCallback(() => {
    const newOverlay: TextOverlay = {
      id: generateOverlayId(),
      text: 'New text',
      x: 0.5,
      y: 0.5,
      fontSize: 48,
      alignment: 'center',
      style: 'pill',
      maxWidth: 0.6,
    };
    setOverlays((prev) => {
      const newOverlays = [...prev, newOverlay];
      scheduleAutoSave(newOverlays, imageOffsetY);
      return newOverlays;
    });
    setSelectedOverlayId(newOverlay.id);
  }, [scheduleAutoSave, imageOffsetY]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedOverlayId) return;
    setOverlays((prev) => {
      const newOverlays = prev.filter((o) => o.id !== selectedOverlayId);
      scheduleAutoSave(newOverlays, imageOffsetY);
      return newOverlays;
    });
    setSelectedOverlayId(null);
  }, [selectedOverlayId, scheduleAutoSave, imageOffsetY]);

  // Immediately flush any pending save
  const flushPendingSave = useCallback(async () => {
    // Clear scheduled timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Save pending data if any
    const pendingSave = pendingSaveRef.current;
    if (pendingSave) {
      setIsSaving(true);
      try {
        await onSave(pendingSave.slideId, pendingSave.overlays, pendingSave.imageOffsetY);
        pendingSaveRef.current = null;
      } catch (error) {
        console.error('Save error:', error);
        toast.error('Failed to save');
      } finally {
        setIsSaving(false);
      }
    }
  }, [onSave]);

  // Handle slide change - flush save before switching
  const handleSlideChange = useCallback(async (newIndex: number) => {
    await flushPendingSave();
    setCurrentSlideIndex(newIndex);
  }, [flushPendingSave]);

  const handleClose = useCallback(async () => {
    await flushPendingSave();
    onClose();
  }, [flushPendingSave, onClose]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  return (
    <div
      className={cn(
        "h-screen flex-shrink-0 bg-card border-l border-border flex flex-col",
        "transition-all duration-300 ease-in-out",
        isOpen ? "w-[420px]" : "w-0 border-l-0 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="font-semibold text-sm truncate max-w-[280px]">{draftName}</h2>
              <p className="text-xs text-muted-foreground">
                Slide {currentSlideIndex + 1} of {slides.length}
              </p>
            </div>
          </div>
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
          {/* Slide Preview */}
          <div
            ref={previewRef}
            className="relative w-full bg-black"
            style={{ aspectRatio: '3/4' }}
            onClick={(e) => {
              // Only deselect if clicking directly on the preview container, not on children
              if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
                setSelectedOverlayId(null);
              }
            }}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Slide background"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: `50% ${imageOffsetY * 100}%` }}
                  draggable={false}
                />
                {/* Text Overlays - only render when we have valid dimensions */}
                {previewSize.width > 0 && previewSize.height > 0 && overlays.map((overlay) => (
                  <TextOverlayBox
                    key={overlay.id}
                    overlay={overlay}
                    containerWidth={previewSize.width}
                    containerHeight={previewSize.height}
                    isSelected={overlay.id === selectedOverlayId}
                    onSelect={() => setSelectedOverlayId(overlay.id)}
                    onChange={(updates) => handleOverlayChange(overlay.id, updates)}
                  />
                ))}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Slide Navigation - Mini Thumbnails */}
          <div className="mt-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => handleSlideChange(index)}
                  className={cn(
                    'relative flex-shrink-0 rounded overflow-hidden transition-all duration-200',
                    index === currentSlideIndex
                      ? 'opacity-100'
                      : 'opacity-50 hover:opacity-80'
                  )}
                >
                  <SlideThumbnail
                    slide={slide}
                    slideIndex={index}
                    size="md"
                  />
                  {/* Active indicator bar at bottom */}
                  {index === currentSlideIndex && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 space-y-6">
            {/* Image Position */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Image Position</label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-8">Top</span>
                <Slider
                  value={[imageOffsetY * 100]}
                  onValueChange={([value]) => handleImageOffsetChange(value / 100)}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8">Bot</span>
              </div>
            </div>

            {/* Text Overlay Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Text Overlays</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddTextBox}
                  >
                    + Add Text
                  </Button>
                  {selectedOverlayId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {selectedOverlay ? (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  {/* Text Content */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Text</label>
                    <Textarea
                      value={selectedOverlay.text}
                      onChange={(e) => handleTextChange(e.target.value)}
                      className="min-h-[80px] resize-none"
                      placeholder="Enter text..."
                    />
                  </div>

                  {/* Alignment & Style */}
                  <div className="flex gap-4">
                    {/* Alignment */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Alignment</label>
                      <div className="flex items-center gap-1 rounded-lg bg-background p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8',
                            selectedOverlay.alignment === 'left' && 'bg-primary text-primary-foreground'
                          )}
                          onClick={() => handleAlignmentChange('left')}
                        >
                          <AlignLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8',
                            selectedOverlay.alignment === 'center' && 'bg-primary text-primary-foreground'
                          )}
                          onClick={() => handleAlignmentChange('center')}
                        >
                          <AlignCenter className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8',
                            selectedOverlay.alignment === 'right' && 'bg-primary text-primary-foreground'
                          )}
                          onClick={() => handleAlignmentChange('right')}
                        >
                          <AlignRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Style */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Style</label>
                      <div className="flex items-center gap-1 rounded-lg bg-background p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-8 px-3',
                            selectedOverlay.style === 'pill' && 'bg-primary text-primary-foreground'
                          )}
                          onClick={() => handleStyleChange('pill')}
                        >
                          <Square className="mr-1 h-3 w-3 fill-current" />
                          Pill
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-8 px-3',
                            selectedOverlay.style === 'outline' && 'bg-primary text-primary-foreground'
                          )}
                          onClick={() => handleStyleChange('outline')}
                        >
                          <Type className="mr-1 h-3 w-3" />
                          Outline
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Width Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Max Width</label>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(selectedOverlay.maxWidth * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[selectedOverlay.maxWidth * 100]}
                      onValueChange={([value]) => handleMaxWidthChange(value / 100)}
                      min={50}
                      max={95}
                      step={5}
                    />
                  </div>

                  {/* Font Size Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Font Size</label>
                      <span className="text-xs text-muted-foreground">
                        {selectedOverlay.fontSize}px
                      </span>
                    </div>
                    <Slider
                      value={[selectedOverlay.fontSize]}
                      onValueChange={([value]) => handleFontSizeChange(value)}
                      min={24}
                      max={80}
                      step={2}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
                  {overlays.length > 0
                    ? 'Click a text overlay to edit'
                    : 'No text overlays. Click "Add Text" to create one.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
