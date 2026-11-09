import { useCallback, useEffect, useRef, useState } from "react"

import {
  getAdminConversation,
  getAdminConversations,
  sendAdminMessage,
  type ChatConversation,
  type ChatThread,
} from "../../../lib/data/messages"
import { MessagesWorkspace } from "../messages/MessagesWorkspace"
import { mergeThread } from "../../../lib/services/merge-thread"

function mergeConversations(current: ChatConversation[], incoming: ChatConversation[], newestFirst: boolean) {
  const incomingIds = new Set(incoming.map((conversation) => conversation.id))
  const remaining = current.filter((conversation) => !incomingIds.has(conversation.id))
  return newestFirst ? [...incoming, ...remaining] : [...remaining, ...incoming]
}

export function MessagesPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [listError, setListError] = useState("")
  const [loadMoreError, setLoadMoreError] = useState("")
  const [threadError, setThreadError] = useState("")
  const [conversationOpen, setConversationOpen] = useState(false)
  const listBusy = useRef(false)
  const moreBusy = useRef(false)
  const hasLoadedMore = useRef(false)

  const loadList = useCallback(async () => {
    if (listBusy.current || moreBusy.current) return
    listBusy.current = true
    try {
      const result = await getAdminConversations()
      setConversations((current) => mergeConversations(current, result.conversations, true))
      if (!hasLoadedMore.current) setNextCursor(result.nextCursor)
      setListError("")
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : "Unable to load conversations.")
    } finally {
      listBusy.current = false
      setLoadingList(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextCursor || moreBusy.current || listBusy.current) return
    moreBusy.current = true
    setLoadingMore(true)
    setLoadMoreError("")
    try {
      const result = await getAdminConversations(nextCursor)
      setConversations((current) => mergeConversations(current, result.conversations, false))
      setNextCursor(result.nextCursor)
      hasLoadedMore.current = true
    } catch (cause) {
      setLoadMoreError(cause instanceof Error ? cause.message : "Unable to load more conversations.")
    } finally {
      moreBusy.current = false
      setLoadingMore(false)
    }
  }, [nextCursor])

  useEffect(() => {
    void loadList()
    const timer = window.setInterval(() => void loadList(), 5000)
    return () => window.clearInterval(timer)
  }, [loadList])

  const loadThread = useCallback(async (id: string) => {
    setLoadingThread(true)
    try {
      const result = await getAdminConversation(id)
      setThread((current) => mergeThread(current, result))
      setConversations((current) => current.map((item) => item.id === id ? result.conversation : item))
      setThreadError("")
    } catch (cause) {
      setThreadError(cause instanceof Error ? cause.message : "Unable to load this conversation.")
    } finally {
      setLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      setThread(null)
      return
    }
    setThread((current) => (current?.conversation.id === activeId ? current : null))
    void loadThread(activeId)
    const timer = window.setInterval(() => void loadThread(activeId), 5000)
    return () => window.clearInterval(timer)
  }, [activeId, loadThread])

  useEffect(() => {
    if (activeId || conversations.length === 0) return
    if (window.matchMedia("(min-width: 601px)").matches) setActiveId(conversations[0].id)
  }, [activeId, conversations])

  const send = async (body: string) => {
    if (!activeId) return
    const result = await sendAdminMessage(activeId, body)
    setThread((current) =>
      current && current.conversation.id === activeId
        ? {
            conversation: {
              ...current.conversation,
              status: "active",
              lastMessage: result.message,
              updatedAt: result.message.createdAt,
            },
            messages: [...current.messages, result.message],
          }
        : current,
    )
    void loadList()
  }

  return (
    <div className="content-stack admin-messages">
      <MessagesWorkspace
        title="Messages"
        viewerRole="admin"
        conversations={conversations}
        hasMore={!!nextCursor}
        loadingMore={loadingMore}
        loadMoreError={loadMoreError}
        onLoadMore={() => void loadMore()}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id)
          setConversationOpen(true)
        }}
        messages={thread?.messages ?? []}
        loading={
          (loadingList && !conversations.length) ||
          loadingThread ||
          (!!activeId && thread?.conversation.id !== activeId)
        }
        error={listError || threadError}
        onRetry={() => {
          if (activeId) {
            void loadThread(activeId)
          } else {
            setLoadingList(true)
            void loadList()
          }
        }}
        onSend={send}
        onBack={() => {
          setConversationOpen(false)
          setActiveId(null)
          setThread(null)
        }}
        conversationOpen={conversationOpen}
        readOnly={thread?.conversation.status === "closed"}
        listEmpty={{
          title: "No conversations yet",
          body: "Customer conversations will appear here when they are created.",
        }}
        threadEmpty={{
          title: "No messages yet",
          body: "Messages will appear here when the customer or team writes.",
        }}
      />
    </div>
  )
}
