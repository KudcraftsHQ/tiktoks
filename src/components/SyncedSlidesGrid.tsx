'use client'

import { useEffect } from 'react'

export function SyncedSlidesGrid({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const mainContainer = document.getElementById('main-slides-container')
    const remixContainers = document.querySelectorAll('.remix-slides-container')

    if (!mainContainer) return

    // Store all containers for syncing
    const allContainers = [mainContainer, ...Array.from(remixContainers)]
    let isScrolling = false

    const syncScroll = (sourceContainer: Element) => {
      if (isScrolling) return
      isScrolling = true

      const scrollLeft = sourceContainer.scrollLeft
      const scrollRatio = scrollLeft / (sourceContainer.scrollWidth - sourceContainer.clientWidth)

      allContainers.forEach(container => {
        if (container !== sourceContainer) {
          const targetScrollLeft = scrollRatio * (container.scrollWidth - container.clientWidth)
          container.scrollLeft = targetScrollLeft
        }
      })

      requestAnimationFrame(() => {
        isScrolling = false
      })
    }

    // Add scroll listeners to all containers
    const scrollListeners = allContainers.map(container => {
      const listener = () => syncScroll(container)
      container.addEventListener('scroll', listener, { passive: true })
      return { container, listener }
    })

    // Cleanup function
    return () => {
      scrollListeners.forEach(({ container, listener }) => {
        container.removeEventListener('scroll', listener)
      })
    }
  })

  return <>{children}</>
}