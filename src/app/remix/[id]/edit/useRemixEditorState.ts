import { useCallback, useMemo, useReducer } from 'react'
import type { RemixPostType, RemixSlideType, RemixTextBoxType, BackgroundLayerType } from '@/lib/validations/remix-schema'

interface EditorState {
  remix: RemixPostType | null
  currentSlideIndex: number
  selectedTextBoxId: string | null
  selectedBackgroundLayerId: string | null
  hasUnsavedChanges: boolean
}

type EditorAction =
  | { type: 'setRemix'; remix: RemixPostType | null }
  | { type: 'setCurrentSlideIndex'; index: number }
  | { type: 'selectTextBox'; textBoxId: string | null }
  | { type: 'selectBackground'; layerId: string | null }
  | { type: 'markDirty'; dirty: boolean }
  | { type: 'updateSlides'; slides: RemixSlideType[] }

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
        hasUnsavedChanges: true
      }
    default:
      return state
  }
}

export function useRemixEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialState)

  const setRemix = useCallback((remix: RemixPostType | null) => {
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
    (mutator: (slide: RemixSlideType) => RemixSlideType)
  ) => {
    const { remix, currentSlideIndex } = state
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const slides = remix.slides.map((slide, idx) =>
      idx === currentSlideIndex ? mutator(slide) : slide
    )

    dispatch({ type: 'updateSlides', slides })
  }, [state])

  const updateSlideCollection = useCallback((slides: RemixSlideType[]) => {
    dispatch({ type: 'updateSlides', slides })
  }, [])

  const updateSelectedTextBox = useCallback(
    (textBoxId: string, mutator: (textBox: RemixTextBoxType) => RemixTextBoxType)
  ) => {
    updateSlide((slide) => {
      const nextTextBoxes = slide.textBoxes.map((tb) =>
        tb.id === textBoxId ? mutator(tb) : tb
      )
      return { ...slide, textBoxes: nextTextBoxes }
    })
  }, [updateSlide]

  const updateSelectedBackground = useCallback(
    (layerId: string, mutator: (layer: BackgroundLayerType) => BackgroundLayerType)
  ) => {
    updateSlide((slide) => {
      const nextLayers = (slide.backgroundLayers || []).map((layer) =>
        layer.id === layerId ? mutator(layer) : layer
      )
      return { ...slide, backgroundLayers: nextLayers }
    })
  }, [updateSlide]

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
