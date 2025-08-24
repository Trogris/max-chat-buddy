import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Upload, Trash2, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Document {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
}

export default function DocumentManager() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Limites conforme solicitado
  const MAX_FILES = 10;
  const MAX_TOTAL_SIZE_MB = 200;
  const MAX_FILE_SIZE_MB = 50;

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_documents')
        .select('id, filename, file_type, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar documentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!user || files.length === 0) return;

    console.log('Iniciando upload de', files.length, 'arquivos');

    // Validações básicas
    if (files.length > MAX_FILES) {
      toast({
        title: `Limite excedido`,
        description: `Máximo ${MAX_FILES} arquivos por vez.`,
        variant: 'destructive',
      });
      return;
    }

    // Calcular tamanho total
    const totalSizeMB = files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
    if (totalSizeMB > MAX_TOTAL_SIZE_MB) {
      toast({
        title: `Tamanho total excede ${MAX_TOTAL_SIZE_MB}MB`,
        description: `Total atual: ${Math.round(totalSizeMB)}MB`,
        variant: 'destructive',
      });
      return;
    }

    // Verificar arquivos muito grandes individualmente
    const oversizeFile = files.find(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversizeFile) {
      toast({
        title: `Arquivo muito grande`,
        description: `${oversizeFile.name} excede ${MAX_FILE_SIZE_MB}MB`,
        variant: 'destructive',
      });
      return;
    }

    // Verificar tipos suportados
    const allowedExts = ['.csv', '.xls', '.xlsx', '.pdf', '.txt'];
    const invalidFile = files.find(f => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() || '');
      return !allowedExts.includes(ext);
    });
    
    if (invalidFile) {
      toast({
        title: 'Tipo não suportado',
        description: `${invalidFile.name} não é suportado.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const documentsToInsert = [];

      for (const file of files) {
        try {
          console.log('Processando arquivo:', file.name);
          
          // Ler conteúdo como texto simples por enquanto
          const content = await readFileAsText(file);
          
          documentsToInsert.push({
            filename: file.name,
            content: content.slice(0, 100000), // Limitar conteúdo a 100k caracteres
            file_type: '.' + (file.name.split('.').pop()?.toLowerCase() || ''),
            uploaded_by: user.id,
          });

          console.log('Arquivo processado com sucesso:', file.name);
        } catch (err: any) {
          console.error('Erro ao processar', file.name, ':', err);
          toast({
            title: `Erro em ${file.name}`,
            description: err?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }

      if (documentsToInsert.length > 0) {
        console.log('Inserindo', documentsToInsert.length, 'documentos no banco');
        
        const { error } = await supabase
          .from('company_documents')
          .insert(documentsToInsert);

        if (error) {
          console.error('Erro no Supabase:', error);
          throw error;
        }

        toast({
          title: 'Upload concluído!',
          description: `${documentsToInsert.length} arquivo(s) carregados com sucesso.`,
        });

        loadDocuments();
      }

      event.target.value = '';
    } catch (error: any) {
      console.error('Erro geral no upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('company_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Documento removido",
        description: "O documento foi removido da base de conhecimento.",
      });

      loadDocuments();
    } catch (error: any) {
      toast({
        title: "Erro ao remover documento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Gestão de Documentos
        </CardTitle>
        <CardDescription>
          Gerencie os documentos da empresa que servem como base de conhecimento para o Max
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
          <div className="text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-4">
              Até {MAX_FILES} arquivos • Total máx. {MAX_TOTAL_SIZE_MB}MB • CSV, XLS, XLSX, PDF, TXT
            </p>
            <Input
              type="file"
              accept=".csv,.xls,.xlsx,.pdf,.txt"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="max-w-xs mx-auto"
            />
            {uploading && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Enviando...</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum documento encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type.toUpperCase()} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteDocument(doc.id)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}