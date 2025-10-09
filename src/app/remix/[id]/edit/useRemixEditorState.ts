import { useCallback, useMemo, useReducer } from 'react'
import type { RemixPostType, RemixSlideType, RemixTextBoxType, BackgroundLayerType } from '@/lib/validations/remix-schema'

export interface RemixEditorPost extends RemixPostType {
  originalPost?: {
    id: string
    tiktokUrl?: string
    authorNickname?: string | null
    authorHandle?: string | null
    description?: string | null
    images?: Array<{ cacheAssetId: string; width: number; height: number; url?: string }>
  }
}

interface EditorState {
  remix: RemixEditorPost | null
  currentSlideIndex: number
  selectedTextBoxId: string | null
  selectedBackgroundLayerId: string | null
  hasUnsavedChanges: boolean
}

type EditorAction =
  | { type: 'setRemix'; remix: RemixEditorPost | null }
  | { type: 'setCurrentSlideIndex'; index: number }
  | { type: 'selectTextBox'; textBoxId: string | null }
  | { type: 'selectBackground'; layerId: string | null }
  | { type: 'markDirty'; dirty: boolean }
  | { type: 'updateSlides'; slides: RemixSlideType[]; dirty?: boolean }

const initialState: EditorState = {
  remix: null,
  currentSlideIndex: 0,
  selectedTextBoxId: null,
  selectedBackgroundLayerId: null,
  hasUnsavedChanges: false
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'setRemix':
      return {
        ...state,
        remix: action.remix,
        currentSlideIndex: 0,
        selectedTextBoxId: null,
        selectedBackgroundLayerId: null,
        hasUnsavedChanges: false
      }
    case 'setCurrentSlideIndex':
      return {
        ...state,
        currentSlideIndex: action.index,
        selectedTextBoxId: null,
        selectedBackgroundLayerId: null
      }
    case 'selectTextBox':
      return {
        ...state,
        selectedTextBoxId: action.textBoxId,
        selectedBackgroundLayerId: action.textBoxId ? null : state.selectedBackgroundLayerId
      }
    case 'selectBackground':
      return {
        ...state,
        selectedBackgroundLayerId: action.layerId,
        selectedTextBoxId: action.layerId ? null : state.selectedTextBoxId
      }
    case 'markDirty':
      return {
        ...state,
        hasUnsavedChanges: action.dirty
      }
    case 'updateSlides':
      if (!state.remix) return state
      return {
        ...state,
        remix: { ...state.remix, slides: action.slides },
        hasUnsavedChanges: action.dirty === false ? state.hasUnsavedChanges : true
      }
    default:
      return state
  }
}

export function useRemixEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialState)

  const setRemix = useCallback((remix: RemixEditorPost | null) => {
    dispatch({ type: 'setRemix', remix })
  }, [])

  const setCurrentSlideIndex = useCallback((index: number) => {
    dispatch({ type: 'setCurrentSlideIndex', index })
  }, [])

  const selectTextBox = useCallback((textBoxId: string | null) => {
    dispatch({ type: 'selectTextBox', textBoxId })
  }, [])

  const selectBackgroundLayer = useCallback((layerId: string | null) => {
    dispatch({ type: 'selectBackground', layerId })
  }, [])

  const markDirty = useCallback((dirty: boolean) => {
    dispatch({ type: 'markDirty', dirty })
  }, [])

  const updateSlide = useCallback(
    (mutator: (slide: RemixSlideType) => RemixSlideType, options?: { dirty?: boolean }) => {
      const { remix, currentSlideIndex } = state
      if (!remix || currentSlideIndex >= remix.slides.length) return

      const slides = remix.slides.map((slide, idx) =>
        idx === currentSlideIndex ? mutator(slide) : slide
      )

      dispatch({ type: 'updateSlides', slides, dirty: options?.dirty })
    },
    [state]
  )

  const updateSlideCollection = useCallback(
    (slides: RemixSlideType[], options?: { dirty?: boolean }) => {
      dispatch({ type: 'updateSlides', slides, dirty: options?.dirty })
    },
    []
  )

  const updateSelectedTextBox = useCallback(
    (textBoxId: string, mutator: (textBox: RemixTextBoxType) => RemixTextBoxType, options?: { dirty?: boolean }) => {
      updateSlide((slide) => {
        const nextTextBoxes = slide.textBoxes.map((tb) =>
          tb.id === textBoxId ? mutator(tb) : tb
        )
        return { ...slide, textBoxes: nextTextBoxes }
      }, options)
    },
    [updateSlide]
  )

  const updateSelectedBackground = useCallback(
    (layerId: string, mutator: (layer: BackgroundLayerType) => BackgroundLayerType, options?: { dirty?: boolean }) => {
      updateSlide((slide) => {
        const nextLayers = (slide.backgroundLayers || []).map((layer) =>
          layer.id === layerId ? mutator(layer) : layer
        )
        return { ...slide, backgroundLayers: nextLayers }
      }, options)
    },
    [updateSlide]
  )

  return useMemo(() => ({
    state,
    setRemix,
    setCurrentSlideIndex,
    selectTextBox,
    selectBackgroundLayer,
    markDirty,
    updateSlide,
    updateSlideCollection,
    updateSelectedTextBox,
    updateSelectedBackground
  }), [state, setRemix, setCurrentSlideIndex, selectTextBox, selectBackgroundLayer, markDirty, updateSlide, updateSlideCollection, updateSelectedTextBox, updateSelectedBackground])
}
