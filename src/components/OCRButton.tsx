'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wand, Loader2 } from 'lucide-react'

interface OCRButtonProps {
  onOCR: () => Promise<void>
  disabled?: boolean
  showStatus?: boolean
  status?: 'idle' | 'processing' | 'success' | 'error'
}

export default function OCRButton({ 
  onOCR, 
  disabled = false, 
  showStatus = false, 
  status = 'idle' 
}: OCRButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = async () => {
    if (isProcessing || disabled) return
    
    setIsProcessing(true)
    try {
      await onOCR()
    } catch (error) {
      console.error('OCR failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-500'
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'processing':
        return 'Processing...'
      case 'success':
        return 'Success'
      case 'error':
        return 'Error'
      default:
        return 'Ready'
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className="relative"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Wand className="h-4 w-4 mr-2" />
        )}
        OCR
        {isProcessing && (
          <span className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
      </Button>
      
      {showStatus && (
        <Badge 
          variant="secondary" 
          className={`text-xs ${getStatusColor()} text-white border-none`}
        >
          {getStatusText()}
        </Badge>
      )}
    </div>
  )
}