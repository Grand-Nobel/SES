import { publishEvent, subscribeToTopic, rateLimitEvent } from '../kafka';
import { startEventBuffer } from '../buffer';
import Redis from 'ioredis';

jest.mock('kafkajs');
jest.mock('ioredis');

// Mock KafkaJS producer and consumer
const mockProducer = {
  connect: jest.fn(),
  send: jest.fn(),
  disconnect: jest.fn(),
};
const mockConsumer = {
  connect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn(() => ({
    producer: () => mockProducer,
    consumer: jest.fn(() => mockConsumer),
  })),
}));


describe('Event Bus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Redis.prototype.get as jest.Mock).mockResolvedValue(null);
    (Redis.prototype.multi as jest.Mock).mockReturnThis();
    (Redis.prototype.incr as jest.Mock).mockReturnThis();
    (Redis.prototype.expire as jest.Mock).mockReturnThis();
    (Redis.prototype.exec as jest.Mock).mockResolvedValue([]);
  });

  it('publishes an event via Kafka', async () => {
    await publishEvent('event:test', { key: 'value' });
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'event:test',
      messages: [{ value: '{"key":"value"}' }],
    });
  });

  it('buffers high-traffic events', async () => {
    (Redis.prototype.get as jest.Mock).mockResolvedValueOnce('1000');
    await publishEvent('event:test', { key: 'value' }, true);
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'event:test:delayed',
      messages: expect.any(Array),
    });
  });

  it('re-publishes delayed events', async () => {
    const event = {
      event_type: 'event:test:delayed',
      key: 'value',
    };
    // Mock the consumer's run method to immediately call the eachMessage callback
    (mockConsumer.run as jest.Mock).mockImplementationOnce(async ({ eachMessage }) => {
      await eachMessage({ message: { value: JSON.stringify(event) } });
    });

    await startEventBuffer();

    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'event:test',
      messages: expect.any(Array),
    });
  });
});