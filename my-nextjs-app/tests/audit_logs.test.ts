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

describe('audit_logs Table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation before each test
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
      }),
    });
  });

  it('inserts a new audit log', async () => {
    await supabase.from('audit_logs').insert({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      action: 'sync_data',
      payload: { connectorId: '1' },
    });
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    expect((supabase.from('audit_logs').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      action: 'sync_data',
      payload: { connectorId: '1' },
    });
  });

  it('queries audit logs by tenant_id', async () => {
    const result = await supabase.from('audit_logs').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    const selectMock = (supabase.from('audit_logs').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 1 }]);
  });
});