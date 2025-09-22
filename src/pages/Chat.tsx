import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Send, MessageSquare, Plus, Trash2, Loader2, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMaxAvatar } from '@/hooks/useMaxAvatar';

interface Message {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  tokens: number;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const Chat = () => {
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(Math.random().toString(36).substring(7));

  const { avatarUrl } = useMaxAvatar();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Verificar se o usuário é admin
  useEffect(() => {
    const checkAdminStatus = () => {
      if (!user?.email) return;
      
      // Verificar se o email é do Charles Wellington Andrade
      if (user.email === 'cwa.andrade@gmail.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };

    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
    }
  }, [user?.email]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar conversas",
        description: "Não foi possível carregar o histórico.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data as Message[] || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  useEffect(() => {
    if (conversations.length > 0 && !currentConversation) {
      setCurrentConversation(conversations[0].id);
      loadMessages(conversations[0].id);
    }
  }, [conversations, currentConversation, loadMessages]);

  const createNewConversation = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'Nova Conversa',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCurrentConversation(data.id);
      setMessages([]);
      setConversations(prev => [data, ...prev]);
    } catch (error) {
      toast({
        title: "Erro ao criar conversa",
        description: "Não foi possível criar uma nova conversa.",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      let conversationId = currentConversation;

      // Create conversation if none exists
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: user?.id,
            title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
          })
          .select()
          .single();

        if (convError) throw convError;
        
        conversationId = newConv.id;
        setCurrentConversation(conversationId);
        setConversations(prev => [newConv, ...prev]);
      }

      // Add user message to UI
      const userMsgData: Message = {
        id: Date.now().toString(),
        conversation_id: conversationId,
        content: userMessage,
        role: 'user',
        tokens: 0,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsgData]);

      // Create empty AI message for streaming
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: Message = {
        id: aiMessageId,
        conversation_id: conversationId,
        content: '',
        role: 'assistant',
        tokens: 0,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMessage]);

      // Start streaming
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('https://dcrbacdjfbgpvzbbcwws.supabase.co/functions/v1/chat-ai', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmJhY2RqZmJncHZ6YmJjd3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDEzMjMsImV4cCI6MjA3MTUxNzMyM30.5ovxFfO1orfUbc3LUrRyDl3vMjENetMaaqV6DmQ-BWA',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
          conversationId
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              loadConversations();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content && parsed.type === 'chunk') {
                accumulatedContent += parsed.content;
                
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              }
            } catch (parseError) {
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível processar sua mensagem.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar de Conversas */}
        <div className="w-80 border-r bg-card">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversas</h2>
              <Button onClick={createNewConversation} size="sm" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-73px)]">
            <div className="p-2 space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setCurrentConversation(conversation.id);
                    loadMessages(conversation.id);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-accent ${
                    currentConversation === conversation.id 
                      ? 'bg-accent text-accent-foreground' 
                      : 'text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{conversation.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Área Principal do Chat */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b p-4 flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              {avatarUrl && (
                <img src={avatarUrl} alt="Max Avatar" className="w-8 h-8 rounded-full" />
              )}
              <span className="font-semibold">Max - Assistente Fiscaltech</span>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
          </div>

          {/* Mensagens */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input de Mensagem */}
          <div className="border-t p-4 bg-card">
            <div className="max-w-4xl mx-auto flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="flex-1"
                disabled={loading}
              />
              <Button 
                onClick={sendMessage} 
                disabled={!inputValue.trim() || loading}
                size="icon"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;