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

describe('kpi_predictions Table', () => {
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

  it('inserts a new KPI prediction', async () => {
    await supabase.from('kpi_predictions').insert({
      tenant_id: 'tenant-1',
      model_name: 'ChurnPredictor',
      entity_type: 'Client',
      entity_id: 'uuid-1',
      prediction: { churn_risk: 0.75, confidence: 0.9 },
    });
    expect(supabase.from).toHaveBeenCalledWith('kpi_predictions');
    expect((supabase.from('kpi_predictions').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      model_name: 'ChurnPredictor',
      entity_type: 'Client',
      entity_id: 'uuid-1',
      prediction: { churn_risk: 0.75, confidence: 0.9 },
    });
  });

  it('queries KPI predictions by tenant_id', async () => {
    const result = await supabase.from('kpi_predictions').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('kpi_predictions');
    const selectMock = (supabase.from('kpi_predictions').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 'uuid-1' }]);
  });
});