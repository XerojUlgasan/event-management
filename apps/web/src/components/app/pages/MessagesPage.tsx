import { useCallback, useEffect, useState } from "react"

import {
  getAdminConversation,
  getAdminConversations,
  sendAdminMessage,
  type ChatConversation,
  type ChatThread,
} from "../../../lib/api"
import { MessagesWorkspace } from "../messages/MessagesWorkspace"
import { mergeThread } from "../messages/thread"

export function MessagesPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [listError, setListError] = useState("")
  const [threadError, setThreadError] = useState("")
  const [conversationOpen, setConversationOpen] = useState(false)

  const loadList = useCallback(async () => {
    try {
      const result = await getAdminConversations()
      setConversations(result.conversations)
      setListError("")
      setActiveId((current) =>
        current && result.conversations.some((item) => item.id === current) ? current : null,
      )
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : "Unable to load conversations.")
    } finally {
      setLoadingList(false)
    }
  }, [])

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
        listEmpty={{
          title: "No customer messages yet",
          body: "When a customer messages your team, the conversation will appear here.",
        }}
        threadEmpty={{
          title: "No messages yet",
          body: "Send the first reply to start this conversation.",
        }}
      />
    </div>
  )
}
