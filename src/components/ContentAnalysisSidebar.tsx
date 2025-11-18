"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  History,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getProxiedImageUrlById } from "@/lib/image-proxy"
import { Streamdown } from "streamdown"
import { toast } from "sonner"
import {
  Conversation,
  GeminiModel,
  Message as ConversationMessage,
} from "@/types/conversation"
import {
  calculateCost,
  formatCost,
  getContextPercentage,
  getModelDisplayName,
  formatTokens,
} from "@/lib/cost-calculation-service"

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
  onRestorePosts?: (postIds: string[]) => void
}

const PRESET_PROMPTS = [
  {
    icon: Target,
    label: "Common Hooks",
    prompt:
      "Analyze the opening slides (first 1-2 slides) of these posts. What are the common patterns in hooks that grab attention? What makes them effective?",
    color: "text-blue-600",
  },
  {
    icon: TrendingUp,
    label: "Engagement Patterns",
    prompt:
      "Compare the engagement metrics (like rate, comment rate, share rate) across these posts. What content characteristics correlate with higher engagement?",
    color: "text-green-600",
  },
  {
    icon: Palette,
    label: "Visual Styles",
    prompt:
      "Analyze the visual descriptions and design elements across these posts. What are the common visual styles, color schemes, and layouts that appear?",
    color: "text-purple-600",
  },
  {
    icon: Flame,
    label: "Trending Topics",
    prompt:
      "Extract and analyze the main themes, topics, and hashtags from these posts. What are the trending subjects and how are they being presented?",
    color: "text-orange-600",
  },
  {
    icon: Lightbulb,
    label: "Content Strategy",
    prompt:
      "Based on the performance and characteristics of these posts, what content strategy recommendations can you provide? What should I create more of?",
    color: "text-yellow-600",
  },
]

const MODELS: { value: GeminiModel; label: string }[] = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-thinking", label: "Gemini 2.5 Flash (Thinking)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-flash-lite-thinking", label: "Gemini 2.5 Flash Lite (Thinking)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-pro-thinking", label: "Gemini 2.5 Pro (Thinking)" },
]

export function ContentAnalysisSidebar({
  isOpen,
  onClose,
  selectedPosts,
  onRemovePost,
  onClearSelection,
  onRestorePosts,
}: ContentAnalysisSidebarProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat")
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(
    "gemini-2.5-flash"
  )
  const [contextPercentage, setContextPercentage] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [totalInputTokens, setTotalInputTokens] = useState(0)
  const [totalOutputTokens, setTotalOutputTokens] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations()
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`
    }
  }, [input])

  const fetchConversations = async () => {
    try {
      const response = await fetch("/api/conversations")
      if (!response.ok) throw new Error("Failed to fetch conversations")
      const data = await response.json()
      setConversations(data)
    } catch (error) {
      console.error("Failed to fetch conversations:", error)
    }
  }

  const handleLoadConversation = async (conversation: Conversation) => {
    setMessages(conversation.messages)
    setCurrentConversationId(conversation.id)
    setSelectedModel(conversation.currentModel as GeminiModel)
    setTotalCost(conversation.totalCost)
    setTotalInputTokens(conversation.totalInputTokens)
    setTotalOutputTokens(conversation.totalOutputTokens)
    setActiveTab("chat")

    // Restore posts if callback provided
    if (onRestorePosts) {
      onRestorePosts(conversation.selectedPostIds)
    }
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete conversation")

      // Refresh conversations
      await fetchConversations()

      // If deleting current conversation, clear it
      if (currentConversationId === id) {
        setMessages([])
        setCurrentConversationId(null)
        setTotalCost(0)
        setTotalInputTokens(0)
        setTotalOutputTokens(0)
      }

      toast.success("Conversation deleted")
    } catch (error) {
      console.error("Failed to delete conversation:", error)
      toast.error("Failed to delete conversation")
    }
  }

  const handleSendMessage = async (promptText?: string) => {
    const messageText = promptText || input.trim()
    if (!messageText || isStreaming || selectedPosts.length === 0) return

    setIsStreaming(true)
    setInput("")

    // Create placeholder for streaming response
    const userMessage: ConversationMessage = {
      role: "user",
      content: messageText,
      model: selectedModel,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      timestamp: new Date().toISOString(),
    }

    const assistantMessageId = Date.now().toString()
    const assistantMessage: ConversationMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      model: selectedModel,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])

    try {
      const response = await fetch("/api/tiktok/posts/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: currentConversationId,
          postIds: selectedPosts.map((p) => p.id),
          prompt: messageText,
          model: selectedModel,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze posts")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      let accumulatedContent = ""
      let thinkingContent = ""
      let messageInputTokens = 0
      let messageOutputTokens = 0
      let messageCost = 0
      let newConversationId = currentConversationId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === "chunk") {
                accumulatedContent += parsed.content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                )
              }

              if (parsed.type === "thinking") {
                thinkingContent += parsed.content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, thinking: thinkingContent }
                      : msg
                  )
                )
              }

              if (parsed.type === "usage") {
                messageInputTokens = parsed.inputTokens
                messageOutputTokens = parsed.outputTokens
                messageCost = parsed.cost

                // Update context percentage
                setContextPercentage(getContextPercentage(messageInputTokens, selectedModel))

                // Update totals
                setTotalInputTokens(
                  (prev) => prev + messageInputTokens
                )
                setTotalOutputTokens(
                  (prev) => prev + messageOutputTokens
                )
                setTotalCost((prev) => prev + messageCost)

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          inputTokens: messageInputTokens,
                          outputTokens: messageOutputTokens,
                          cost: messageCost,
                        }
                      : msg
                  )
                )
              }

              if (parsed.type === "conversationId") {
                newConversationId = parsed.id
                setCurrentConversationId(parsed.id)
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e)
            }
          }
        }
      }

      // Refresh conversations to get updated data
      await fetchConversations()
    } catch (error) {
      console.error("Failed to analyze posts:", error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "❌ Failed to analyze posts. Please try again.",
              }
            : msg
        )
      )
      toast.error("Failed to analyze posts")
    } finally {
      setIsStreaming(false)
    }
  }

  const handlePresetClick = (prompt: string) => {
    handleSendMessage(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div
      className={cn(
        "h-screen flex-shrink-0 bg-card border-l border-border flex flex-col",
        "transition-all duration-300 ease-in-out",
        isOpen ? "w-[420px]" : "w-0 border-l-0 overflow-hidden"
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

        {/* Model Selector */}
        <div className="px-4 py-3 border-b border-border bg-background">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            AI Model
          </label>
          <Select
            value={selectedModel}
            onValueChange={(value) =>
              setSelectedModel(value as GeminiModel)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Context Progress Bar */}
        {messages.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-background space-y-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                Context Usage
              </label>
              <span className="text-xs font-mono text-muted-foreground">
                {contextPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={contextPercentage}
              className="h-2"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                Total Cost:{" "}
                <span className="font-semibold">{formatCost(totalCost)}</span>
              </div>
              <div>
                Tokens:{" "}
                <span className="font-semibold">
                  {formatTokens(totalInputTokens)} in /
                  {formatTokens(totalOutputTokens)} out
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Selected Posts Preview */}
        {selectedPosts.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-background">
            <ScrollArea className="w-full h-[180px]">
              <div className="space-y-2 pr-4">
                {selectedPosts.map((post) => {
                  const snippet = post.description
                    ? post.description.substring(0, 60) +
                      (post.description.length > 60 ? "..." : "")
                    : "Photo carousel"

                  const firstImage =
                    Array.isArray(post.images) && post.images.length > 0
                      ? post.images[0]
                      : null

                  return (
                    <div
                      key={post.id}
                      className="flex items-start gap-2 p-2 bg-secondary/50 rounded-lg group hover:bg-secondary transition-colors"
                    >
                      {firstImage?.cacheAssetId ? (
                        <img
                          src={getProxiedImageUrlById(
                            firstImage.cacheAssetId
                          )}
                          alt="Post thumbnail"
                          className="w-12 h-16 rounded object-cover flex-shrink-0"
                        />
                      ) : post.authorAvatarId ? (
                        <img
                          src={getProxiedImageUrlById(post.authorAvatarId)}
                          alt={post.authorHandle}
                          className="w-12 h-16 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-medium truncate">
                            @{post.authorHandle}
                          </span>
                          {Array.isArray(post.images) &&
                            post.images.length > 1 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4"
                              >
                                {post.images.length}
                              </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {snippet}
                        </p>
                      </div>

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
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "chat" | "history")}
        className="flex-1 flex flex-col overflow-hidden"
      >
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
                  Select posts from the table and use the preset prompts or ask
                  your own questions to discover trends and insights.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={`${message.timestamp}-${message.role}`}
                    className={cn(
                      "flex",
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-4 py-2",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      ) : (
                        <div>
                          {message.thinking && (
                            <details className="mb-3 cursor-pointer">
                              <summary className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:opacity-80">
                                Show thinking
                              </summary>
                              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs whitespace-pre-wrap text-amber-900 dark:text-amber-100 max-h-32 overflow-y-auto">
                                {message.thinking}
                              </div>
                            </details>
                          )}
                          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                            <Streamdown>{message.content}</Streamdown>
                          </div>
                        </div>
                      )}

                      {/* Cost and token badge */}
                      {message.role === "assistant" &&
                        message.cost > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-current/10">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0.5 h-5"
                            >
                              {formatCost(message.cost)}
                            </Badge>
                            <span className="text-xs opacity-70">
                              {formatTokens(message.inputTokens)} in /
                              {formatTokens(message.outputTokens)} out
                            </span>
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
          {conversations.length === 0 ? (
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
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="group p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <button
                      onClick={() => handleLoadConversation(conversation)}
                      className="w-full text-left"
                    >
                      <div className="font-medium text-sm truncate mb-1">
                        {conversation.title || "Untitled"}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          {conversation.messages.length} messages
                        </div>
                        <div>
                          {new Date(conversation.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="font-mono">
                          {formatCost(conversation.totalCost)}
                        </div>
                        <div>
                          {conversation.selectedPostIds.length} posts
                        </div>
                        <div className="text-xs">
                          {getModelDisplayName(
                            conversation.currentModel as GeminiModel
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteConversation(conversation.id)
                      }
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                  <Icon className={cn("w-4 h-4 mr-2", preset.color)} />
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedPosts.length === 0
                ? "Select posts to analyze..."
                : "Ask about the selected posts..."
            }
            disabled={selectedPosts.length === 0 || isStreaming}
            className="resize-none min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={
              !input.trim() ||
              isStreaming ||
              selectedPosts.length === 0
            }
            size="icon"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
