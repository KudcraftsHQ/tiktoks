import emojiRegex from 'emoji-regex'

export interface TextSegment {
  content: string
  isEmoji: boolean
}

/**
 * Splits text into segments of text and emojis
 * This is crucial for applying effects like outlines only to text, not emojis
 */
export function parseTextWithEmojis(text: string): TextSegment[] {
  const regex = emojiRegex()
  const segments: TextSegment[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before the emoji
    if (match.index > lastIndex) {
      segments.push({
        content: text.substring(lastIndex, match.index),
        isEmoji: false,
      })
    }

    // Add the emoji
    segments.push({
      content: match[0],
      isEmoji: true,
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      content: text.substring(lastIndex),
      isEmoji: false,
    })
  }

  return segments
}
