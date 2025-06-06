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

describe('template_library Table', () => {
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

  it('inserts a new template', async () => {
    await supabase.from('template_library').insert({
      tenant_id: 'tenant-1',
      template_type: 'Email',
      template_name: 'Welcome Email',
      content: 'Welcome to SES!',
      metadata: { model: 'Claude', tone: 'Professional' },
    });
    expect(supabase.from).toHaveBeenCalledWith('template_library');
    expect((supabase.from('template_library').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      template_type: 'Email',
      template_name: 'Welcome Email',
      content: 'Welcome to SES!',
      metadata: { model: 'Claude', tone: 'Professional' },
    });
  });

  it('queries templates by tenant_id', async () => {
    const result = await supabase.from('template_library').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('template_library');
    const selectMock = (supabase.from('template_library').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 'uuid-1' }]);
  });
});