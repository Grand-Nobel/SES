import { createClient } from '@supabase/supabase-js';

// Mock the entire @supabase/supabase-js module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(),
      select: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  })),
}));

// Import the mocked supabase client
import { supabase } from '@/lib/supabase';

describe('etl_configs Table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation before each test
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [{ id: 'uuid-1' }], error: null }),
      }),
    });
  });

  it('inserts a new ETL config', async () => {
    await supabase.from('etl_configs').insert({
      tenant_id: 'tenant-1',
      source_service: 'Salesforce',
      transformation_rules: { field_map: { contact_id: 'client_id' }, ai_rules: { infer_email: 'Claude' } },
    });
    expect(supabase.from).toHaveBeenCalledWith('etl_configs');
    expect((supabase.from('etl_configs').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      source_service: 'Salesforce',
      transformation_rules: { field_map: { contact_id: 'client_id' }, ai_rules: { infer_email: 'Claude' } },
    });
  });

  it('queries ETL configs by tenant_id', async () => {
    const result = await supabase.from('etl_configs').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('etl_configs');
    const selectMock = (supabase.from('etl_configs').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 'uuid-1' }]);
  });
});