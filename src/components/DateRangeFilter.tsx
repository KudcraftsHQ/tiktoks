'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { format, startOfDay, endOfDay, subDays, subMonths, subYears } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const DATE_PRESETS = [
  {
    label: 'Today',
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date())
    })
  },
  {
    label: 'Yesterday',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1))
    })
  },
  {
    label: 'Last 7 days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 7)),
      to: endOfDay(new Date())
    })
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date())
    })
  },
  {
    label: 'Last 90 days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 90)),
      to: endOfDay(new Date())
    })
  },
  {
    label: 'Last year',
    getValue: () => ({
      from: startOfDay(subYears(new Date(), 1)),
      to: endOfDay(new Date())
    })
  }
]

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange>(value)

  // Sync temp range when value changes from external source (e.g., URL)
  React.useEffect(() => {
    setTempRange(value)
  }, [value])

  const handlePresetClick = (preset: typeof DATE_PRESETS[0]) => {
    const range = preset.getValue()
    setTempRange(range)
    onChange(range)
    setIsOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range) {
      setTempRange(range)
    }
  }

  const handleApply = () => {
    // Ensure we have both from and to dates
    if (tempRange.from && tempRange.to) {
      onChange({
        from: startOfDay(tempRange.from),
        to: endOfDay(tempRange.to)
      })
      setIsOpen(false)
    } else if (tempRange.from) {
      // If only from is selected, set to as the same day
      onChange({
        from: startOfDay(tempRange.from),
        to: endOfDay(tempRange.from)
      })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    const emptyRange = { from: undefined, to: undefined }
    setTempRange(emptyRange)
    onChange(emptyRange)
    setIsOpen(false)
  }

  const hasActiveFilter = value.from || value.to

  const getDisplayText = () => {
    if (!value.from && !value.to) {
      return 'Filter by date'
    }

    // Check if it matches a preset
    for (const preset of DATE_PRESETS) {
      const presetRange = preset.getValue()
      if (
        value.from &&
        value.to &&
        Math.abs(value.from.getTime() - presetRange.from.getTime()) < 1000 &&
        Math.abs(value.to.getTime() - presetRange.to.getTime()) < 1000
      ) {
        return preset.label
      }
    }

    // Custom range
    if (value.from && value.to) {
      return `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`
    }

    if (value.from) {
      return `From ${format(value.from, 'MMM d, yyyy')}`
    }

    return 'Filter by date'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilter ? 'default' : 'outline'}
            className={cn(
              'justify-start text-left font-normal h-8 text-xs px-3',
              !hasActiveFilter && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-1.5 h-3 w-3" />
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            <div className="flex flex-col gap-1 border-r p-3">
              <div className="text-sm font-semibold mb-2">Presets</div>
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Calendar */}
            <div className="p-3">
              <div className="text-sm font-semibold mb-2">Custom Range</div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={tempRange?.from}
                selected={tempRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
              />
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!tempRange.from}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear filter button when active */}
      {hasActiveFilter && (
        <Button
          variant="ghost"
          className="h-8 px-2"
          onClick={handleClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
