'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  X,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Palette,
  Flame,
  Lightbulb,
  User,
  Loader2,
  MessageSquare,
  History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/SmartImage'
import { getProxiedImageUrlById } from '@/lib/image-proxy'
import { Streamdown } from 'streamdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokensUsed?: number
  streaming?: boolean
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  timestamp: Date
  postIds: string[]
}

interface SelectedPost {
  id: string
  authorHandle: string
  authorAvatarId?: string
  description?: string
  contentType?: string
  images?: any[]
}

interface ContentAnalysisSidebarProps {
  isOpen: boolean
  onClose: () => void
  selectedPosts: SelectedPost[]
  onRemovePost: (postId: string) => void
  onClearSelection?: () => void
}

const PRESET_PROMPTS = [
  {
    icon: Target,
    label: 'Common Hooks',
    prompt: 'Analyze the opening slides (first 1-2 slides) of these posts. What are the common patterns in hooks that grab attention? What makes them effective?',
    color: 'text-blue-600'
  },
  {
    icon: TrendingUp,
    label: 'Engagement Patterns',
    prompt: 'Compare the engagement metrics (like rate, comment rate, share rate) across these posts. What content characteristics correlate with higher engagement?',
    color: 'text-green-600'
  },
  {
    icon: Palette,
    label: 'Visual Styles',
    prompt: 'Analyze the visual descriptions and design elements across these posts. What are the common visual styles, color schemes, and layouts that appear?',
    color: 'text-purple-600'
  },
  {
    icon: Flame,
    label: 'Trending Topics',
    prompt: 'Extract and analyze the main themes, topics, and hashtags from these posts. What are the trending subjects and how are they being presented?',
    color: 'text-orange-600'
  },
  {
    icon: Lightbulb,
    label: 'Content Strategy',
    prompt: 'Based on the performance and characteristics of these posts, what content strategy recommendations can you provide? What should I create more of?',
    color: 'text-yellow-600'
  }
]

export function ContentAnalysisSidebar({
  isOpen,
  onClose,
  selectedPosts,
  onRemovePost
}: ContentAnalysisSidebarProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [totalTokens, setTotalTokens] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chatSessions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setChatSessions(parsed.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        })))
      } catch (e) {
        console.error('Failed to load chat sessions:', e)
      }
    }
  }, [])

  // Save current session when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const currentSession: ChatSession = {
        id: Date.now().toString(),
        title: messages[0]?.content.substring(0, 50) + '...' || 'New Chat',
        messages,
        timestamp: new Date(),
        postIds: selectedPosts.map(p => p.id)
      }

      // Update or add session
      setChatSessions(prev => {
        const updated = [currentSession, ...prev.filter((_, i) => i < 9)] // Keep last 10
        localStorage.setItem('chatSessions', JSON.stringify(updated))
        return updated
      })
    }
  }, [messages, selectedPosts])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSendMessage = async (promptText?: string) => {
    const messageText = promptText || input.trim()
    if (!messageText || isStreaming || selectedPosts.length === 0) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    // Add empty assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/tiktok/posts/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postIds: selectedPosts.map(p => p.id),
          prompt: messageText,
          conversationHistory: messages.slice(-10) // Last 5 exchanges
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze posts')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let accumulatedContent = ''
      let messageTokens = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.chunk) {
                accumulatedContent += parsed.chunk
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                )
              }

              if (parsed.tokensUsed) {
                messageTokens = parsed.tokensUsed
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }

      // Finalize message
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, streaming: false, tokensUsed: messageTokens }
            : msg
        )
      )

      setTotalTokens(prev => prev + messageTokens)
    } catch (error) {
      console.error('Failed to analyze posts:', error)
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: '❌ Failed to analyze posts. Please try again.',
                streaming: false
              }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handlePresetClick = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div
      className={cn(
        "h-screen flex-shrink-0 bg-card border-l border-border flex flex-col",
        "transition-all duration-300 ease-in-out",
        isOpen ? "w-[400px]" : "w-0 border-l-0 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Content Analysis</h2>
            {selectedPosts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedPosts.length} selected
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Selected Posts Preview */}
        {selectedPosts.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-background">
            <ScrollArea className="w-full h-[200px]">
              <div className="space-y-2 pr-4">
                {selectedPosts.map(post => {
                  // Get first OCR text or description snippet
                  const snippet = post.description 
                    ? post.description.substring(0, 60) + (post.description.length > 60 ? '...' : '')
                    : 'Photo carousel'
                  
                  // Get first image if available
                  const firstImage = Array.isArray(post.images) && post.images.length > 0 
                    ? post.images[0] 
                    : null

                  return (
                    <div
                      key={post.id}
                      className="flex items-start gap-2 p-2 bg-secondary/50 rounded-lg group hover:bg-secondary transition-colors"
                    >
                      {/* Thumbnail */}
                      {firstImage?.cacheAssetId ? (
                        <SmartImage
                          src={getProxiedImageUrlById(firstImage.cacheAssetId)}
                          alt="Post thumbnail"
                          className="w-12 h-16 rounded object-cover flex-shrink-0"
                        />
                      ) : post.authorAvatarId ? (
                        <SmartImage
                          src={getProxiedImageUrlById(post.authorAvatarId)}
                          alt={post.authorHandle}
                          className="w-12 h-16 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-medium truncate">@{post.authorHandle}</span>
                          {Array.isArray(post.images) && post.images.length > 1 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {post.images.length}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {snippet}
                        </p>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemovePost(post.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'history')} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-0 pt-0 rounded-0">
          <TabsList className="w-full rounded-0">
            <TabsTrigger value="chat" className="flex-1 rounded-0">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 rounded-0">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Chat Tab Content */}
        <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Start Analyzing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select posts from the table and use the preset prompts or ask your own questions to discover trends and insights.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(message => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-4 py-2',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>
                    )}
                    {message.streaming && (
                      <div className="flex items-center gap-1 mt-2">
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    {message.tokensUsed && !message.streaming && (
                      <div className="text-xs opacity-70 mt-1">
                        {message.tokensUsed} tokens
                      </div>
                    )}
                  </div>
                </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* History Tab Content */}
        <TabsContent value="history" className="flex-1 overflow-hidden m-0 flex flex-col">
          {chatSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
              <History className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Chat History</h3>
              <p className="text-sm text-muted-foreground">
                Your recent chats will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-4 py-2 space-y-2">
                {chatSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setMessages(session.messages)
                      setActiveTab('chat')
                    }}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium text-sm truncate mb-1">
                      {session.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.messages.length} messages • {new Date(session.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {session.postIds.length} posts analyzed
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Preset Buttons */}
      {messages.length === 0 && selectedPosts.length > 0 && (
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {PRESET_PROMPTS.map((preset, index) => {
              const Icon = preset.icon
              return (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset.prompt)}
                  disabled={isStreaming}
                  className="justify-start h-auto py-2"
                >
                  <Icon className={cn('w-4 h-4 mr-2', preset.color)} />
                  <span className="text-xs">{preset.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border bg-background flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedPosts.length === 0
                ? 'Select posts to analyze...'
                : 'Ask about the selected posts...'
            }
            disabled={selectedPosts.length === 0 || isStreaming}
            className="resize-none min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isStreaming || selectedPosts.length === 0}
            size="icon"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        {totalTokens > 0 && (
          <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
            <span>{totalTokens.toLocaleString()} tokens used this session</span>
            {totalTokens > 10000 && (
              <Badge variant="destructive" className="text-xs">
                High usage
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
