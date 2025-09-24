'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Images, ChevronDown } from 'lucide-react'

interface ImageCountValue {
  min?: number
  max?: number
}

interface ImageCountFilterProps {
  value: ImageCountValue
  onChange: (value: ImageCountValue) => void
}

const presetOptions = [
  { label: 'Any Amount', value: {} },
  { label: '1-3 images', value: { min: 1, max: 3 } },
  { label: '4-6 images', value: { min: 4, max: 6 } },
  { label: '7-10 images', value: { min: 7, max: 10 } },
  { label: '10+ images', value: { min: 10 } },
  { label: 'Custom Range', value: 'custom' as const },
]

export default function ImageCountFilter({ value, onChange }: ImageCountFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCustom, setIsCustom] = useState(false)
  const [tempMin, setTempMin] = useState('')
  const [tempMax, setTempMax] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    // Check if current value matches any preset
    const matchesPreset = presetOptions.some(option => {
      if (option.value === 'custom') return false
      const preset = option.value as ImageCountValue
      return preset.min === value.min && preset.max === value.max
    })
    
    setIsCustom(!matchesPreset && (value.min !== undefined || value.max !== undefined))
    setTempMin(value.min?.toString() || '')
    setTempMax(value.max?.toString() || '')
  }, [value])

  const handlePresetSelect = (selectedValue: ImageCountValue | 'custom') => {
    if (selectedValue === 'custom') {
      setIsCustom(true)
      return
    }
    
    setIsCustom(false)
    onChange(selectedValue)
    setIsOpen(false)
  }

  const handleCustomChange = () => {
    const min = tempMin ? parseInt(tempMin) : undefined
    const max = tempMax ? parseInt(tempMax) : undefined
    
    // Validate that min <= max if both are provided
    if (min !== undefined && max !== undefined && min > max) {
      return
    }
    
    onChange({ min, max })
  }

  const getDisplayLabel = () => {
    if (!value.min && !value.max) {
      return 'Any Amount'
    }
    
    if (value.min && value.max) {
      return `${value.min}-${value.max} images`
    }
    
    if (value.min) {
      return `${value.min}+ images`
    }
    
    if (value.max) {
      return `Up to ${value.max} images`
    }
    
    return 'Any Amount'
  }

  const isSelectedPreset = (preset: ImageCountValue) => {
    return preset.min === value.min && preset.max === value.max
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-foreground mb-2 block">
        Image Count
      </label>
      
      {/* Dropdown Trigger */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <Images className="h-4 w-4" />
          {getDisplayLabel()}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Dropdown Content */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50">
          <CardContent className="p-3">
            <div className="space-y-2">
              {presetOptions.map((option, index) => (
                <div key={index}>
                  <div
                    onClick={() => handlePresetSelect(option.value)}
                    className={`flex items-center p-2 rounded-sm hover:bg-accent cursor-pointer ${
                      option.value === 'custom' 
                        ? (isCustom ? 'bg-accent' : '')
                        : (isSelectedPreset(option.value as ImageCountValue) ? 'bg-accent' : '')
                    }`}
                  >
                    <div className={`w-4 h-4 border rounded-full mr-2 ${
                      (option.value === 'custom' && isCustom) || 
                      (option.value !== 'custom' && isSelectedPreset(option.value as ImageCountValue))
                        ? 'bg-primary border-primary' 
                        : 'border-muted-foreground'
                    }`}>
                      {((option.value === 'custom' && isCustom) || 
                        (option.value !== 'custom' && isSelectedPreset(option.value as ImageCountValue))) && (
                        <div className="w-2 h-2 bg-primary-foreground rounded-full m-0.5" />
                      )}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </div>
                  
                  {/* Custom Range Inputs */}
                  {option.value === 'custom' && isCustom && (
                    <div className="ml-6 mt-2 space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">Min</label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={tempMin}
                            onChange={(e) => setTempMin(e.target.value)}
                            onBlur={handleCustomChange}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">Max</label>
                          <Input
                            type="number"
                            min={tempMin || "1"}
                            placeholder="∞"
                            value={tempMax}
                            onChange={(e) => setTempMax(e.target.value)}
                            onBlur={handleCustomChange}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}