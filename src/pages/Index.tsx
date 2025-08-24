import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, BarChart3, Shield } from 'lucide-react';
import maxAvatar from '@/assets/max-avatar.png';

const Index = () => {
  const { user, loading } = useAuth();
  
  console.log('Index - rendering:', { user: !!user, loading });

  if (loading) {
    console.log('Index - showing loading state');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    console.log('Index - user authenticated, redirecting to chat');
    return <Navigate to="/chat" replace />;
  }

  console.log('Index - showing landing page');
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
              <img 
                src={maxAvatar} 
                alt="Max - Assistente Virtual da Fiscaltech" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">Max, seu assistente virtual na Fiscaltech</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Te ajudo com perguntas frequentes sobre procedimentos e processos
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth">Acessar o Sistema</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Atendimento 24/7</h3>
            <p className="text-muted-foreground">
              Disponível a qualquer momento para esclarecer dúvidas e fornecer suporte.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Análise de Uso</h3>
            <p className="text-muted-foreground">
              Sistema completo de métricas e estatísticas para gestores.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Seguro e Confiável</h3>
            <p className="text-muted-foreground">
              Todas as conversas são registradas e protegidas com segurança empresarial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
