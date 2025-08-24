import { useState, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { 
  MessageSquare, 
  Send, 
  LogOut, 
  Plus, 
  Trash2, 
  Settings,
  Loader2,
  Menu
} from 'lucide-react';
import maxAvatar from '@/assets/max-avatar.png';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  conversation_id?: string;
  tokens?: number;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function Chat() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const ensureUserProfile = async () => {
    if (!user) return;

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!existingProfile) {
        await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name: user.email?.split('@')[0] || 'Usuário',
            role: 'admin'
          });
      }
    } catch (error) {
      console.error('Erro ao criar perfil:', error);
    }
  };

  useEffect(() => {
    if (user) {
      ensureUserProfile();
      loadConversations();
      trackSession();
    }
  }, [user]);

  // Auto-select first conversation if none is selected
  useEffect(() => {
    if (conversations.length > 0 && !currentConversation) {
      setCurrentConversation(conversations[0].id);
      loadMessages(conversations[0].id);
    }
  }, [conversations, currentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const trackSession = async () => {
    if (!user) return;
    
    try {
      await supabase.from('usage_stats').insert({
        user_id: user.id,
        session_id: sessionId,
        messages_count: 0,
        tokens_count: 0,
      });
    } catch (error) {
      console.error('Error tracking session:', error);
    }
  };

  const updateSessionStats = async (messageCount: number, tokenCount: number) => {
    if (!user) return;
    
    try {
      await supabase
        .from('usage_stats')
        .update({
          messages_count: messageCount,
          tokens_count: tokenCount,
          session_end: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error updating session stats:', error);
    }
  };

  const loadConversations = async () => {
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
  };

  const loadMessages = async (conversationId: string) => {
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
  };

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
      loadConversations();
    } catch (error) {
      toast({
        title: "Erro ao criar conversa",
        description: "Não foi possível criar uma nova conversa.",
        variant: "destructive",
      });
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      if (currentConversation === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
      
      loadConversations();
      toast({
        title: "Conversa excluída",
        description: "A conversa foi removida com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir conversa",
        description: "Não foi possível excluir a conversa.",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !currentConversation || !user || loading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      // Add user message to database
      const { data: userMsgData, error: userMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversation,
          content: userMessage,
          role: 'user',
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Update messages state
      setMessages(prev => [...prev, userMsgData as Message]);

      // Prepare conversation history for AI context (last 10 messages)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('Enviando para AI com histórico:', {
        message: userMessage,
        historyLength: conversationHistory.length
      });

      // Call AI with conversation history
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat-ai', {
        body: {
          message: userMessage,
          conversationHistory: conversationHistory,
          conversationId: currentConversation,
        }
      });

      console.log('Resposta da AI:', aiResponse, aiError);

      if (aiError) throw aiError;

      // Normalize AI response shape
      // If the Edge Function returned an error in the body, surface it
      if (aiResponse && typeof aiResponse === 'object' && 'error' in aiResponse && (aiResponse as any).error) {
        throw new Error((aiResponse as any).error);
      }

      const answerText = (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse)
        ? (aiResponse as any).response
        : (typeof aiResponse === 'string' ? aiResponse : (
            aiResponse && typeof aiResponse === 'object' && 'generatedText' in aiResponse
              ? (aiResponse as any).generatedText
              : null
          ));

      const tokensUsed = (aiResponse && typeof aiResponse === 'object' && 'tokens' in aiResponse)
        ? (aiResponse as any).tokens || 0
        : 0;

      if (!answerText) {
        console.warn('AI returned unexpected payload:', aiResponse);
        const fallback = 'Não consegui gerar uma resposta agora. Tente novamente em instantes.';
        // Show fallback to the user
        const aiMessage: Message = {
          id: Math.random().toString(),
          content: fallback,
          role: 'assistant',
          created_at: new Date().toISOString(),
          conversation_id: currentConversation,
          tokens: 0,
        };
        setMessages(prev => [...prev, aiMessage]);
        return;
      }

      // Add AI response to database
      const { data: aiMsgData, error: aiMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversation,
          content: answerText,
          role: 'assistant',
          tokens: tokensUsed,
        })
        .select()
        .single();

      if (aiMsgError) {
        console.error('Erro ao salvar mensagem AI:', aiMsgError);
        // Even if DB save fails, show the message to user
        const aiMessage: Message = {
          id: Math.random().toString(),
          content: answerText,
          role: 'assistant',
          created_at: new Date().toISOString(),
          conversation_id: currentConversation,
          tokens: tokensUsed
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Update messages state
        setMessages(prev => [...prev, aiMsgData as Message]);
      }

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        await supabase
          .from('conversations')
          .update({ title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '') })
          .eq('id', currentConversation);
        loadConversations();
      }

      // Update session stats
      await updateSessionStats(messages.length + 2, tokensUsed);

    } catch (error: any) {
      console.error('Erro completo:', error);
      
      // Show error message in chat
      const errorMessage: Message = {
        id: Math.random().toString(),
        content: `Erro: ${error.message || 'Não foi possível processar sua mensagem. Tente novamente.'}`,
        role: 'assistant',
        created_at: new Date().toISOString(),
        conversation_id: currentConversation,
        tokens: 0
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Ocorreu um erro inesperado.",
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Max</h1>
        </div>
        <Button onClick={createNewConversation} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Nova Conversa
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 rounded-lg cursor-pointer group hover:bg-sidebar-accent flex items-center justify-between ${
                currentConversation === conv.id ? 'bg-sidebar-accent' : ''
              }`}
              onClick={() => {
                setCurrentConversation(conv.id);
                loadMessages(conv.id);
                if (isMobile) setDrawerOpen(false);
              }}
            >
              <span className="text-sm truncate flex-1">{conv.title}</span>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <span className="truncate flex-1">{user.email}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to="/admin">
              <Settings className="h-4 w-4 mr-2" />
              Admin
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-80 bg-sidebar border-r">
          <SidebarContent />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header with Menu */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Max</h1>
            </div>
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="h-[80vh] bg-sidebar">
                  <SidebarContent />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        )}
        {currentConversation ? (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[70%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <img 
                            src={maxAvatar} 
                            alt="Max" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div
                        className={`p-4 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-chat-user text-foreground'
                            : 'bg-chat-assistant text-foreground border'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <img 
                          src={maxAvatar} 
                          alt="Max" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-chat-assistant border p-4 rounded-lg flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Max está pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-3 sm:p-4 border-t bg-background/95 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto flex gap-2">
                <Input
                  placeholder="Digite sua mensagem para o Max..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  className="flex-1 h-10 sm:h-10"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={loading || !inputValue.trim()}
                  className="h-10 px-3 sm:px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Bem-vindo ao Max</h2>
            <p className="text-muted-foreground">
              Selecione uma conversa ou crie uma nova para começar
            </p>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}