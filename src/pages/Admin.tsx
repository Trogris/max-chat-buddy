import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import DocumentManager from '@/components/DocumentManager';
import { 
  Users, 
  MessageSquare, 
  BarChart3, 
  ArrowLeft, 
  Loader2,
  Bot,
  Clock,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Edit,
  Check,
  X,
  Database,
  FileText,
  Zap
} from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  role: string;
  created_at: string;
  user_id: string;
  area?: string;
  preferred_model?: string;
}

interface UsageStats {
  total_messages: number;
  total_tokens: number;
  active_users: number;
}

interface MaxKPIs {
  usuariosAtivos: {
    dia: number;
    semana: number;
    mes: number;
  };
  conversas: {
    totalSessoes: number;
    totalMensagens: number;
    mediaPorUsuario: number;
  };
  engajamento: {
    picoHorario: string;
    usuarioMaisAtivo: string;
    sessoesPorDia: number;
  };
  qualidade: {
    taxaSucesso: number;
    perguntasSemResposta: number;
    respostasCompletas: number;
  };
  performance: {
    tempoMedioResposta: number;
    errosRegistrados: number;
    disponibilidade: number;
  };
  consumo: {
    tokensProcessados: number;
    custoEstimado: number;
    modeloMaisUsado: string;
  };
  acessosPorArea: { area: string; acessos: number }[];
}

export default function Admin() {
  const { user, loading: authLoading, signOut } = useAuth();

  // Função helper para formatar tempo
  const formatarTempo = (ms: number): string => {
    if (ms < 1000) {
      return `${ms} ms`;
    }
    return `${(ms / 1000).toFixed(1)} s`;
  };

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<UsageStats>({ total_messages: 0, total_tokens: 0, active_users: 0 });
  const [maxKPIs, setMaxKPIs] = useState<MaxKPIs>({
    usuariosAtivos: { dia: 0, semana: 0, mes: 0 },
    conversas: { totalSessoes: 0, totalMensagens: 0, mediaPorUsuario: 0 },
    engajamento: { picoHorario: '14:00-15:00', usuarioMaisAtivo: 'N/A', sessoesPorDia: 0 },
    qualidade: { taxaSucesso: 0, perguntasSemResposta: 0, respostasCompletas: 0 },
    performance: { tempoMedioResposta: 0, errosRegistrados: 0, disponibilidade: 99.9 },
    consumo: { tokensProcessados: 0, custoEstimado: 0, modeloMaisUsado: 'gpt-4.1-2025-04-14' },
    acessosPorArea: []
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [ragStats, setRagStats] = useState({
    totalDocuments: 0,
    totalChunks: 0,
    documentsWithChunks: 0,
    avgChunksPerDoc: 0
  });
  const [loadingRagStats, setLoadingRagStats] = useState(true);
  const [ingestingAll, setIngestingAll] = useState(false);

  const areas = [
    'Não informado',
    'Produção e MI',
    'Engenharia', 
    'Implantação',
    'Operação e Suporte',
    'Comercial',
    'RH',
    'Orçamentos',
    'Suprimentos',
    'Escritório da Qualidade',
    'P&D'
  ];

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      loadProfiles();
      loadStats();
      loadMaxKPIs();
      loadRagStats();
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

  const calculateMostUsedModel = () => {
    const modelCounts: { [key: string]: number } = {};
    
    profiles.forEach(profile => {
      const model = profile.preferred_model || 'gpt-4.1-2025-04-14';
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    });

    let mostUsedModel = 'gpt-4.1-2025-04-14';
    let maxCount = 0;

    Object.entries(modelCounts).forEach(([model, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedModel = model;
      }
    });

    return mostUsedModel;
  };

  const loadMaxKPIs = async () => {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Usuários ativos por período (baseado em conversas atualizadas no período)
      const { data: convDia } = await supabase
        .from('conversations')
        .select('user_id, updated_at')
        .gte('updated_at', oneDayAgo.toISOString());
      const usuariosDia = new Set((convDia || []).map(c => c.user_id)).size;

      const { data: convSemana } = await supabase
        .from('conversations')
        .select('user_id, updated_at')
        .gte('updated_at', oneWeekAgo.toISOString());
      const usuariosSemana = new Set((convSemana || []).map(c => c.user_id)).size;

      const { data: convMes } = await supabase
        .from('conversations')
        .select('user_id, updated_at')
        .gte('updated_at', oneMonthAgo.toISOString());
      const usuariosMes = new Set((convMes || []).map(c => c.user_id)).size;

      // Total de conversas e mensagens
      const { count: totalSessoes } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      const { count: totalMensagens } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      // Métricas de qualidade
      const { count: totalPerguntas } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user');

      const { count: respostasCompletas } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'assistant')
        .not('content', 'ilike', 'Erro:%');

      // Tokens processados
      const { data: tokenData } = await supabase
        .from('usage_stats')
        .select('tokens_count');

      const tokensProcessados = tokenData?.reduce((sum, stat) => sum + (stat.tokens_count || 0), 0) || 0;

      // Performance (últimos 30 dias)
      const { data: usageStatsPeriod } = await supabase
        .from('usage_stats')
        .select('response_time_ms, error_count, session_start')
        .gte('session_start', oneMonthAgo.toISOString());

      const tempos = (usageStatsPeriod || [])
        .map((u) => u.response_time_ms || 0)
        .filter((t) => t > 0);
      const tempoMedioResposta = tempos.length
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : 0;
      const errosRegistrados = (usageStatsPeriod || [])
        .reduce((sum, u) => sum + (u.error_count || 0), 0);


      // Acessos por área (últimos 30 dias)
      const { data: convPeriodo } = await supabase
        .from('conversations')
        .select('user_id, updated_at')
        .gte('updated_at', oneMonthAgo.toISOString());
      const userIdsPeriodo = Array.from(new Set((convPeriodo || []).map(c => c.user_id)));
      const { data: perfisPeriodo } = await supabase
        .from('profiles')
        .select('user_id, area')
        .in('user_id', userIdsPeriodo);
      const areaDeUsuario = new Map((perfisPeriodo || []).map(p => [p.user_id, p.area || 'Não informado']));
      const areaMap: Record<string, number> = {};
      for (const conv of convPeriodo || []) {
        const area = areaDeUsuario.get(conv.user_id) || 'Não informado';
        areaMap[area] = (areaMap[area] || 0) + 1;
      }
      const acessosPorArea = Object.entries(areaMap)
        .map(([area, acessos]) => ({ area, acessos }))
        .sort((a, b) => b.acessos - a.acessos);

      // Cálculo do pico horário (últimos 30 dias)
      const { data: mensagensPeriodo } = await supabase
        .from('messages')
        .select('created_at')
        .gte('created_at', oneMonthAgo.toISOString());
      
      const horaMap: Record<number, number> = {};
      (mensagensPeriodo || []).forEach(msg => {
        const hora = new Date(msg.created_at).getHours();
        horaMap[hora] = (horaMap[hora] || 0) + 1;
      });
      
      const picoHora = Object.entries(horaMap)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
      const picoHorario = picoHora 
        ? `${picoHora.toString().padStart(2, '0')}:00-${(parseInt(picoHora) + 1).toString().padStart(2, '0')}:00`
        : 'N/A';

      // Usuario mais ativo (últimos 30 dias)
      const { data: conversasComUsuario } = await supabase
        .from('conversations')
        .select('user_id, updated_at')
        .gte('updated_at', oneMonthAgo.toISOString());
      
      const usuarioMap: Record<string, number> = {};
      (conversasComUsuario || []).forEach(conv => {
        usuarioMap[conv.user_id] = (usuarioMap[conv.user_id] || 0) + 1;
      });
      
      const usuarioMaisAtivoId = Object.entries(usuarioMap)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
      
      let usuarioMaisAtivo = 'N/A';
      if (usuarioMaisAtivoId) {
        const { data: perfilAtivo } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', usuarioMaisAtivoId)
          .single();
        usuarioMaisAtivo = perfilAtivo?.name || 'Usuário Anônimo';
      }

      const mediaPorUsuario = stats.active_users > 0 ? Math.round((totalMensagens || 0) / stats.active_users) : 0;
      const totalPerguntasCount = totalPerguntas || 0;
      const taxaSucesso = totalPerguntasCount > 0 ? Math.round(((respostasCompletas || 0) / totalPerguntasCount) * 100) : 0;
      const perguntasSemResposta = Math.max(0, totalPerguntasCount - (respostasCompletas || 0));
      const custoEstimado = tokensProcessados * 0.0001; // Estimativa simplificada

      setMaxKPIs({
        usuariosAtivos: {
          dia: usuariosDia || 0,
          semana: usuariosSemana || 0,
          mes: usuariosMes || 0
        },
        conversas: {
          totalSessoes: totalSessoes || 0,
          totalMensagens: totalMensagens || 0,
          mediaPorUsuario
        },
        engajamento: {
          picoHorario,
          usuarioMaisAtivo,
          sessoesPorDia: Math.round((totalSessoes || 0) / 30)
        },
        qualidade: {
          taxaSucesso,
          perguntasSemResposta,
          respostasCompletas: respostasCompletas || 0
        },
        performance: {
          tempoMedioResposta,
          errosRegistrados,
          disponibilidade: 99.9
        },
        consumo: {
          tokensProcessados,
          custoEstimado,
          modeloMaisUsado: calculateMostUsedModel()
        },
        acessosPorArea
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar KPIs do Max",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateUserArea = async (userId: string, area: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ area })
        .eq('user_id', userId);

      if (error) throw error;

      setProfiles(profiles.map(profile => 
        profile.user_id === userId ? { ...profile, area } : profile
      ));
      
      toast({
        title: "Área atualizada",
        description: "A área do usuário foi atualizada com sucesso.",
      });
      
      // Recarregar KPIs para atualizar estatísticas por área
      loadMaxKPIs();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar área",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateUserModel = async (userId: string, model: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_model: model })
        .eq('user_id', userId);

      if (error) throw error;

      setProfiles(profiles.map(profile => 
        profile.user_id === userId ? { ...profile, preferred_model: model } : profile
      ));
      
      toast({
        title: "Modelo atualizado",
        description: "O modelo preferido do usuário foi atualizado com sucesso.",
      });
      
      // Recarregar KPIs para atualizar estatísticas do modelo mais usado
      loadMaxKPIs();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar modelo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadRagStats = async () => {
    try {
      setLoadingRagStats(true);
      
      // Buscar estatísticas dos documentos
      const { data: documents, error: docsError } = await supabase
        .from('company_documents')
        .select('id');
      
      const { data: chunks, error: chunksError } = await supabase
        .from('company_document_chunks')
        .select('document_id');

      if (docsError) throw docsError;
      if (chunksError) throw chunksError;

      const totalDocuments = documents?.length || 0;
      const totalChunks = chunks?.length || 0;
      
      // Contar documentos únicos que têm chunks
      const documentsWithChunks = chunks ? 
        new Set(chunks.map(c => c.document_id)).size : 0;
      
      const avgChunksPerDoc = documentsWithChunks > 0 ? 
        Math.round((totalChunks / documentsWithChunks) * 10) / 10 : 0;

      setRagStats({
        totalDocuments,
        totalChunks,
        documentsWithChunks,
        avgChunksPerDoc
      });

    } catch (error: any) {
      console.error('Erro ao carregar estatísticas do RAG:', error);
    } finally {
      setLoadingRagStats(false);
    }
  };

  const ingestAllDocuments = async () => {
    try {
      setIngestingAll(true);
      
      // Buscar todos os documentos
      const { data: documents, error } = await supabase
        .from('company_documents')
        .select('id');

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast({
          title: "Nenhum documento encontrado",
          description: "Adicione documentos antes de executar a ingestão.",
          variant: "destructive",
        });
        return;
      }

      const documentIds = documents.map(doc => doc.id);

      toast({
        title: "Ingestão iniciada",
        description: `Processando ${documentIds.length} documentos para busca semântica...`,
      });

      // Chamar função de ingestão
      const { data, error: ingestError } = await supabase.functions.invoke('ingest-documents', {
        body: { document_ids: documentIds }
      });

      if (ingestError) throw ingestError;

      toast({
        title: "Ingestão concluída",
        description: `${data.total_chunks} chunks criados para ${data.processed_documents} documentos.`,
      });

      // Recarregar estatísticas
      await loadRagStats();

    } catch (error: any) {
      console.error('Erro na ingestão completa:', error);
      toast({
        title: "Erro na ingestão",
        description: error.message || "Falha ao processar documentos.",
        variant: "destructive",
      });
    } finally {
      setIngestingAll(false);
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
                <Link to="/chat">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Chat
                </Link>
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
        <Tabs defaultValue="max-kpis" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="max-kpis">KPIs do Max</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="models">Modelos</TabsTrigger>
          </TabsList>

          <TabsContent value="max-kpis" className="space-y-6 mt-6">
            {/* Usuários Ativos */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários Ativos
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Hoje</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.usuariosAtivos.dia}</div>
                    <p className="text-xs text-muted-foreground">usuários únicos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Esta Semana</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.usuariosAtivos.semana}</div>
                    <p className="text-xs text-muted-foreground">usuários únicos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Este Mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.usuariosAtivos.mes}</div>
                    <p className="text-xs text-muted-foreground">usuários únicos</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Conversas Realizadas */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversas Realizadas
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de Sessões</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.conversas.totalSessoes}</div>
                    <p className="text-xs text-muted-foreground">conversas iniciadas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de Mensagens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.conversas.totalMensagens}</div>
                    <p className="text-xs text-muted-foreground">mensagens trocadas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Média por Usuário</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.conversas.mediaPorUsuario}</div>
                    <p className="text-xs text-muted-foreground">mensagens/usuário</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Engajamento */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Engajamento
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pico de Uso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{maxKPIs.engajamento.picoHorario}</div>
                    <p className="text-xs text-muted-foreground">horário mais ativo</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Usuário Mais Ativo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{maxKPIs.engajamento.usuarioMaisAtivo}</div>
                    <p className="text-xs text-muted-foreground">maior engajamento</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sessões/Dia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.engajamento.sessoesPorDia}</div>
                    <p className="text-xs text-muted-foreground">média diária</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Qualidade das Respostas */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Qualidade das Respostas
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taxa de Sucesso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.qualidade.taxaSucesso}%</div>
                    <p className="text-xs text-muted-foreground">respostas concluídas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sem Resposta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.qualidade.perguntasSemResposta}</div>
                    <p className="text-xs text-muted-foreground">perguntas não respondidas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Respostas Completas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.qualidade.respostasCompletas}</div>
                    <p className="text-xs text-muted-foreground">respostas geradas</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Performance Técnica */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Performance Técnica
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tempo Médio de Resposta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatarTempo(maxKPIs.performance.tempoMedioResposta)}</div>
                    <p className="text-xs text-muted-foreground">tempo de processamento (últimas 4 semanas)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Erros Registrados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.performance.errosRegistrados}</div>
                    <p className="text-xs text-muted-foreground">erros no período</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Disponibilidade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.performance.disponibilidade}%</div>
                    <p className="text-xs text-muted-foreground">uptime do sistema</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Consumo & Custos */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Consumo & Custos
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tokens Processados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maxKPIs.consumo.tokensProcessados.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">tokens de IA utilizados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Custo Estimado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${maxKPIs.consumo.custoEstimado.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">custo aproximado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Modelo Mais Usado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{maxKPIs.consumo.modeloMaisUsado}</div>
                    <p className="text-xs text-muted-foreground">modelo principal</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Acessos por Área */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Acessos por Área (últimos 30 dias)
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {maxKPIs.acessosPorArea.length ? (
                  maxKPIs.acessosPorArea.map((item) => (
                    <Card key={item.area}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{item.area}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{item.acessos}</div>
                        <p className="text-xs text-muted-foreground">acessos no período</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
                )}
              </div>
            </div>
          </TabsContent>

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
            {/* Estatísticas do Sistema RAG */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingRagStats ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      ragStats.totalDocuments
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chunks Indexados</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingRagStats ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      ragStats.totalChunks
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Docs Processados</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingRagStats ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      ragStats.documentsWithChunks
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    de {ragStats.totalDocuments} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Chunks/Doc</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingRagStats ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      ragStats.avgChunksPerDoc
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controles do Sistema RAG */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Controles do Sistema RAG
                </CardTitle>
                <CardDescription>
                  Gerencie a ingestão e processamento dos documentos para busca semântica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Reprocessar Todos os Documentos</h3>
                    <p className="text-sm text-muted-foreground">
                      Executa chunking e geração de embeddings para todos os documentos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ragStats.documentsWithChunks === ragStats.totalDocuments && ragStats.totalDocuments > 0 && (
                      <Badge variant="secondary">✅ Completo</Badge>
                    )}
                    {ragStats.documentsWithChunks < ragStats.totalDocuments && ragStats.totalDocuments > 0 && (
                      <Badge variant="destructive">⚠️ Pendente</Badge>
                    )}
                    <Button
                      onClick={ingestAllDocuments}
                      disabled={ingestingAll || ragStats.totalDocuments === 0}
                      className="flex items-center gap-2"
                    >
                      {ingestingAll ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4" />
                          Reprocessar Tudo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                      <div className="flex-1">
                        <p className="font-medium">{profile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Criado em {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Área: {profile.area || 'Não informado'} | Modelo: {profile.preferred_model || 'gpt-4.1-2025-04-14'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            profile.role === 'admin' 
                              ? 'bg-primary/10 text-primary' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {profile.role === 'admin' ? 'Administrador' : 'Usuário'}
                          </span>
                        </div>
                        <div className="min-w-[200px]">
                          <Select
                            value={profile.preferred_model || 'gpt-4.1-2025-04-14'}
                            onValueChange={(value) => updateUserModel(profile.user_id, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg">
                              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                              <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini</SelectItem>
                              <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1</SelectItem>
                              <SelectItem value="o4-mini-2025-04-16">O4 Mini</SelectItem>
                              <SelectItem value="o3-2025-04-16">O3</SelectItem>
                              <SelectItem value="gpt-5-mini-2025-08-07">GPT-5 Mini</SelectItem>
                              <SelectItem value="gpt-5-2025-08-07">GPT-5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-[150px]">
                          <Select
                            value={profile.area || 'Não informado'}
                            onValueChange={(value) => updateUserArea(profile.user_id, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg">
                              <SelectItem value="Não informado">Não informado</SelectItem>
                              <SelectItem value="Produção e MI">Produção e MI</SelectItem>
                              <SelectItem value="Engenharia">Engenharia</SelectItem>
                              <SelectItem value="Implantação">Implantação</SelectItem>
                              <SelectItem value="Operação e Suporte">Operação e Suporte</SelectItem>
                              <SelectItem value="Comercial">Comercial</SelectItem>
                              <SelectItem value="RH">RH</SelectItem>
                              <SelectItem value="Orçamentos">Orçamentos</SelectItem>
                              <SelectItem value="Suprimentos">Suprimentos</SelectItem>
                              <SelectItem value="Escritório da Qualidade">Escritório da Qualidade</SelectItem>
                              <SelectItem value="P&D">P&D</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Modelos</CardTitle>
                <CardDescription>
                  Configure os modelos de IA preferidos para cada usuário (apenas administradores)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isAdmin ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Acesso restrito a administradores</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">ℹ️ Informações sobre os Modelos</h4>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p><strong>GPT-5:</strong> Modelo mais avançado disponível</p>
                        <p><strong>GPT-5 Mini:</strong> Versão mais rápida e econômica do GPT-5</p>
                        <p><strong>GPT-4.1:</strong> Modelo principal recomendado para uso geral</p>
                        <p><strong>O3/O4:</strong> Modelos especializados em raciocínio complexo</p>
                      </div>
                    </div>
                    
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{profile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Modelo atual: {profile.preferred_model || 'gpt-4.1-2025-04-14'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Área: {profile.area || 'Não informado'}
                          </p>
                        </div>
                        <div className="min-w-[250px]">
                          <Select
                            value={profile.preferred_model || 'gpt-4.1-2025-04-14'}
                            onValueChange={(value) => updateUserModel(profile.user_id, value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg">
                              <SelectItem value="gpt-5-2025-08-07">
                                <div className="flex flex-col">
                                  <span>GPT-5</span>
                                  <span className="text-xs text-muted-foreground">Modelo mais avançado</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-5-mini-2025-08-07">
                                <div className="flex flex-col">
                                  <span>GPT-5 Mini</span>
                                  <span className="text-xs text-muted-foreground">Mais rápido e eficiente</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4.1-2025-04-14">
                                <div className="flex flex-col">
                                  <span>GPT-4.1</span>
                                  <span className="text-xs text-muted-foreground">Modelo principal recomendado</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4.1-mini-2025-04-14">
                                <div className="flex flex-col">
                                  <span>GPT-4.1 Mini</span>
                                  <span className="text-xs text-muted-foreground">Equilibrio entre velocidade e qualidade</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="o3-2025-04-16">
                                <div className="flex flex-col">
                                  <span>O3</span>
                                  <span className="text-xs text-muted-foreground">Raciocínio avançado</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="o4-mini-2025-04-16">
                                <div className="flex flex-col">
                                  <span>O4 Mini</span>
                                  <span className="text-xs text-muted-foreground">Raciocínio rápido</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4o-mini">
                                <div className="flex flex-col">
                                  <span>GPT-4o Mini</span>
                                  <span className="text-xs text-muted-foreground">Modelo legado</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}