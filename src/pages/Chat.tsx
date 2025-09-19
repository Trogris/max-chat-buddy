import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Send, MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMaxAvatar } from '@/hooks/useMaxAvatar';
import { GlobalModelSelector } from '@/components/GlobalModelSelector';
import { DocumentManager } from '@/components/DocumentManager';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(Math.random().toString(36).substring(7));

  const { avatarUrl } = useMaxAvatar();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar className="w-80">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversas</h2>
              <Button onClick={createNewConversation} size="sm" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <ScrollArea className="flex-1">
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      onClick={() => {
                        setCurrentConversation(conversation.id);
                        loadMessages(conversation.id);
                      }}
                      isActive={currentConversation === conversation.id}
                      className="w-full justify-start p-2 group"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <span className="truncate flex-1 text-left">
                        {conversation.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <div className="border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                {avatarUrl && (
                  <img src={avatarUrl} alt="Max Avatar" className="w-8 h-8 rounded-full" />
                )}
                <span className="font-semibold">Max - Assistente Fiscaltech</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlobalModelSelector />
              <DocumentManager />
            </div>
          </div>

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
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-4">
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
    </SidebarProvider>
  );
};

export default Chat;