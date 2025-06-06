import { supabase } from '@/lib/supabase'; // Adjusted path to use alias

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  const { data, error } = await supabase.functions.invoke('stt-proxy', {
    body: formData,
  });
  if (error) throw error;
  return data.transcription;
}
