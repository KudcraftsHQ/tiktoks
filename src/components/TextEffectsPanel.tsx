'use client'

import { useRef, useEffect } from 'react'
import type { TextBox } from '@/lib/satori-renderer'

interface TextEffectsPanelProps {
  textBox: TextBox
  onUpdate: (updates: Partial<TextBox>) => void
}

export function TextEffectsPanel({ textBox, onUpdate }: TextEffectsPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when text box is selected
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      // Place cursor at the end
      const length = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(length, length)
    }
  }, [textBox.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Text Effects</h4>

      {/* Text Content */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Text Content
        </label>
        <textarea
          ref={textareaRef}
          value={textBox.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Enter your text here..."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            fontFamily: 'inherit',
            resize: 'vertical',
            lineHeight: '1.5',
          }}
        />
      </div>

      {/* Font Size */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Font Size: {textBox.fontSize}px
        </label>
        <input
          type="range"
          min="16"
          max="120"
          value={textBox.fontSize}
          onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      {/* Font Weight */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Font Weight
        </label>
        <select
          value={textBox.fontWeight}
          onChange={(e) => onUpdate({ fontWeight: e.target.value })}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '13px',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
          }}
        >
          <option value="100">Thin (100)</option>
          <option value="200">Extra Light (200)</option>
          <option value="300">Light (300)</option>
          <option value="400">Regular (400)</option>
          <option value="500">Medium (500)</option>
          <option value="600">Semi Bold (600)</option>
          <option value="700">Bold (700)</option>
          <option value="800">Extra Bold (800)</option>
          <option value="900">Black (900)</option>
        </select>
      </div>

      {/* Text Align */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Text Align
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => onUpdate({ textAlign: align })}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                backgroundColor: textBox.textAlign === align ? '#000000' : '#f5f5f5',
                color: textBox.textAlign === align ? '#ffffff' : '#000000',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {align}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Text Color
        </label>
        <input
          type="color"
          value={textBox.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          style={{ width: '100%', height: '36px', border: '1px solid #e0e0e0', borderRadius: '4px' }}
        />
      </div>

      {/* Enable Shadow */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={textBox.enableShadow ?? false}
            onChange={(e) => onUpdate({ enableShadow: e.target.checked })}
          />
          Enable Shadow
        </label>
      </div>

      {/* Shadow Controls */}
      {textBox.enableShadow && (
        <>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Shadow Color
            </label>
            <input
              type="color"
              value={textBox.shadowColor?.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (_, r, g, b) =>
                `#${((1 << 24) + (parseInt(r) << 16) + (parseInt(g) << 8) + parseInt(b)).toString(16).slice(1)}`
              ) || '#000000'}
              onChange={(e) => onUpdate({ shadowColor: e.target.value })}
              style={{ width: '100%', height: '36px', border: '1px solid #e0e0e0', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Shadow Blur: {textBox.shadowBlur ?? 4}px
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={textBox.shadowBlur ?? 4}
              onChange={(e) => onUpdate({ shadowBlur: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Shadow Offset X: {textBox.shadowOffsetX ?? 2}px
            </label>
            <input
              type="range"
              min="-20"
              max="20"
              value={textBox.shadowOffsetX ?? 2}
              onChange={(e) => onUpdate({ shadowOffsetX: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Shadow Offset Y: {textBox.shadowOffsetY ?? 2}px
            </label>
            <input
              type="range"
              min="-20"
              max="20"
              value={textBox.shadowOffsetY ?? 2}
              onChange={(e) => onUpdate({ shadowOffsetY: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      {/* Outline Controls */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Outline Width: {textBox.outlineWidth ?? 0}px
        </label>
        <input
          type="range"
          min="0"
          max="20"
          value={textBox.outlineWidth ?? 0}
          onChange={(e) => onUpdate({ outlineWidth: parseInt(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>
      
      {/* Outline Color */}
      {(textBox.outlineWidth ?? 0) > 0 && (
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
            Outline Color
          </label>
          <input
            type="color"
            value={textBox.outlineColor || '#000000'}
            onChange={(e) => onUpdate({ outlineColor: e.target.value })}
            style={{ width: '100%', height: '36px', border: '1px solid #e0e0e0', borderRadius: '4px' }}
          />
        </div>
      )}

      {/* Enable Blob Background */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={textBox.enableBlobBackground ?? false}
            onChange={(e) => onUpdate({ enableBlobBackground: e.target.checked })}
          />
          Enable Blob Background
        </label>
      </div>

      {/* Blob Background Controls */}
      {textBox.enableBlobBackground && (
        <>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Blob Color
            </label>
            <input
              type="color"
              value={textBox.blobColor || '#000000'}
              onChange={(e) => onUpdate({ blobColor: e.target.value })}
              style={{ width: '100%', height: '36px', border: '1px solid #e0e0e0', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Blob Opacity: {Math.round((textBox.blobOpacity ?? 1) * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={(textBox.blobOpacity ?? 1) * 100}
              onChange={(e) => onUpdate({ blobOpacity: parseInt(e.target.value) / 100 })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Blob Spread: {textBox.blobSpread ?? 20}px
            </label>
            <input
              type="range"
              min="5"
              max="100"
              value={textBox.blobSpread ?? 20}
              onChange={(e) => onUpdate({ blobSpread: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Blob Roundness: {Math.round((textBox.blobRoundness ?? 0.5) * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={(textBox.blobRoundness ?? 0.5) * 100}
              onChange={(e) => onUpdate({ blobRoundness: parseInt(e.target.value) / 100 })}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}
    </div>
  )
}
