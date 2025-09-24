'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const toggleGroupVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 px-3',
        sm: 'h-8 px-2',
        lg: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ToggleGroupContextValue {
  value: string | string[]
  onValueChange: (value: string | string[]) => void
  type: 'single' | 'multiple'
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'single' | 'multiple'
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  disabled?: boolean
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, type, value = type === 'multiple' ? [] : '', onValueChange, disabled, children, ...props }, ref) => {
    const handleValueChange = React.useCallback(
      (itemValue: string) => {
        if (disabled) return

        if (type === 'single') {
          const newValue = value === itemValue ? '' : itemValue
          onValueChange?.(newValue)
        } else {
          const currentValues = Array.isArray(value) ? value : []
          const newValues = currentValues.includes(itemValue)
            ? currentValues.filter(v => v !== itemValue)
            : [...currentValues, itemValue]
          onValueChange?.(newValues)
        }
      },
      [type, value, onValueChange, disabled]
    )

    return (
      <ToggleGroupContext.Provider value={{ value, onValueChange: handleValueChange, type }}>
        <div
          ref={ref}
          className={cn('flex items-center gap-1', className)}
          role="group"
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    )
  }
)
ToggleGroup.displayName = 'ToggleGroup'

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof toggleGroupVariants> {
  value: string
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value: itemValue, variant, size, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)
    
    if (!context) {
      throw new Error('ToggleGroupItem must be used within a ToggleGroup')
    }

    const { value, onValueChange, type } = context
    
    const isPressed = type === 'single' 
      ? value === itemValue 
      : Array.isArray(value) && value.includes(itemValue)

    return (
      <button
        ref={ref}
        type="button"
        className={cn(toggleGroupVariants({ variant, size }), className)}
        data-state={isPressed ? 'on' : 'off'}
        aria-pressed={isPressed}
        onClick={() => onValueChange(itemValue)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleGroupItem.displayName = 'ToggleGroupItem'

export { ToggleGroup, ToggleGroupItem }