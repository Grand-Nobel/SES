// integration-layer/commerce-workflows/index.ts
import { Kafka } from 'kafkajs';
import { supabase } from '../../src/lib/supabase'; // Adjusted path
import axios from 'axios';
import { loadOrchestrationConfig } from '../orchestrator/config';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('commerce-workflows');

const kafka = new Kafka({
  clientId: 'commerce-workflows',
  brokers: ['broker1.ses.com:9092', 'broker2.ses.com:9092'],
  ssl: {
    ca: [process.env.KAFKA_SSL_CA!], // Added non-null assertion
    cert: process.env.KAFKA_SSL_CERT,
    key: process.env.KAFKA_SSL_KEY,
  },
});

const consumer = kafka.consumer({ groupId: 'commerce-workflows-group' });

interface Invoice {
  id: string;
  tenant_id: string;
  client_id: string;
  invoice_number: string;
  amount: number;
  status: string;
  // Add other fields from your 'invoices' table if necessary
}

interface PaymentResult {
  amount: number;
  balance: number; // Assuming this is current balance after payment
  transaction_id?: string; // Optional Stripe transaction ID
}


export async function startCommerceWorkflows() {
  const config = await loadOrchestrationConfig();
  await consumer.connect();
  await consumer.subscribe({ topic: config.topics['event:booking:*'] || 'event:booking:*' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const span = tracer.startSpan('executeCommerceWorkflow');
      try {
        if (!message.value) {
          console.error('Kafka message value is null or undefined for commerce workflow');
          return;
        }
        const event = JSON.parse(message.value.toString());

        if (!event.tenant_id || !event.payload) {
            console.error('tenant_id or payload is missing for commerce workflow:', event);
            return;
        }

        if (event.event_type === 'booking:payment_due') {
          if (!event.payload.client_id || typeof event.payload.amount !== 'number') {
            console.error('client_id or amount is missing/invalid in payment_due event payload:', event.payload);
            return;
          }
          const invoice = await generateInvoice(event.tenant_id, event.payload);
          if (!invoice) {
            console.error('Failed to generate invoice for event:', event);
            return;
          }
          const payment = await processPayment(invoice);
          await supabase
            .from('ledgers')
            .insert({
              tenant_id: event.tenant_id,
              transaction_type: 'Payment', // Or more specific like 'Stripe Payment'
              amount: payment.amount,
              balance: payment.balance, // This might need to be calculated based on previous balance
              reference_id: invoice.id, // Link to the invoice
              transaction_date: new Date().toISOString(),
              // related_entity_type: 'Invoice', // Optional for polymorphic relations
            });
        } else {
          console.log(`Received unhandled event type in commerce-workflows: ${event.event_type}`);
        }
      } catch (error) {
        console.error('Error processing commerce workflow Kafka message:', error);
        // Optionally, rethrow or handle specific errors
      }
      finally {
        span.end();
      }
    },
  });
}

async function generateInvoice(tenantId: string, payload: { client_id: string; amount: number; [key: string]: any }): Promise<Invoice | null> {
  const invoiceSpan = tracer.startSpan('generateInvoice');
  try {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        client_id: payload.client_id,
        invoice_number: invoiceNumber,
        amount: payload.amount,
        status: 'Generated', // Initial status
        // due_date: calculate_due_date(), // Example
        // line_items: payload.line_items, // Example
      })
      .select()
      .single(); // Expecting a single row back

    if (error) {
      console.error(`Error inserting invoice for tenant ${tenantId}, client ${payload.client_id}:`, error);
      return null;
    }
    return data as Invoice;
  } catch (error) {
    console.error(`Exception in generateInvoice for tenant ${tenantId}:`, error);
    return null;
  }
  finally {
    invoiceSpan.end();
  }
}

async function processPayment(invoice: Invoice): Promise<PaymentResult> {
  const paymentSpan = tracer.startSpan('processPayment');
  try {
    // Basic placeholder for Stripe API call
    // Ensure STRIPE_KEY is set in your environment variables
    if (!process.env.STRIPE_KEY) {
        console.error('STRIPE_KEY environment variable is not set.');
        throw new Error('Stripe API key is not configured.');
    }
    const response = await axios.post('https://api.stripe.com/v1/charges', {
      amount: Math.round(invoice.amount * 100), // Stripe expects amount in cents
      currency: 'usd', // Or make this configurable
      source: 'tok_visa', // This is a test token. Replace with actual tokenization in production.
      description: `Invoice ${invoice.invoice_number} for client ${invoice.client_id}`,
      metadata: { invoice_id: invoice.id, tenant_id: invoice.tenant_id },
    }, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_KEY}` },
    });

    // Update invoice status after successful payment
    await supabase
        .from('invoices')
        .update({ status: 'Paid', payment_gateway_reference: response.data.id })
        .eq('id', invoice.id);

    console.log(`Payment processed for invoice ${invoice.id} via Stripe. Transaction ID: ${response.data.id}`);
    // This balance might be the invoice balance (0 after full payment) or account balance.
    // For simplicity, returning invoice amount as paid amount, and assuming invoice balance is now 0.
    return { amount: invoice.amount, balance: 0, transaction_id: response.data.id };
  } catch (error) {
      console.error(`Error processing payment for invoice ${invoice.id}:`, error);
      // Update invoice status to 'PaymentFailed' or similar
      await supabase
        .from('invoices')
        .update({ status: 'PaymentFailed' })
        .eq('id', invoice.id);
      throw error; // Re-throw to be caught by the main handler
  }
  finally {
    paymentSpan.end();
  }
}