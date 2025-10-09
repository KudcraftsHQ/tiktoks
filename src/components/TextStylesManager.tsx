'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Star, Trash2, Check } from 'lucide-react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

interface TextStyle {
  id: string
  name: string
  isDefault: boolean
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  color: string
  textAlign: string
  enableShadow: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  outlineWidth: number
  outlineColor?: string
  backgroundColor: string
  backgroundOpacity: number
  borderRadius: number
  borderWidth: number
  borderColor?: string
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  lineHeight: number
  letterSpacing: number
  wordSpacing: number
}

interface TextStylesManagerProps {
  remixId: string
  selectedTextBox?: RemixTextBoxType
  onApplyStyle: (style: TextStyle) => void
  onSaveCurrentAsStyle: (name: string) => void
}

export function TextStylesManager({
  remixId,
  selectedTextBox,
  onApplyStyle,
  onSaveCurrentAsStyle
}: TextStylesManagerProps) {
  const [styles, setStyles] = useState<TextStyle[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showApplyAllDialog, setShowApplyAllDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [styleName, setStyleName] = useState('')
  const [selectedStyleForAction, setSelectedStyleForAction] = useState<TextStyle | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load text styles
  useEffect(() => {
    fetchStyles()
  }, [remixId])

  const fetchStyles = async () => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/text-styles`)
      if (response.ok) {
        const data = await response.json()
        setStyles(data)
      }
    } catch (error) {
      console.error('Failed to fetch text styles:', error)
    }
  }

  const handleSaveStyle = async () => {
    if (!styleName.trim() || !selectedTextBox) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/remixes/${remixId}/text-styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: styleName.trim(),
          isDefault: false,
          fontSize: selectedTextBox.fontSize,
          fontFamily: selectedTextBox.fontFamily,
          fontWeight: selectedTextBox.fontWeight,
          fontStyle: selectedTextBox.fontStyle,
          textDecoration: selectedTextBox.textDecoration,
          color: selectedTextBox.color,
          textAlign: selectedTextBox.textAlign,
          enableShadow: selectedTextBox.enableShadow,
          shadowColor: selectedTextBox.shadowColor,
          shadowBlur: selectedTextBox.shadowBlur,
          shadowOffsetX: selectedTextBox.shadowOffsetX,
          shadowOffsetY: selectedTextBox.shadowOffsetY,
          outlineWidth: selectedTextBox.outlineWidth,
          outlineColor: selectedTextBox.outlineColor,
          backgroundColor: selectedTextBox.backgroundColor,
          backgroundOpacity: selectedTextBox.backgroundOpacity,
          borderRadius: selectedTextBox.borderRadius,
          borderWidth: selectedTextBox.borderWidth,
          borderColor: selectedTextBox.borderColor,
          paddingTop: selectedTextBox.paddingTop,
          paddingRight: selectedTextBox.paddingRight,
          paddingBottom: selectedTextBox.paddingBottom,
          paddingLeft: selectedTextBox.paddingLeft,
          lineHeight: selectedTextBox.lineHeight,
          letterSpacing: selectedTextBox.letterSpacing,
          wordSpacing: selectedTextBox.wordSpacing
        })
      })

      if (response.ok) {
        await fetchStyles()
        setShowSaveDialog(false)
        setStyleName('')
      }
    } catch (error) {
      console.error('Failed to save text style:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetDefault = async (style: TextStyle) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/remixes/${remixId}/text-styles/${style.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      })

      if (response.ok) {
        await fetchStyles()
      }
    } catch (error) {
      console.error('Failed to set default style:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteStyle = async () => {
    if (!selectedStyleForAction) return

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/remixes/${remixId}/text-styles/${selectedStyleForAction.id}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        await fetchStyles()
        setShowDeleteDialog(false)
        setSelectedStyleForAction(null)
      }
    } catch (error) {
      console.error('Failed to delete text style:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyToAll = () => {
    if (!selectedStyleForAction) return
    onApplyStyle(selectedStyleForAction)
    setShowApplyAllDialog(false)
    setSelectedStyleForAction(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Text Styles</h3>
        <Button
          onClick={() => setShowSaveDialog(true)}
          disabled={!selectedTextBox}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Save Style
        </Button>
      </div>

      {styles.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          <p>No saved styles yet</p>
          <p className="mt-1">Style a text box and save it</p>
        </div>
      ) : (
        <div className="space-y-2">
          {styles.map((style) => (
            <ContextMenu key={style.id}>
              <ContextMenuTrigger>
                <button
                  onClick={() => onApplyStyle(style)}
                  className="w-full p-3 bg-muted/30 hover:bg-muted/50 rounded border border-border/40 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {style.isDefault && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{style.name}</span>
                    </div>
                  </div>
                  <div
                    className="mt-2 text-xs px-2 py-1 rounded"
                    style={{
                      fontFamily: style.fontFamily,
                      fontSize: Math.min(style.fontSize * 0.5, 14),
                      fontWeight: style.fontWeight,
                      color: style.color,
                      backgroundColor: style.backgroundColor,
                      opacity: style.backgroundOpacity,
                      borderRadius: style.borderRadius * 0.5
                    }}
                  >
                    Preview Text
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onApplyStyle(style)}>
                  <Check className="h-3 w-3 mr-2" />
                  Apply to Selected
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    setSelectedStyleForAction(style)
                    setShowApplyAllDialog(true)
                  }}
                >
                  Apply to All Text Boxes
                </ContextMenuItem>
                {!style.isDefault && (
                  <ContextMenuItem onClick={() => handleSetDefault(style)}>
                    <Star className="h-3 w-3 mr-2" />
                    Set as Default
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  onClick={() => {
                    setSelectedStyleForAction(style)
                    setShowDeleteDialog(true)
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      {/* Save Style Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Text Style</DialogTitle>
            <DialogDescription>
              Give this text style a name to reuse it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="style-name">Style Name</Label>
              <Input
                id="style-name"
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                placeholder="e.g., Headline Bold"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveStyle()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false)
                setStyleName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveStyle}
              disabled={!styleName.trim() || isLoading}
            >
              Save Style
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply to All Confirmation Dialog */}
      <AlertDialog open={showApplyAllDialog} onOpenChange={setShowApplyAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Style to All Text Boxes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply the "{selectedStyleForAction?.name}" style to all text boxes in the current slide.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowApplyAllDialog(false)
                setSelectedStyleForAction(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyToAll}>
              Apply to All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Text Style?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedStyleForAction?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false)
                setSelectedStyleForAction(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStyle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
