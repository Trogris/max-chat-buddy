import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import DocumentManager from '@/components/DocumentManager';
import { 
  Users, 
  MessageSquare, 
  BarChart3, 
  ArrowLeft, 
  Loader2 
} from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  role: string;
  created_at: string;
  user_id: string;
}

interface UsageStats {
  total_messages: number;
  total_tokens: number;
  active_users: number;
}

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<UsageStats>({ total_messages: 0, total_tokens: 0, active_users: 0 });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      loadProfiles();
      loadStats();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (data?.role !== 'admin') {
        setIsAdmin(false);
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive",
        });
      } else {
        setIsAdmin(true);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadStats = async () => {
    try {
      // Get message count
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      // Get token count
      const { data: tokenData } = await supabase
        .from('usage_stats')
        .select('tokens_count');

      const totalTokens = tokenData?.reduce((sum, stat) => sum + (stat.tokens_count || 0), 0) || 0;

      // Get active users (users who have sent messages)
      const { data: activeUsersData } = await supabase
        .from('conversations')
        .select('user_id', { count: 'exact' });

      const activeUsers = new Set(activeUsersData?.map(conv => conv.user_id) || []).size;

      setStats({
        total_messages: messageCount || 0,
        total_tokens: totalTokens,
        active_users: activeUsers,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estatísticas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <a href="/chat">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Chat
                </a>
              </Button>
              <h1 className="text-2xl font-bold">Painel Administrativo</h1>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_messages}</div>
                  <p className="text-xs text-muted-foreground">
                    Mensagens processadas pelo Max
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tokens Utilizados</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_tokens.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Tokens de IA processados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.active_users}</div>
                  <p className="text-xs text-muted-foreground">
                    Usuários que utilizaram o Max
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-6">
            <DocumentManager />
          </TabsContent>

          <TabsContent value="users" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Usuários Cadastrados</CardTitle>
                <CardDescription>
                  Lista de todos os usuários do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{profile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Criado em {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          profile.role === 'admin' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {profile.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}