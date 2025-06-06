// integration-layer/commerce-workflows/tests/index.test.ts
import { startCommerceWorkflows } from '../index';
import { supabase } from '@/lib/supabase'; // Used for mock setup
import axios from 'axios'; // Used for mock setup

// --- KafkaJS Mock Setup ---
const mockCommerceKafkaMessageProcessor = jest.fn();
const mockCommerceConsumerRun = jest.fn(async ({ eachMessage }) => {
  mockCommerceKafkaMessageProcessor.mockImplementation(eachMessage);
});
const mockCommerceConsumerSubscribe = jest.fn();
const mockCommerceConsumerConnect = jest.fn().mockResolvedValue(undefined);

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      consumer: jest.fn().mockImplementation(() => ({
        connect: mockCommerceConsumerConnect,
        subscribe: mockCommerceConsumerSubscribe,
        run: mockCommerceConsumerRun,
      })),
    })),
  };
});
// --- End KafkaJS Mock Setup ---

jest.mock('@/lib/supabase'); // Mocks my-nextjs-app/src/lib/supabase.ts
jest.mock('axios'); // Mocks axios
jest.mock('../orchestrator/config', () => ({ // Mock orchestrator config
  loadOrchestrationConfig: jest.fn().mockResolvedValue({
    topics: { 'event:booking:*': 'test-event-booking-topic' },
    agents: {},
    workflows: {},
  }),
}));

describe('Commerce Workflows', () => {
  let mockSupabaseInsertCommerce: jest.Mock;
  let mockSupabaseSelectCommerce: jest.Mock;
  let mockSupabaseUpdateCommerce: jest.Mock;
  let mockAxiosPostCommerce: jest.Mock;

  const mockInvoice = {
    id: 'inv-test-123',
    tenant_id: 'tenant-commerce-1',
    client_id: 'client-com-1',
    invoice_number: 'INV-TEST-20250101-XYZ',
    amount: 1500,
    status: 'Generated',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseInsertCommerce = jest.fn();
    mockSupabaseSelectCommerce = jest.fn().mockReturnThis(); // for .select()
    mockSupabaseUpdateCommerce = jest.fn().mockReturnThis(); // for .update()
    
    // Mock for .single() chained after .select()
    const singleChainable = { single: jest.fn().mockResolvedValue({ data: mockInvoice, error: null }) };
    mockSupabaseSelectCommerce.mockReturnValue(singleChainable);

    // Mock for .eq() chained after .update()
    const eqChainableUpdate = { eq: jest.fn().mockResolvedValue({}) };
    mockSupabaseUpdateCommerce.mockReturnValue(eqChainableUpdate);


    (supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'invoices') {
        return { 
          insert: jest.fn().mockReturnValue({ // insert().select().single() chain
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockInvoice, error: null })
            })
          }), 
          update: mockSupabaseUpdateCommerce 
        };
      }
      if (tableName === 'ledgers') {
        return { insert: mockSupabaseInsertCommerce.mockResolvedValue({}) };
      }
      return { insert: jest.fn(), select: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn() };
    });

    mockAxiosPostCommerce = axios.post as jest.Mock;
    mockAxiosPostCommerce.mockResolvedValue({ data: { id: 'stripe-ch-123', amount: 150000, status: 'succeeded' } });
    
    // Mock STRIPE_KEY environment variable
    process.env.STRIPE_KEY = 'sk_test_mockkey';
  });

  afterEach(() => {
    delete process.env.STRIPE_KEY; // Clean up env var
  });

  it('connects, subscribes, generates an invoice, processes payment, and logs to ledger for payment_due event', async () => {
    const event = {
      event_type: 'booking:payment_due',
      tenant_id: 'tenant-commerce-1',
      payload: { client_id: 'client-com-1', amount: 1500, user_id: 'user-com-1' },
    };

    await startCommerceWorkflows();

    expect(mockCommerceConsumerConnect).toHaveBeenCalled();
    expect(mockCommerceConsumerSubscribe).toHaveBeenCalledWith({ topic: 'test-event-booking-topic' });
    expect(mockCommerceConsumerRun).toHaveBeenCalled();

    // Simulate Kafka message
    if (mockCommerceKafkaMessageProcessor.getMockImplementation()) {
      await mockCommerceKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('Commerce Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    // Verify invoice generation
    expect(supabase.from).toHaveBeenCalledWith('invoices');
    const invoiceInsertMock = (supabase.from as jest.Mock).mock.results[0].value.insert;
    expect(invoiceInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: event.tenant_id,
      client_id: event.payload.client_id,
      amount: event.payload.amount,
      status: 'Generated',
    }));

    // Verify payment processing
    expect(mockAxiosPostCommerce).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/charges',
      {
        amount: mockInvoice.amount * 100,
        currency: 'usd',
        source: 'tok_visa',
        description: `Invoice ${mockInvoice.invoice_number} for client ${mockInvoice.client_id}`,
        metadata: { invoice_id: mockInvoice.id, tenant_id: mockInvoice.tenant_id },
      },
      { headers: { Authorization: `Bearer ${process.env.STRIPE_KEY}` } }
    );
    
    // Verify invoice update after payment
    expect(supabase.from).toHaveBeenCalledWith('invoices'); // Called again for update
    const invoiceUpdateMockInstance = (supabase.from as jest.Mock).mock.results.find(r => r.value.update)?.value;
    expect(invoiceUpdateMockInstance.update).toHaveBeenCalledWith({ status: 'Paid', payment_gateway_reference: 'stripe-ch-123' });
    expect(invoiceUpdateMockInstance.update().eq).toHaveBeenCalledWith('id', mockInvoice.id);


    // Verify ledger insertion
    expect(supabase.from).toHaveBeenCalledWith('ledgers');
    expect(mockSupabaseInsertCommerce).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: event.tenant_id,
      transaction_type: 'Payment',
      amount: mockInvoice.amount, // Amount from the invoice
      balance: 0, // Assuming balance is 0 after full payment
      reference_id: mockInvoice.id,
    }));
  });
  
  it('handles Stripe API key not being set', async () => {
    delete process.env.STRIPE_KEY; // Ensure key is not set for this test
    const event = {
      event_type: 'booking:payment_due',
      tenant_id: 'tenant-commerce-error',
      payload: { client_id: 'client-err-1', amount: 500 },
    };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    await startCommerceWorkflows();
    if (mockCommerceKafkaMessageProcessor.getMockImplementation()) {
        // We expect processPayment to throw, which should be caught by the main error handler
        await mockCommerceKafkaMessageProcessor({ message: { value: Buffer.from(JSON.stringify(event)) } });
    } else {
      throw new Error('Commerce Kafka consumer.run was not called with eachMessage or mock was not set.');
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('STRIPE_KEY environment variable is not set.');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing commerce workflow Kafka message:', expect.any(Error));
    // Check that invoice status is updated to PaymentFailed
    const invoiceUpdateMockInstance = (supabase.from as jest.Mock).mock.results.find(r => r.value.update)?.value;
    expect(invoiceUpdateMockInstance.update).toHaveBeenCalledWith({ status: 'PaymentFailed' });
    expect(invoiceUpdateMockInstance.update().eq).toHaveBeenCalledWith('id', mockInvoice.id);

    consoleErrorSpy.mockRestore();
  });
});