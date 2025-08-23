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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['.csv', '.xls', '.xlsx', '.pdf', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas arquivos CSV, XLS, XLSX, PDF e TXT são aceitos.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Read file content
      const content = await readFileContent(file);
      
      const { error } = await supabase
        .from('company_documents')
        .insert({
          filename: file.name,
          content: content,
          file_type: fileExtension,
          uploaded_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Documento enviado com sucesso",
        description: `${file.name} foi adicionado à base de conhecimento.`,
      });

      loadDocuments();
      
      // Clear input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: "Erro ao enviar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file, 'UTF-8');
    });
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
              Formatos aceitos: CSV, XLS, XLSX, PDF, TXT
            </p>
            <Input
              type="file"
              accept=".csv,.xls,.xlsx,.pdf,.txt"
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