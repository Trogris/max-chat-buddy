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
import * as XLSX from 'xlsx';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
// Vite: import worker URL
// @ts-ignore - pdfjs provides worker as URL
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';
GlobalWorkerOptions.workerSrc = pdfWorker;
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

  // Limits
  const MAX_FILES = 10;
  const MAX_SIZE_MB = 10;
  const MAX_CONTENT_CHARS = 200000;

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
    const files = Array.from(event.target.files || []);
    if (!user || files.length === 0) return;

    if (files.length > MAX_FILES) {
      toast({
        title: `Limite de ${MAX_FILES} arquivos por envio`,
        description: `Selecione até ${MAX_FILES} arquivos por vez.`,
        variant: 'destructive',
      });
      return;
    }

    const allowedExt = ['.csv', '.xls', '.xlsx', '.pdf', '.txt'];
    const oversize = files.find(f => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversize) {
      toast({
        title: `Arquivo muito grande`,
        description: `${oversize.name} excede ${MAX_SIZE_MB}MB.`,
        variant: 'destructive',
      });
      return;
    }

    const invalid = files.find(f => !allowedExt.includes('.' + (f.name.split('.').pop()?.toLowerCase() || '')));
    if (invalid) {
      toast({
        title: 'Tipo de arquivo não suportado',
        description: `${invalid.name} não é suportado. Use CSV, XLS, XLSX, PDF ou TXT.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const rows: any[] = [];

      for (const file of files) {
        try {
          const content = await extractContent(file);
          rows.push({
            filename: file.name,
            content: content.slice(0, MAX_CONTENT_CHARS),
            file_type: '.' + (file.name.split('.').pop()?.toLowerCase() || ''),
            uploaded_by: user.id,
          });
        } catch (err: any) {
          toast({
            title: `Erro ao processar ${file.name}`,
            description: err?.message || String(err),
            variant: 'destructive',
          });
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('company_documents').insert(rows);
        if (error) throw error;
        toast({ title: 'Upload concluído', description: `${rows.length} arquivo(s) adicionados.` });
        loadDocuments();
      }
      event.target.value = '';
    } catch (error: any) {
      toast({ title: 'Erro ao enviar documentos', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Helpers to extract text from different file types
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Erro ao ler arquivo (texto)'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo (binário)'));
      reader.readAsArrayBuffer(file);
    });
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
        .join(' ');
      text += `\n\n--- Página ${i} ---\n${pageText}`;
    }
    return text.trim();
  };

  const extractTextFromXLSX = async (file: File): Promise<string> => {
    const buffer = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    let out = '';
    wb.SheetNames.forEach((name) => {
      const ws = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(ws);
      out += `\n\n### Planilha: ${name}\n${csv}`;
    });
    return out.trim();
  };

  const extractContent = async (file: File): Promise<string> => {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (ext === '.pdf') return extractTextFromPDF(file);
    if (ext === '.xls' || ext === '.xlsx') return extractTextFromXLSX(file);
    return readFileAsText(file);
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
              Formatos: CSV, XLS, XLSX, PDF, TXT • até {MAX_FILES} arquivos por vez • máx. {MAX_SIZE_MB}MB cada
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