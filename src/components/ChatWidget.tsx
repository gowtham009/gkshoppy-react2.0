import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/api';
import { ChatMessage } from '../types';

interface ChatResponse {
  conversationId: string;
  message: string;
}

interface ChatWidgetProps {
  onSignIn: () => void;
}

export default function ChatWidget({ onSignIn }: ChatWidgetProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const messageList = useRef<HTMLDivElement>(null);
  const userId = user?.id;

  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
    setError('');
    if (!userId) return;

    let active = true;
    void apiRequest<{ conversationId: string; messages: ChatMessage[] } | null>('/chat')
      .then((conversation) => {
        if (!active || !conversation) return;
        setConversationId(conversation.conversationId);
        setMessages(conversation.messages);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load saved chat.');
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    messageList.current?.scrollTo({ top: messageList.current.scrollHeight });
  }, [messages, open]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setSending(true);
    try {
      const result = await apiRequest<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, conversationId }),
      });
      setConversationId(result.conversationId);
      setMessages((current) => [...current, { role: 'assistant', content: result.message }]);
    } catch (requestError: unknown) {
      setInput(text);
      setError(requestError instanceof Error ? requestError.message : 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation() {
    if (!conversationId) {
      setMessages([]);
      setError('');
      return;
    }
    try {
      await apiRequest(`/chat/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
      setConversationId(undefined);
      setMessages([]);
      setError('');
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete this chat.');
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <section
          aria-label="GK Shoppy customer support chat"
          className="mb-3 flex h-[min(34rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={19} />
              <div>
                <p className="text-sm font-semibold">GK Shoppy assistant</p>
                <p className="text-xs text-indigo-100">Product and craft support</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {user && messages.length > 0 && (
                <button
                  type="button"
                  aria-label="Delete saved conversation"
                  title="Delete saved conversation"
                  onClick={() => void deleteConversation()}
                  className="rounded-full p-1 hover:bg-indigo-500"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 hover:bg-indigo-500"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div ref={messageList} className="flex-1 space-y-3 overflow-y-auto p-4">
            {!user ? (
              <div className="rounded-xl bg-indigo-50 p-4 text-sm text-gray-700">
                <p>Sign in to chat with our assistant. Your chat messages are saved to your account.</p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Sign in
                </button>
              </div>
            ) : messages.length === 0 ? (
              <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">
                Hi! Ask me about our paper-craft products, materials, or shipping.
              </p>
            ) : (
              messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'ml-auto bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.content}
                </p>
              ))
            )}
            {sending && <p className="text-xs text-gray-500">Assistant is replying…</p>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>

          {user && (
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-100 p-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={2000}
                placeholder="Ask a question…"
                aria-label="Chat message"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send size={17} />
              </button>
            </form>
          )}
        </section>
      )}
      <button
        type="button"
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        onClick={() => setOpen((value) => !value)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
      >
        {open ? <X size={22} /> : <MessageCircle size={23} />}
      </button>
    </div>
  );
}
