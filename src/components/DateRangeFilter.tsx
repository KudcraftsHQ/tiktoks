'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, ChevronDown } from 'lucide-react'

type DateRangeValue = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'custom'

interface DateRangeFilterProps {
  value: DateRangeValue
  customStart?: Date
  customEnd?: Date
  onChange: (value: DateRangeValue, customStart?: Date, customEnd?: Date) => void
}

const dateOptions = [
  { value: 'all' as const, label: 'All Time' },
  { value: 'today' as const, label: 'Today' },
  { value: 'week' as const, label: 'This Week' },
  { value: 'month' as const, label: 'This Month' },
  { value: 'quarter' as const, label: 'Last 3 Months' },
  { value: 'custom' as const, label: 'Custom Range' },
]

export default function DateRangeFilter({ 
  value, 
  customStart, 
  customEnd, 
  onChange 
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempStart, setTempStart] = useState('')
  const [tempEnd, setTempEnd] = useState('')
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
    if (customStart) {
      setTempStart(customStart.toISOString().split('T')[0])
    }
    if (customEnd) {
      setTempEnd(customEnd.toISOString().split('T')[0])
    }
  }, [customStart, customEnd])

  const handlePresetSelect = (selectedValue: DateRangeValue) => {
    if (selectedValue === 'custom') {
      onChange(selectedValue, customStart, customEnd)
    } else {
      onChange(selectedValue)
    }
    if (selectedValue !== 'custom') {
      setIsOpen(false)
    }
  }

  const handleCustomDateChange = () => {
    const start = tempStart ? new Date(tempStart) : undefined
    const end = tempEnd ? new Date(tempEnd) : undefined
    onChange('custom', start, end)
  }

  const getDisplayLabel = () => {
    const option = dateOptions.find(opt => opt.value === value)
    if (value === 'custom' && customStart && customEnd) {
      return `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`
    }
    if (value === 'custom' && (customStart || customEnd)) {
      return 'Custom Range (incomplete)'
    }
    return option?.label || 'All Time'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-foreground mb-2 block">
        Date Range
      </label>
      
      {/* Dropdown Trigger */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {getDisplayLabel()}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Dropdown Content */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50">
          <CardContent className="p-3">
            <div className="space-y-2">
              {dateOptions.map(option => (
                <div key={option.value}>
                  <div
                    onClick={() => handlePresetSelect(option.value)}
                    className={`flex items-center p-2 rounded-sm hover:bg-accent cursor-pointer ${
                      value === option.value ? 'bg-accent' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 border rounded-full mr-2 ${
                      value === option.value 
                        ? 'bg-primary border-primary' 
                        : 'border-muted-foreground'
                    }`}>
                      {value === option.value && (
                        <div className="w-2 h-2 bg-primary-foreground rounded-full m-0.5" />
                      )}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </div>
                  
                  {/* Custom Date Inputs */}
                  {option.value === 'custom' && value === 'custom' && (
                    <div className="ml-6 mt-2 space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">From</label>
                          <Input
                            type="date"
                            value={tempStart}
                            onChange={(e) => setTempStart(e.target.value)}
                            onBlur={handleCustomDateChange}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">To</label>
                          <Input
                            type="date"
                            value={tempEnd}
                            onChange={(e) => setTempEnd(e.target.value)}
                            onBlur={handleCustomDateChange}
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