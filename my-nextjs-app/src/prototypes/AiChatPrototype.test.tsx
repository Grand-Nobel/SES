// prototypes/AiChatPrototype.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // Import jest-dom for extended matchers
import AiChatPrototype from './AiChatPrototype';
// import { supabase } from '@/lib/supabase'; // supabase is unused
import { PrivacyLogger } from '@/lib/logging';
import * as Tesseract from 'tesseract.js'; // Import as namespace
import { agentRunner } from '@/lib/agents';
import { queryRAG } from '@/lib/agents/ragPipeline';
import { OfflineMutationManager } from '@/lib/api/offlineMutationManager';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn().mockResolvedValue({ data: { path: 'mock/path.pdf' }, error: null }),
    },
    from: jest.fn().mockReturnThis(), // For system_metrics insert
    insert: jest.fn().mockResolvedValue({}), // For system_metrics insert
  },
}));
jest.mock('@/lib/logging');
jest.mock('tesseract.js'); // Mock Tesseract.js
jest.mock('@/lib/agents', () => ({
  agentRunner: {
    run: jest.fn().mockResolvedValue({ success: true, message: 'Mock AI response' }),
  },
}));
jest.mock('@/lib/agents/ragPipeline');
jest.mock('@/lib/api/offlineMutationManager');


// Mock IntersectionObserver if it's used by any child components implicitly
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;


describe('AiChatPrototype', () => {
  const mockInitialSuggestions = ['Hello', 'How are you?'];

  beforeEach(() => {
    jest.clearAllMocks();
    (PrivacyLogger as jest.Mock).mockReturnValue({ log: jest.fn().mockResolvedValue({}) });
    (Tesseract.recognize as jest.Mock).mockResolvedValue({ data: { text: 'Extracted text from image' } });
    (queryRAG as jest.Mock).mockResolvedValue(['Relevant doc 1', 'Relevant doc 2']);
    (OfflineMutationManager.getInstance().queueMutation as jest.Mock).mockResolvedValue({ success: true, id: 'mut-123' });

    // Mock for openDB and its methods if they are called during tests
    const mockDb = {
      get: jest.fn().mockResolvedValue(null), // Default to cache miss
      put: jest.fn().mockResolvedValue(''),   // Mock put operation
    };
    jest.mock('idb', () => ({ // Re-mock idb for each test if its state needs to be clean
      openDB: jest.fn().mockResolvedValue(mockDb),
    }));
  });

  it('handles text input and AI response', async () => {
    render(<AiChatPrototype initialSuggestions={mockInitialSuggestions} />);
    const inputField = screen.getByTestId('ai-chat-prototype-input');
    const sendButton = screen.getByText('send');

    fireEvent.change(inputField, { target: { value: 'Test user input' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Test user input')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Mock AI response')).toBeInTheDocument();
    });
    expect(agentRunner.run).toHaveBeenCalled();
    expect(queryRAG).toHaveBeenCalledWith(expect.any(String), 'Test user input');
  });

  it('handles image file upload with OCR and AI response', async () => {
    render(<AiChatPrototype initialSuggestions={mockInitialSuggestions} />);
    const dropzone = screen.getByText('drop files here'); // More robust selector might be needed
    const testFile = new File(['test image data'], 'test.png', { type: 'image/png' });

    // Simulate dropping a file
    // Note: Directly using fireEvent.drop might not trigger react-dropzone's onDrop correctly
    // due to its internal handling. A more direct way to test is to call the onDrop handler
    // or use a library designed for testing react-dropzone if available.
    // For this example, we'll assume a simplified scenario or that fireEvent.drop works.
    // A common workaround is to get the input element and dispatch a change event.
    const fileInput = dropzone.querySelector('input[type="file"]');
    if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
            value: [testFile],
            writable: false,
        });
        fireEvent.drop(dropzone); // or fireEvent.change(fileInput);
    } else {
        throw new Error("File input not found in dropzone");
    }
    
    // Wait for file to be "processed" by dropzone and appear in UI (if applicable)
    // Then click send or submit
    const sendButton = screen.getByText('send');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/Image content for test.png: Extracted text from image/)).toBeInTheDocument();
    });
     await waitFor(() => {
      expect(screen.getByText('Mock AI response')).toBeInTheDocument(); // AI response after OCR
    });
    expect(Tesseract.recognize).toHaveBeenCalled();
  });

  it('queues PDF uploads when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<AiChatPrototype initialSuggestions={mockInitialSuggestions} />);
    const dropzone = screen.getByText('drop files here');
    const testPdfFile = new File(['test pdf data'], 'test.pdf', { type: 'application/pdf' });

    const fileInput = dropzone.querySelector('input[type="file"]');
    if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
            value: [testPdfFile],
            writable: false,
        });
        fireEvent.drop(dropzone);
    } else {
        throw new Error("File input not found in dropzone for PDF test");
    }
    
    const sendButton = screen.getByText('send');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(`PDF upload queued: ${testPdfFile.name}`)).toBeInTheDocument();
    });
    expect(OfflineMutationManager.getInstance().queueMutation).toHaveBeenCalled();
  });
  
  it('handles gesture alternative with keyboard for suggestions', async () => {
    render(<AiChatPrototype initialSuggestions={mockInitialSuggestions} />);
    const chatContainer = screen.getByTestId('ai-chat-prototype');
    fireEvent.keyDown(chatContainer, { key: 'ArrowRight', altKey: true });
    expect(screen.getByTestId('ai-chat-prototype-input')).toHaveValue(mockInitialSuggestions[0]);
  });

});
