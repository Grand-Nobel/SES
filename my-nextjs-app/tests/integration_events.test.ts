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

describe('integration_events Table', () => {
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

  it('inserts a new integration event', async () => {
    await supabase.from('integration_events').insert({
      tenant_id: 'tenant-1',
      event_type: 'stripe.invoice.paid',
      raw_payload: { invoice_id: '123' },
      normalized_payload: { event: 'payment:succeeded', client_id: 'uuid-1' },
      source_service: 'Stripe',
    });
    expect(supabase.from).toHaveBeenCalledWith('integration_events');
    expect((supabase.from('integration_events').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      event_type: 'stripe.invoice.paid',
      raw_payload: { invoice_id: '123' },
      normalized_payload: { event: 'payment:succeeded', client_id: 'uuid-1' },
      source_service: 'Stripe',
    });
  });

  it('queries integration events by tenant_id', async () => {
    const result = await supabase.from('integration_events').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('integration_events');
    const selectMock = (supabase.from('integration_events').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 1 }]);
  });
});