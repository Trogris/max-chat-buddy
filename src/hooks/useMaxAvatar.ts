import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import maxAvatarDefault from '@/assets/max-avatar.png';

export const useMaxAvatar = () => {
  const [avatarUrl, setAvatarUrl] = useState<string>(maxAvatarDefault);
  const [loading, setLoading] = useState(true);

  const loadAvatarUrl = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('avatar_url')
        .maybeSingle();

      if (error) {
        console.error('Error loading avatar URL:', error);
        setAvatarUrl(maxAvatarDefault);
        return;
      }

      if (data?.avatar_url) {
        // Se há uma URL customizada, verificar se é uma URL completa ou do storage
        if (data.avatar_url.startsWith('http')) {
          setAvatarUrl(data.avatar_url);
        } else {
          // URL do storage bucket
          const { data: urlData } = supabase.storage
            .from('max-avatar')
            .getPublicUrl(data.avatar_url);
          setAvatarUrl(urlData.publicUrl);
        }
      } else {
        setAvatarUrl(maxAvatarDefault);
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
      setAvatarUrl(maxAvatarDefault);
    } finally {
      setLoading(false);
    }
  };

  const updateAvatarUrl = async (newUrl: string | null) => {
    try {
      // Verificar se já existe um registro
      const { data: existing } = await supabase
        .from('ai_settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('ai_settings')
          .update({ avatar_url: newUrl })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('ai_settings')
          .insert({ avatar_url: newUrl });
        
        if (error) throw error;
      }

      // Recarregar a URL do avatar
      await loadAvatarUrl();
      return true;
    } catch (error) {
      console.error('Error updating avatar URL:', error);
      return false;
    }
  };

  const uploadAvatar = async (file: File): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `max-avatar-${Date.now()}.${fileExt}`;

      // Fazer upload do arquivo
      const { error: uploadError } = await supabase.storage
        .from('max-avatar')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Atualizar a URL na tabela ai_settings
      await updateAvatarUrl(fileName);
      
      return true;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = async (): Promise<boolean> => {
    return await updateAvatarUrl(null);
  };

  useEffect(() => {
    loadAvatarUrl();
  }, []);

  return {
    avatarUrl,
    loading,
    uploadAvatar,
    resetToDefault,
    refreshAvatar: loadAvatarUrl
  };
};