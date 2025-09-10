import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useMaxAvatar } from '@/hooks/useMaxAvatar';
import { Upload, RotateCcw, Loader2, ImageIcon } from 'lucide-react';

export default function MaxAvatarUpload() {
  const { avatarUrl, loading, uploadAvatar, resetToDefault } = useMaxAvatar();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro no upload',
        description: 'Por favor, selecione apenas arquivos de imagem.',
        variant: 'destructive'
      });
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro no upload',
        description: 'A imagem deve ter no máximo 5MB.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    
    try {
      const success = await uploadAvatar(file);
      
      if (success) {
        toast({
          title: 'Avatar atualizado!',
          description: 'O avatar do Max foi atualizado com sucesso.'
        });
      } else {
        toast({
          title: 'Erro no upload',
          description: 'Não foi possível fazer upload do avatar.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro no upload',
        description: 'Ocorreu um erro durante o upload.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      // Limpar o input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = async () => {
    setUploading(true);
    
    try {
      const success = await resetToDefault();
      
      if (success) {
        toast({
          title: 'Avatar restaurado!',
          description: 'O avatar padrão do Max foi restaurado.'
        });
      } else {
        toast({
          title: 'Erro ao restaurar',
          description: 'Não foi possível restaurar o avatar padrão.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao restaurar',
        description: 'Ocorreu um erro ao restaurar o avatar.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Avatar do Max
        </CardTitle>
        <CardDescription>
          Configure o avatar que aparece nas conversas do assistente Max
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview do avatar atual */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <img 
                src={avatarUrl} 
                alt="Avatar do Max" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback para avatar padrão se a imagem falhar
                  const target = e.target as HTMLImageElement;
                  if (target.src !== '/src/assets/max-avatar.png') {
                    target.src = '/src/assets/max-avatar.png';
                  }
                }}
              />
            )}
          </div>
          <div>
            <p className="font-medium">Avatar atual</p>
            <p className="text-sm text-muted-foreground">
              Este é o avatar que aparece nas conversas
            </p>
          </div>
        </div>

        {/* Upload de nova imagem */}
        <div className="space-y-2">
          <Label htmlFor="avatar-upload">Nova imagem do avatar</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading || loading}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: PNG, JPG, JPEG. Tamanho máximo: 5MB
          </p>
        </div>

        {/* Botão para restaurar padrão */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={uploading || loading}
            className="w-full"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Restaurar Avatar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}