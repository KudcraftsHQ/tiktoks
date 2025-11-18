'use client'

import type { BackgroundLayer } from '@/lib/satori-renderer'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'

interface BackgroundPanelProps {
  layers: BackgroundLayer[]
  selectedLayerId: string | null
  onSelectLayer: (id: string) => void
  onUpdateLayer: (id: string, updates: Partial<BackgroundLayer>) => void
}

export function BackgroundPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}: BackgroundPanelProps) {
  const selectedLayer = layers.find(l => l.id === selectedLayerId)

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3">Background</h3>

      {/* Layer List */}
      <div className="flex flex-col gap-2 mb-4">
        {layers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            className={`p-3 rounded-md cursor-pointer text-sm border transition-colors ${
              selectedLayerId === layer.id
                ? 'bg-accent border-primary'
                : 'bg-muted hover:bg-accent border-border'
            }`}
          >
            <div className="font-medium mb-1 capitalize">
              {layer.type}
            </div>
            <div className="text-xs text-muted-foreground">
              Opacity: {Math.round(layer.opacity * 100)}% • Z: {layer.zIndex}
            </div>
          </div>
        ))}
      </div>

      {/* Layer Controls */}
      {selectedLayer && (
        <div className="flex flex-col gap-4 pt-4 border-t">
          <h4 className="text-sm font-semibold">Layer Settings</h4>

          {/* Layer Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Type</Label>
            <Select
              value={selectedLayer.type}
              onValueChange={(value) => onUpdateLayer(selectedLayer.id, { type: value as 'color' | 'gradient' | 'image' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="color">Solid Color</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          {selectedLayer.type === 'color' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Color</Label>
              <Input
                type="color"
                value={selectedLayer.color || '#ffffff'}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { color: e.target.value })}
                className="h-9"
              />
            </div>
          )}

          {/* Gradient */}
          {selectedLayer.type === 'gradient' && selectedLayer.gradient && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Gradient Type</Label>
                <Select
                  value={selectedLayer.gradient.type}
                  onValueChange={(value) => onUpdateLayer(selectedLayer.id, {
                    gradient: { ...selectedLayer.gradient!, type: value as 'linear' | 'radial' }
                  })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="radial">Radial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedLayer.gradient.type === 'linear' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Angle: {selectedLayer.gradient.angle ?? 0}°
                  </Label>
                  <Slider
                    min={0}
                    max={360}
                    step={1}
                    value={[selectedLayer.gradient.angle ?? 0]}
                    onValueChange={([value]) => onUpdateLayer(selectedLayer.id, {
                      gradient: { ...selectedLayer.gradient!, angle: value }
                    })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium">Color Stops</Label>
                {selectedLayer.gradient.colors.map((color, index) => (
                  <Input
                    key={index}
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...selectedLayer.gradient!.colors]
                      newColors[index] = e.target.value
                      onUpdateLayer(selectedLayer.id, {
                        gradient: { ...selectedLayer.gradient!, colors: newColors }
                      })
                    }}
                    className="h-8"
                  />
                ))}
              </div>
            </>
          )}

          {/* Image URL */}
          {selectedLayer.type === 'image' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Image URL</Label>
              <Input
                type="text"
                value={selectedLayer.imageUrl || ''}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="text-sm"
              />
            </div>
          )}

          {/* Opacity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Opacity: {Math.round(selectedLayer.opacity * 100)}%
            </Label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[selectedLayer.opacity * 100]}
              onValueChange={([value]) => onUpdateLayer(selectedLayer.id, { opacity: value / 100 })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
