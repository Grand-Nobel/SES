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

describe('Financial Transactions Tables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation before each test
    (supabase.from as jest.Mock).mockImplementation((tableName) => {
      const mockReturn = {
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [{ id: tableName === 'ledgers' || tableName === 'audit_logs' ? 1 : 'uuid-1' }], error: null }),
        }),
      };
      // Adjust mockReturnValue for specific tables if needed
      if (tableName === 'invoices') {
        mockReturn.insert = jest.fn().mockResolvedValue({ data: [], error: null });
      } else if (tableName === 'ledgers') {
        mockReturn.insert = jest.fn().mockResolvedValue({ data: [], error: null });
      } else if (tableName === 'subscriptions') {
        mockReturn.insert = jest.fn().mockResolvedValue({ data: [], error: null });
      } else if (tableName === 'payroll') {
        mockReturn.insert = jest.fn().mockResolvedValue({ data: [], error: null });
      }
      return mockReturn;
    });
  });

  it('inserts a new invoice', async () => {
    await supabase.from('invoices').insert({
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      invoice_number: 'INV-001',
      amount: 1000.00,
      status: 'Draft',
    });
    expect(supabase.from).toHaveBeenCalledWith('invoices');
    expect((supabase.from('invoices').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      invoice_number: 'INV-001',
      amount: 1000.00,
      status: 'Draft',
    });
  });

  it('inserts a new ledger entry', async () => {
    await supabase.from('ledgers').insert({
      tenant_id: 'tenant-1',
      transaction_type: 'Invoice',
      amount: 1000.00,
      balance: 1000.00,
    });
    expect(supabase.from).toHaveBeenCalledWith('ledgers');
    expect((supabase.from('ledgers').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      transaction_type: 'Invoice',
      amount: 1000.00,
      balance: 1000.00,
    });
  });

  it('inserts a new subscription', async () => {
    await supabase.from('subscriptions').insert({
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      plan_id: 'plan-001',
      status: 'Active',
      renewal_date: '2025-12-31T00:00:00Z',
    });
    expect(supabase.from).toHaveBeenCalledWith('subscriptions');
    expect((supabase.from('subscriptions').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      plan_id: 'plan-001',
      status: 'Active',
      renewal_date: '2025-12-31T00:00:00Z',
    });
  });

  it('inserts a new payroll record', async () => {
    await supabase.from('payroll').insert({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      amount: 5000.00,
      pay_date: '2025-05-31T00:00:00Z',
    });
    expect(supabase.from).toHaveBeenCalledWith('payroll');
    expect((supabase.from('payroll').insert as jest.Mock)).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      amount: 5000.00,
      pay_date: '2025-05-31T00:00:00Z',
    });
  });

  it('queries invoices by tenant_id', async () => {
    const result = await supabase.from('invoices').select('*').eq('tenant_id', 'tenant-1');
    expect(supabase.from).toHaveBeenCalledWith('invoices');
    const selectMock = (supabase.from('invoices').select as jest.Mock);
    expect(selectMock).toHaveBeenCalledWith('*');
    const eqMock = (selectMock('*').eq as jest.Mock);
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result.data).toEqual([{ id: 'uuid-1' }]);
  });
});