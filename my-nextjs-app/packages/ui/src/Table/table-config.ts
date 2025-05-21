import { supabase } from '@/lib/supabase';

export async function loadTenantTableConfig(tenantId: string) {
  const { data } = await supabase
    .from('tenant_table_configs')
    .select('columns')
    .eq('tenant_id', tenantId)
    .single();
  return data?.columns || [];
}
