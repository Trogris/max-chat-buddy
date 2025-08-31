import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const GlobalModelSelector = () => {
  const [currentModel, setCurrentModel] = useState<string>('gpt-4.1-2025-04-14');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4.1-2025-04-14');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const modelOptions = [
    {
      value: 'gpt-5-2025-08-07',
      label: 'GPT-5',
      description: 'Modelo mais avançado disponível',
      type: 'premium'
    },
    {
      value: 'gpt-5-mini-2025-08-07',
      label: 'GPT-5 Mini',
      description: 'Mais rápido e eficiente',
      type: 'premium'
    },
    {
      value: 'gpt-4.1-2025-04-14',
      label: 'GPT-4.1',
      description: 'Modelo principal recomendado',
      type: 'standard'
    },
    {
      value: 'gpt-4.1-mini-2025-04-14',
      label: 'GPT-4.1 Mini',
      description: 'Equilibrio entre velocidade e qualidade',
      type: 'standard'
    },
    {
      value: 'o3-2025-04-16',
      label: 'O3',
      description: 'Raciocínio avançado',
      type: 'reasoning'
    },
    {
      value: 'o4-mini-2025-04-16',
      label: 'O4 Mini',
      description: 'Raciocínio rápido',
      type: 'reasoning'
    },
    {
      value: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      description: 'Modelo legado',
      type: 'legacy'
    }
  ];

  const loadCurrentModel = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_settings')
        .select('current_model')
        .single();

      if (error) {
        console.error('Erro ao buscar modelo atual:', error);
        return;
      }

      const model = data?.current_model || 'gpt-4.1-2025-04-14';
      setCurrentModel(model);
      setSelectedModel(model);
    } catch (error) {
      console.error('Erro ao carregar modelo atual:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateGlobalModel = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('ai_settings')
        .update({ 
          current_model: selectedModel,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .single();

      if (error) {
        throw error;
      }

      setCurrentModel(selectedModel);
      
      toast({
        title: "Modelo atualizado com sucesso",
        description: `Todos os usuários agora usarão o modelo ${modelOptions.find(m => m.value === selectedModel)?.label || selectedModel}`,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar modelo:', error);
      toast({
        title: "Erro ao atualizar modelo",
        description: error.message || "Falha ao salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadCurrentModel();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const currentModelInfo = modelOptions.find(m => m.value === currentModel);
  const selectedModelInfo = modelOptions.find(m => m.value === selectedModel);
  const hasChanges = currentModel !== selectedModel;

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'premium': return 'default';
      case 'reasoning': return 'secondary';
      case 'legacy': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status atual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Modelo Atual em Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{currentModelInfo?.label || currentModel}</p>
              <p className="text-sm text-muted-foreground">{currentModelInfo?.description}</p>
            </div>
            <Badge variant={getBadgeVariant(currentModelInfo?.type || 'standard')}>
              {currentModelInfo?.type === 'premium' && 'Premium'}
              {currentModelInfo?.type === 'reasoning' && 'Raciocínio'}
              {currentModelInfo?.type === 'legacy' && 'Legado'}
              {currentModelInfo?.type === 'standard' && 'Padrão'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de novo modelo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alterar Modelo Global</CardTitle>
          <CardDescription>
            Este modelo será usado por todos os usuários do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg">
              {modelOptions.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.label}</span>
                      <Badge 
                        variant={getBadgeVariant(model.type)} 
                        className="text-xs"
                      >
                        {model.type === 'premium' && 'Premium'}
                        {model.type === 'reasoning' && 'Raciocínio'}
                        {model.type === 'legacy' && 'Legado'}
                        {model.type === 'standard' && 'Padrão'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasChanges && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Alteração pendente:</strong> {selectedModelInfo?.label} será aplicado a todos os usuários
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={updateGlobalModel}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Aplicar Modelo Global
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalModelSelector;