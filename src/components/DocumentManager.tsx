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
import { processFile } from '@/utils/processFile';

interface Document {
  id: string;
  filename: string;
  file_type: string;
  mime_type?: string;
  size_bytes?: number;
  pages?: number;
  sheets?: any; // Json from Supabase can be string[] or other formats
  truncated?: boolean;
  content_hash: string;
  created_at: string;
}

export default function DocumentManager() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Limites conforme solicitado
  const MAX_FILES = 10;
  const MAX_TOTAL_SIZE_MB = 100;
  const MAX_FILE_SIZE_MB = 20;
  const CHUNK_LIMIT = 100_000;
  const SUPABASE_BATCH = 100;
  const allowedExts = ['.csv', '.xls', '.xlsx', '.pdf', '.txt', '.docx'];
  
  const toExt = (name: string) => '.' + (name.split('.').pop()?.toLowerCase() || '');
  const hashString = async (s: string) => {
    const data = new TextEncoder().encode(s);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_documents')
        .select('id, filename, file_type, mime_type, size_bytes, pages, sheets, truncated, content_hash, created_at')
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
    const files = Array.from(event.target.files || []);
    
    if (!user || files.length === 0) return;

    // Validações básicas
    if (files.length > MAX_FILES) {
      toast({
        title: "Muitos arquivos",
        description: `Máximo ${MAX_FILES} arquivos por vez.`,
        variant: "destructive",
      });
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);
    if (totalSizeMB > MAX_TOTAL_SIZE_MB) {
      toast({
        title: "Arquivos muito grandes",
        description: `Tamanho total máximo: ${MAX_TOTAL_SIZE_MB}MB. Atual: ${totalSizeMB.toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    const oversizedFile = files.find(file => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversizedFile) {
      toast({
        title: "Arquivo muito grande",
        description: `${oversizedFile.name} excede ${MAX_FILE_SIZE_MB}MB`,
        variant: "destructive",
      });
      return;
    }

    const invalid = files.find(f => !allowedExts.includes(toExt(f.name)));
    if (invalid) {
      toast({ title: 'Tipo não suportado', description: invalid.name, variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Processamento em paralelo
      const results = await Promise.allSettled(files.map(async (file) => {
        const processed = await processFile(file);
        const content = (processed.text || '').slice(0, CHUNK_LIMIT);
        const signature = await hashString(`${file.name}:${file.size}:${content.slice(0, 2048)}`);
        return {
          filename: file.name,
          file_type: toExt(file.name),
          mime_type: processed.meta.type ?? file.type,
          size_bytes: processed.meta.size ?? file.size,
          pages: processed.meta.pages ?? null,
          sheets: processed.meta.sheets ?? null,
          truncated: processed.meta.truncated ?? content.length >= CHUNK_LIMIT,
          content,
          content_hash: signature,
          uploaded_by: user.id,
        };
      }));

      const successes = results.filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length) {
        toast({ title: 'Alguns arquivos falharam', description: `${failures.length} falha(s)`, variant: 'destructive' });
        console.warn('Falhas:', failures);
      }

      if (successes.length === 0) {
        toast({ title: 'Nada a enviar', description: 'Nenhum arquivo válido.' });
        event.target.value = '';
        return;
      }

      // Deduplicação pelo hash
      const hashes = successes.map(s => s.content_hash);
      const { data: existing, error: qErr } = await supabase
        .from('company_documents')
        .select('content_hash')
        .in('content_hash', hashes);
      if (qErr) console.warn('Checagem de duplicados falhou:', qErr);

      const existingSet = new Set((existing || []).map((e: any) => e.content_hash));
      const toInsert = successes.filter(s => !existingSet.has(s.content_hash));

      if (toInsert.length === 0) {
        toast({ title: 'Nenhuma novidade', description: 'Todos já estavam no banco.' });
        event.target.value = '';
        return;
      }

      // Inserir em lotes
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += SUPABASE_BATCH) {
        const chunk = toInsert.slice(i, i + SUPABASE_BATCH);
        const { error } = await supabase.from('company_documents').insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }

      toast({ title: 'Upload concluído', description: `${inserted} arquivo(s) inserido(s).` });
      await loadDocuments();
      event.target.value = '';
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro no upload', description: err?.message || 'Erro desconhecido', variant: 'destructive' });
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
            <p className="text-sm text-muted-foreground mb-2">
              Aceita: TXT, CSV, XLS, XLSX, PDF, DOCX (até {MAX_FILE_SIZE_MB}MB cada)
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Máximo: {MAX_FILES} arquivos, {MAX_TOTAL_SIZE_MB}MB total • Deduplicação automática
            </p>
            <Input
              type="file"
              accept=".csv,.xls,.xlsx,.pdf,.txt,.docx"
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{doc.filename}</span>
                        {doc.truncated && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Truncado</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {doc.file_type} • {doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)}KB` : ''} 
                        {doc.pages ? ` • ${doc.pages} pág.` : ''}
                        {doc.sheets && Array.isArray(doc.sheets) ? ` • ${doc.sheets.length} plan.` : ''}
                        • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </div>
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