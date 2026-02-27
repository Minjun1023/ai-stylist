
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { chatApi } from '../api/chat';
import { ChatMessage, ChatSession, RecommendationProduct } from '../types';
import {
  parseRecommendationProducts,
  resolvePreferredPurchaseUrl,
  saveRecommendationProducts,
  resolveDisplayBrand,
} from '../lib/recommendations';
import Loading from '../components/common/Loading';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import {
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

const resolvePurchaseUrl = (item: RecommendationProduct) =>
  resolvePreferredPurchaseUrl(
    item.purchaseUrl || item.purchase_url || item.link || item.url || '',
    item.title,
    item.brand,
  );

const isInvalidBrand = (value?: string) => {
  if (!value) {
    return true;
  }
  const normalized = value.toLowerCase().replace(/[\s\-_.]/g, '');
  if (!normalized) {
    return true;
  }
  if (normalized === '브랜드' || normalized === 'brand') {
    return true;
  }
  return ['브랜드a', '브랜드b', '브랜드c', 'branda', 'brandb', 'brandc'].includes(normalized);
};

const resolveProductBrand = (item: RecommendationProduct) =>
  isInvalidBrand(resolveDisplayBrand(item.brand))
    ? undefined
    : resolveDisplayBrand(item.brand);

const resolveProductLabel = (item: RecommendationProduct) =>
  resolveProductBrand(item) ? `${resolveProductBrand(item)} ${item.title}` : item.title || '추천 상품';

const resolveDescription = (item: RecommendationProduct) => {
  if (item.description && item.description.trim()) {
    return item.description.trim();
  }

  const parts: string[] = [];
  const resolvedBrand = resolveProductBrand(item);
  if (resolvedBrand) {
    parts.push(`${resolvedBrand}`);
  }
  if (item.price) {
    parts.push(`${item.price}`);
  } else if (item.priceRange || item.price_range) {
    parts.push(item.priceRange || item.price_range || '');
  }
  if (parts.length === 0) {
    return '추천 코디에 잘 어울리는 아이템입니다.';
  }
  return `${parts.join(' · ')} 아이템입니다.`;
};

const resolveDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const ChatPage: React.FC = () => {
  const { user, refreshCurrentUser } = useAuthStore();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [season, setSeason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await chatApi.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const data = await chatApi.getSession(sessionId);
      setCurrentSession(data);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const startNewChat = () => {
    setCurrentSession(null);
    setMessages([]);
  };

  const deleteSession = async (sessionId: number) => {
    if (!window.confirm('이 대화를 삭제하시겠습니까?')) return;

    try {
      await chatApi.deleteSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;
    if (!user?.personalColorCompleted) {
      window.alert('퍼스널컬러 진단을 완료하면 채팅 기능을 이용할 수 있습니다.');
      return;
    }
    if (!season.trim()) {
      window.alert('계절을 먼저 선택해주세요.');
      return;
    }

    const userMessage: ChatMessage = {
      sessionId: currentSession?.id || 0,
      messageId: Date.now(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await chatApi.sendMessage(input, season, currentSession?.id);
      await refreshCurrentUser();

      if (!currentSession) {
        setCurrentSession({ id: response.sessionId, title: input.slice(0, 30), createdAt: new Date().toISOString() });
        loadSessions();
      }

      const assistantMessage: ChatMessage = {
        sessionId: response.sessionId,
        messageId: response.messageId,
        role: 'assistant',
        content: response.content,
        sources: response.sources,
        items: response.items,
        createdAt: response.createdAt,
      };

      const parsedFromChat = parseRecommendationProducts({
        items: response.items,
        text: response.content,
      });
      if (parsedFromChat.length > 0) {
        saveRecommendationProducts(parsedFromChat, 'chat', undefined, user?.id);
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.slice(0, -1));
      window.alert('메시지 전송에 실패했습니다');
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) {
    return <Loading message="대화 목록을 불러오는 중..." />;
  }

  const hasPersonalColor = user?.personalColorCompleted === true;
  const isChatBlocked = user && !hasPersonalColor;

  return (
    <div className="mx-auto w-full max-w-5xl rounded-xl border border-gray-100 bg-white/95 p-1">
      {isChatBlocked && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          정확한 추천을 위해 먼저 퍼스널컬러를 먼저 진단해 주세요.
          <Link to="/personal-color" className="ml-1 font-semibold text-amber-700 underline underline-offset-2">
            퍼스널컬러 진단하러 가기
          </Link>
        </div>
      )}
      <div className="flex min-h-0 flex-col md:flex-row h-[calc(100vh-240px)] sm:h-[calc(100vh-230px)] md:h-[calc(100vh-220px)] rounded-xl overflow-hidden border border-gray-100">
        <Card className="flex min-h-0 w-full flex-col md:w-64 rounded-none border-b md:border-b-0 md:border-r border-gray-100 bg-[rgba(255,255,255,0.95)]">
          <div className="p-4 border-b border-gray-200">
            <Button onClick={startNewChat} className="w-full justify-center">
            <PlusIcon className="h-5 w-5 mr-2" />
            새 대화
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto max-h-52 md:max-h-none">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">대화 기록이 없습니다</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                  currentSession?.id === session.id ? 'bg-primary-50' : ''
                }`}
                onClick={() => loadSession(session.id)}
              >
                <div className="flex-1 truncate">
                  <div className="text-sm font-medium text-gray-900 truncate">{session.title}</div>
                  <div className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                  aria-label="대화 삭제"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col rounded-none border-l-0 md:rounded-l-none md:rounded-r-xl">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ChatBubbleLeftRightIcon className="h-16 w-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">AI 스타일리스트와 대화를 시작하세요</p>
                <p className="text-sm mt-2">
                  {user?.personalColor
                    ? `당신의 퍼스널 컬러(${user.personalColor})에 맞는 스타일을 추천해드릴게요!`
                    : '퍼스널 컬러 진단을 먼저 받으시면 더 정확한 추천을 받을 수 있어요'}
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-4 py-3 overflow-hidden ${
                      message.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    {message.items && message.items.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {message.items.map((item: RecommendationProduct, idx) => {
                          const title = resolveProductLabel(item);
                          const imageUrl = item.imageUrl || item.image_url;
                          const purchaseUrl = resolvePurchaseUrl(item);
                          if (!purchaseUrl) {
                            return null;
                          }

                          const description = resolveDescription(item);
                          const domain = resolveDomain(purchaseUrl);

                          return (
                            <a
                              key={`${title}-${idx}`}
                              href={purchaseUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex w-full max-w-full min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 hover:border-primary-300"
                            >
                              {imageUrl ? (
                                <img src={imageUrl} alt={title} className="h-12 w-12 rounded-md object-cover" />
                              ) : (
                                <div className="h-12 w-12 rounded-md bg-gray-100" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{title}</p>
                                <p className="truncate text-xs text-gray-600">{description}</p>
                                <p className="truncate text-[11px] text-gray-500">{domain}</p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

            <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-4">
              <select
                aria-label="계절"
                className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                <option value="">계절</option>
                <option value="봄">봄</option>
                <option value="여름">여름</option>
                <option value="가을">가을</option>
                <option value="겨울">겨울</option>
              </select>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                className="flex-1 resize-none bg-white/90"
                rows={1}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isSending}
                className="rounded-full w-11 h-11"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
	        </Card>
      </div>
	    </div>
	  );
	};

export default ChatPage;
