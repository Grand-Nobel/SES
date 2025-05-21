// prototypes/AiChatPrototype.tsx
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { agentRunner } from '@/lib/agents'; // Assuming agentRunner is set up
// import { queryRAG } from '@/lib/agents/ragPipeline'; // Removed direct import
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import AiThinkingIndicator from '../../packages/ui/src/AiThinkingIndicator/AiThinkingIndicator';
import AiSuggestedActions from '../../packages/ui/src/AiSuggestedActions/AiSuggestedActions';
import Button from '../../packages/ui/src/Button/Button';
import { OfflineMutationManager } from '@/lib/api/offlineMutationManager';
import { useDropzone } from 'react-dropzone';
// import Tesseract from 'tesseract.js'; // Temporarily commented out for diagnosis
import { openDB, IDBPDatabase } from 'idb';
import './AiChatPrototype.module.css'; // Make sure this path is correct or adjust

// Define a type for the File cache database schema
interface FileCacheDb extends IDBPDatabase {
  files: {
    key: string; // file name
    value: { name: string; text: string };
  };
}

const dbPromise = openDB<FileCacheDb>('ses-file-cache', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('files')) {
      db.createObjectStore('files', { keyPath: 'name' });
    }
  },
});

const offlineManager = OfflineMutationManager.getInstance();

export interface AiChatPrototypeProps {
  initialSuggestions?: string[];
  'data-testid'?: string;
}

const AiChatPrototype: React.FC<AiChatPrototypeProps> = ({
  initialSuggestions = [],
  'data-testid': dataTestId = 'ai-chat-prototype',
}) => {
  const { t } = useTranslation('dashboard'); // Or a more specific namespace like 'aiChat'
  const { tenantId } = useAuthStore();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setUploadedFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
      setUploadStatus(t('files_dropped', { count: acceptedFiles.length }));
    },
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'], 'application/pdf': ['.pdf'] },
    multiple: true,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const processOCR = useCallback(async (file: File): Promise<string> => {
    console.warn('OCR processing is temporarily disabled for diagnosis.'); // Changed to console.warn
    return `OCR disabled for ${file.name}`;
    // This worker path needs to be correct relative to the public folder or how Next.js handles workers
    // For simplicity, assuming ocrWorker.ts is correctly set up to be served.
    // In Next.js, web workers are often placed in the `public` directory or handled via specific build configurations.
    // const worker = new Worker(new URL('./ocrWorker.ts', import.meta.url)); // Temporarily commented out
    // return new Promise((resolve, reject) => {
    //   worker.onmessage = (e) => {
    //     resolve(e.data.text);
    //     worker.terminate();
    //   };
    //   worker.onerror = (e) => {
    //     reject(e);
    //     worker.terminate();
    //   };
    //   worker.postMessage(file);
    // });
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsThinking(true);
    setUploadStatus(t('processing_file', { name: file.name }));
    try {
      let textContent = '';
      if (file.type.startsWith('image/')) {
        const db = await dbPromise;
        const cached = await db.get('files', file.name);
        if (cached) {
          textContent = cached.text;
          setUploadStatus(t('file_processed_cache', { name: file.name }));
        } else {
          textContent = await processOCR(file);
          await db.put('files', { name: file.name, text: textContent });
          setUploadStatus(t('file_ocr_complete', { name: file.name }));
        }
        setMessages((prev) => [...prev, { role: 'user', content: `Image content for ${file.name}: ${textContent.substring(0, 100)}...` }]);
      } else if (file.type === 'application/pdf') {
        // PDF processing logic (placeholder, as OCR worker is for images)
        // For actual PDF text extraction, a library like pdf.js would be needed.
        // The original outline implies direct upload for PDFs.
        textContent = `Content of PDF: ${file.name} (processing not fully implemented in this mock)`;
        setMessages((prev) => [...prev, { role: 'user', content: textContent }]);
        
        const operation = {
          operationName: 'uploadFile', // This should match a backend operation
          variables: { tenantId, fileName: file.name /*, other metadata */ },
          // File itself might be handled differently, e.g., FormData for HTTP upload
        };

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Note: Queuing raw File objects in OfflineMutationManager might be problematic due to serialization.
          // Usually, you'd queue metadata and handle file persistence separately (e.g., IndexedDB for the file blob).
          await offlineManager.queueMutation(operation, 2);
          setMessages((prev) => [...prev, { role: 'assistant', content: `PDF upload queued: ${file.name}` }]);
          setUploadStatus(t('file_queued', { name: file.name }));
        } else {
          // Simulate Supabase storage upload
          const { data, error } = await supabase.storage.from('files').upload(`${tenantId}/${file.name}`, file);
          if (error) throw error;
          setMessages((prev) => [...prev, { role: 'assistant', content: `Uploaded PDF: ${file.name} (path: ${data?.path})` }]);
          setUploadStatus(t('file_processed_server', { name: file.name }));
          // After upload, you might trigger a backend process for this PDF.
          // For now, we'll use the placeholder textContent for RAG.
        }
      }

      if (textContent && tenantId) {
        // Call API route for RAG query
        const ragResponse = await fetch('/api/rag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, query: textContent }),
        });
        if (!ragResponse.ok) {
          const errorData = await ragResponse.json();
          throw new Error(errorData.error || 'RAG API request failed');
        }
        const ragData = await ragResponse.json();
        const relevantDocs = ragData.results || [];
        
        const response = await agentRunner.run({
          agentName: 'ChatAssistant',
          action: 'respond',
          payload: { tenantId, userInput: textContent, context: relevantDocs, source: file.type.startsWith('image/') ? 'image' : 'pdf' },
        });
        setMessages((prev) => [...prev, { role: 'assistant', content: response.message || "Sorry, I couldn't generate a response." }]);
      }
      
      const maskedEvent = await PrivacyLogger().log('file_upload', { tenantId, fileType: file.type, fileName: file.name });
      await supabase.from('system_metrics').insert({
        tenant_id: tenantId,
        metric: 'file_upload',
        value: maskedEvent,
      });

    } catch (error) {
      console.error("File processing error:", error);
      setMessages((prev) => [...prev, { role: 'assistant', content: t('error.file_upload_failed') }]);
      setUploadStatus(t('error.file_upload_failed'));
    } finally {
      setIsThinking(false);
    }
  }, [tenantId, t, processOCR]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    if (uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        await handleFileUpload(file);
      }
      setUploadedFiles([]); // Clear files after processing
      setInput(''); // Clear text input if files were the primary submission
      return;
    }

    if (input.trim() && tenantId) {
      setMessages((prev) => [...prev, { role: 'user', content: input }]);
      setIsThinking(true);
      setInput(''); // Clear input after sending

      try {
        // Call API route for RAG query
        const ragResponse = await fetch('/api/rag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, query: input }),
        });
        if (!ragResponse.ok) {
          const errorData = await ragResponse.json();
          throw new Error(errorData.error || 'RAG API request failed');
        }
        const ragData = await ragResponse.json();
        const relevantDocs = ragData.results || [];

        const response = await agentRunner.run({
          agentName: 'ChatAssistant',
          action: 'respond',
          payload: { tenantId, userInput: input, context: relevantDocs },
          cache: { key: `chat:${tenantId}:${input}`, ttl: 3600 }, // Example caching
        });

        setMessages((prev) => [...prev, { role: 'assistant', content: response.message || "Sorry, I couldn't generate a response." }]);
        
        const maskedEvent = await PrivacyLogger().log('chat_interaction', {
          tenantId,
          userInput: input,
          response: response.message,
          context: relevantDocs,
        });
        await supabase.from('system_metrics').insert({
          tenant_id: tenantId,
          metric: 'chat_interaction',
          value: maskedEvent,
        });
      } catch (error) {
        console.error("Chat submission error:", error);
        setMessages((prev) => [...prev, { role: 'assistant', content: t('error.chat_failed') }]);
      } finally {
        setIsThinking(false);
      }
    }
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // Optionally, submit immediately or let user edit
    // handleSubmit(); // Uncomment to submit on suggestion click
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  // Gesture alternative for prioritizing suggestion (example)
   const handleAltRightArrow = (e: React.KeyboardEvent) => {
    if (e.altKey && e.key === 'ArrowRight' && initialSuggestions.length > 0) {
      setInput(initialSuggestions[0]);
      // announcer.announce(t('aria.gesture_alternative', { action: 'prioritize suggestion' }));
    }
  };


  return (
    <div className="ai-chat-container" data-testid={dataTestId} onKeyDown={handleAltRightArrow}>
      <div ref={chatContainerRef} className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
          </div>
        ))}
        {isThinking && <AiThinkingIndicator />}
      </div>
      
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        {isDragActive ? <p>{t('drop_files_active')}</p> : <p>{t('drop_files_here')}</p>}
      </div>
      {uploadedFiles.length > 0 && (
        <div className="file-preview">
          <p>{t('selected_files')}:</p>
          <ul>
            {uploadedFiles.map((file, index) => (
              <li key={index}>{file.name} ({Math.round(file.size / 1024)} KB)</li>
            ))}
          </ul>
        </div>
      )}
      {uploadStatus && <p className="upload-status">{uploadStatus}</p>}

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('chat_placeholder')}
          data-testid={`${dataTestId}-input`}
          disabled={isThinking}
        />
        <Button type="submit" disabled={isThinking || (!input.trim() && uploadedFiles.length === 0)}>
          {t('send')}
        </Button>
      </form>
      {initialSuggestions.length > 0 && !isThinking && (
         <AiSuggestedActions suggestedActions={initialSuggestions.map((s, i) => ({
            id: `suggestion-${i}`,
            label: s,
            onClick: () => handleSuggestionClick(s),
          }))} 
        />
      )}
    </div>
  );
};

export default AiChatPrototype;
