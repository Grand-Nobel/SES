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

describe('ontology_metadata Table', () => {
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

  it('inserts a new ontology record', async () => {
    await supabase.from('ontology_metadata').insert({
      tenant_id: 'tenant-1',
      entity_type: 'Lead',
      relationship_type: 'converted_to',
      related_entity_type: 'Client',
      schema_definition: { source: 'leads', target: 'clients', mapping: { lead_id_source: 'id' } },
    });
    expect(supabase.from).toHaveBeenCalledWith('ontology_metadata');
    expect((supabase.from('ontology_metadata').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      entity_type: 'Lead',
      relationship_type: 'converted_to',
      related_entity_type: 'Client',
      schema_definition: { source: 'leads', target: 'clients', mapping: { lead_id_source: 'id' } },
    });
  });

  it('queries ontology metadata by tenant_id', async () => {
    const result = await supabase.from('ontology_metadata').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('ontology_metadata');
    expect(supabase.from).toHaveBeenCalledWith('ontology_metadata');
    const selectMock = (supabase.from('ontology_metadata').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 'uuid-1' }]);
  });
});