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

describe('dashboard_configs Table', () => {
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

  it('inserts a new dashboard config', async () => {
    await supabase.from('dashboard_configs').insert({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      layout: { widgets: [{ id: 'lead_pipeline', position: { x: 0, y: 0 } }] },
      widget_configs: { lead_pipeline: { filter: 'status=Engaged' } },
    });
    expect(supabase.from).toHaveBeenCalledWith('dashboard_configs');
    expect((supabase.from('dashboard_configs').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      layout: { widgets: [{ id: 'lead_pipeline', position: { x: 0, y: 0 } }] },
      widget_configs: { lead_pipeline: { filter: 'status=Engaged' } },
    });
  });

  it('queries dashboard configs by user_id', async () => {
    const result = await supabase.from('dashboard_configs').select('*').eq('user_id', 'user-1');
    expect(supabase.from).toHaveBeenCalledWith('dashboard_configs');
    const selectMock = (supabase.from('dashboard_configs').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result.data).toEqual([{ id: 'uuid-1' }]);
  });
});