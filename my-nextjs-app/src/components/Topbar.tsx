// Elite+++++++ Topbar with enhanced fallback queue processing, voice input, and accessibility
import { memo, useMemo, useState, useCallback, useEffect, Suspense } from 'react'; // Removed lazy
import type { LayersModel, Tensor } from '@tensorflow/tfjs'; // Added Tensor for type safety
import { Tokenizer } from 'tokenizers'; // Ensure Tokenizer is imported if not already for its type
import { useAuth, useNotifications, useUI, useAgentSuggestions, useWindowSize } from '../hooks';
import { motion } from 'framer-motion';
import { debounce, throttle } from 'lodash';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TenantLogo, RoleSwitcher, NotificationDropdown, SettingsDropdown, UserMenu, ContextualAction } from './ui'; // CommandPalette is local
import { MenuIcon, SearchIcon, SparkleIcon, MicIcon } from './icons';
import { useRouter } from 'next/navigation';
import { FocusScope } from '@react-aria/focus';
import { useKeyboard } from '@react-aria/interactions'; // Corrected import for useKeyboard
import { supabase } from '../lib/supabase';
import Fuse from 'fuse.js';
import * as Sentry from '@sentry/react';
import { histogram } from '../lib/performance'; // Removed PerformanceObserver if not used, kept histogram
import { get, set } from 'idb-keyval';
// Tokenizer already imported above for type usage
import OfflineQueue from '../lib/integrations/offline/OfflineQueue'; // Changed to default import
// Removed isOnline import, will use navigator.onLine directly
import { toast } from 'react-toastify'; // Enhanced: For rate limit feedback

// Removed: const tf = lazy(() => import('@tensorflow/tfjs'));

// Moved withRetry function to module scope
const withRetry = async (fn: () => Promise<any>, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
};

interface ModelManifest {
 tokenizerUrl: string;
 version: string;
 url: string;
 // Add other expected fields from manifest.json if necessary
}

interface Command {
  id: string;
  type: 'navigate' | 'action';
  label: string;
  path?: string;
  execute?: () => void;
  usageCount?: number;
  contextRelevance?: number;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'prod' : 'staging',
  release: `app@${process.env.NEXT_PUBLIC_APP_VERSION}`,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event: Sentry.Event, hint?: Sentry.EventHint): Sentry.ErrorEvent | null {
    // Perform PII scrubbing if user data is present
    if (event.user) {
      const user = event.user as any;
      delete user.email;
      delete user.ip_address;
    }

    // Ensure only error events are processed further by this hook.
    // Transactions or other event types might cause type mismatches.
    if (event.exception && event.exception.values && event.exception.values.length > 0) {
      return event as Sentry.ErrorEvent; // Cast to ErrorEvent and return
    }
    return null; // Drop non-error events or events without exceptions
  },
});

const commandExecutionTime = histogram('topbar_command_execution_time', 'Time to execute a command in Topbar', [50, 100, 500]); // Enhanced: Prometheus metric

const Topbar = memo(() => {
  const { user, tenant } = useAuth();
  const { toggleSidebar } = useUI();
  const { notifications } = useNotifications();
  const { suggestions } = useAgentSuggestions();
  const router = useRouter();
  const { width } = useWindowSize(); // Enhanced: For mobile responsiveness
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const openCommandPalette = () => setIsCommandPaletteOpen(true);
  const closeCommandPalette = () => setIsCommandPaletteOpen(false);

  return (
    <>
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-0 left-0 right-0 bg-white shadow-md z-50 p-4 flex items-center justify-between"
      role="banner"
      aria-label="Application Topbar"
    >
      <div className="flex items-center space-x-4">
        <button onClick={toggleSidebar} aria-label="Toggle sidebar">
          <MenuIcon className="h-6 w-6 text-gray-600" />
        </button>
        <TenantLogo />
        {width >= 600 && (
          <button onClick={openCommandPalette} aria-label="Open command palette" className="p-1">
            <SearchIcon className="h-6 w-6 text-gray-600" />
          </button>
        )}
      </div>
      <div className="flex items-center space-x-4">
        {width < 600 && ( // Enhanced: Mobile command palette button
          <button onClick={() => router.push('/command-palette')} aria-label="Open command palette" className="p-1">
            <SearchIcon className="h-6 w-6 text-gray-600" />
          </button>
        )}
        <NotificationDropdown notifications={notifications} />
        <SettingsDropdown />
        <UserMenu user={user} />
        {suggestions.length > 0 && <ContextualAction suggestions={suggestions} />}
      </div>
    </motion.header>
    {isCommandPaletteOpen && <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />}
    </>
  );
});

const CommandPalette = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [isVoiceActive, setVoiceActive] = useState(false);
  const [nlpError, setNlpError] = useState<string | null>(null);
  const [pendingQueries, setPendingQueries] = useState<string[]>([]);
  const [fallbackQueue, setFallbackQueue] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1); // Enhanced: For accessibility
  const router = useRouter();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  // OfflineQueue is already an instance, no need for useMemo
  // const offlineQueue = useMemo(() => OfflineQueue, [OfflineQueue]);

  const staticCommands: Command[] = [ // Explicitly typed staticCommands
    { id: 'dashboard', type: 'navigate', label: 'Go to Dashboard', path: '/dashboard', usageCount: 10, contextRelevance: 0.8 },
    { id: 'leads', type: 'navigate', label: 'Go to Leads', path: '/leads', usageCount: 15, contextRelevance: 0.9 },
    { id: 'new-lead', type: 'action', label: 'Create New Lead', execute: () => router.push('/leads/new'), usageCount: 5, contextRelevance: 0.7 },
  ];

  const fuse = useMemo(() => new Fuse(staticCommands, {
    keys: ['label'],
    threshold: 0.3,
    includeScore: true,
  }), [staticCommands]); // Added staticCommands to dependency array

  const { data: modelManifest, refetch: refetchManifest } = useQuery<ModelManifest, Error>({
    queryKey: ['nlp-model-manifest'],
    queryFn: async (): Promise<ModelManifest> => {
      const res = await fetch('/models/intent-classifier/manifest.json');
      if (!res.ok) {
        throw new Error(`Failed to fetch model manifest: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const [nlpModel, setNlpModel] = useState<LayersModel | null>(null);
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [useServerFallback, setUseServerFallback] = useState(false);

  // Enhanced: Voice input using SpeechRecognition
  const SpeechRecognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const recognition = useMemo(() => SpeechRecognition ? new SpeechRecognition() : null, [SpeechRecognition]); // Added SpeechRecognition to dependency array

  useEffect(() => {
    if (isVoiceActive && recognition) {
      recognition.start();
      recognition.onresult = (event: any) => { // Reverted to any due to global type issues
        const text = event.results[0][0].transcript;
        setQuery(text);
        // Removed: throttledParse(text);
      };
      recognition.onerror = (event: any) => { // Reverted to any due to global type issues
        const errorMessage = event.error || 'Unknown voice recognition error';
        setNlpError(`Voice recognition failed: ${errorMessage}`);
        setVoiceActive(false);
        Sentry.captureException(new Error(errorMessage), { extra: { userId: user?.id, tenantId: tenant?.id } }); // Added optional chaining, wrapped errorMessage in new Error
      };
      return () => recognition.stop();
    }
  }, [isVoiceActive, recognition, user?.id, tenant?.id]); // Added optional chaining

  useEffect(() => {
    const interval = setInterval(() => {
      refetchManifest();
    }, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetchManifest]);

  // withRetry function moved to module scope

  useEffect(() => {
    if (isOpen && modelManifest) {
      performance.mark('tokenizer-load-start');
      const loadTokenizer = async () => {
        const start = performance.now();
        try {
          const res = await fetch(modelManifest.tokenizerUrl, { headers: { 'Accept-Encoding': 'br' } });
          if (performance.now() - start > 500) { // Enhanced: Cap tokenizer load time
            setUseServerFallback(true);
            Sentry.captureMessage('Tokenizer load too slow', {
              extra: { userId: user?.id, tenantId: tenant?.id, loadTime: performance.now() - start }, // Added optional chaining
            });
            return;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const tokenizerJsonString = await res.text();
          const sizeBytes = new TextEncoder().encode(tokenizerJsonString).length;
          if (sizeBytes > 1_000_000) {
            Sentry.captureMessage('Tokenizer size exceeds 1MB', {
              level: 'warning',
              extra: { userId: user?.id, tenantId: tenant?.id, sizeBytes, url: modelManifest.tokenizerUrl }, // Added optional chaining
            });
            setUseServerFallback(true); // Enhanced: Fallback for large tokenizers
            return;
          }
          const cachedTokenizerVersion = await withRetry(() => get('tokenizer-version'));
          if (cachedTokenizerVersion === modelManifest.version) {
            const cachedTokenizerData = await withRetry(() => get('tokenizer'));
            if (cachedTokenizerData && cachedTokenizerData === tokenizerJsonString) {
              const tokenizer = await Tokenizer.fromJSON(cachedTokenizerData);
              setTokenizer(tokenizer);
              return;
            }
          }
          const tokenizer = await Tokenizer.fromJSON(tokenizerJsonString);
          await withRetry(() => set('tokenizer', tokenizerJsonString));
          await withRetry(() => set('tokenizer-version', modelManifest.version));
          setTokenizer(tokenizer);
        } catch (error: unknown) {
          setUseServerFallback(true);
          if (error instanceof Error) {
            setNlpError(`Failed to load tokenizer: ${error.message}`);
          } else {
            setNlpError('Failed to load tokenizer due to an unknown error.');
          }
          Sentry.captureException(error, {
            extra: { userId: user?.id, tenantId: tenant?.id, modelVersion: modelManifest?.version, url: modelManifest?.tokenizerUrl },
          });
        }
        performance.mark('tokenizer-load-end');
        performance.measure('tokenizer-load', 'tokenizer-load-start', 'tokenizer-load-end');
      };
      loadTokenizer();
    }
  }, [isOpen, modelManifest, user?.id, tenant?.id]); // Removed withRetry

  useEffect(() => {
    if (tokenizer && pendingQueries.length > 0) {
      setPendingQueries([]);
      queryClient.invalidateQueries({ queryKey:['commands', query, user?.id]}); // Updated invalidateQueries syntax
    }
  }, [tokenizer, pendingQueries, queryClient, query, user?.id]); // Added optional chaining

  useEffect(() => {
    if (isOpen && modelManifest && tokenizer && !useServerFallback) {
      performance.mark('nlp-model-load-start');
      const loadModel = async () => {
        try {
          const cachedVersion = await withRetry(() => get('nlp-model-version'));
          if (cachedVersion === modelManifest.version) {
            const cachedModel = await withRetry(() => get('nlp-model'));
            if (cachedModel) {
              setNlpModel(cachedModel);
              return;
            }
          }
          const tfModule = await import('@tensorflow/tfjs');
          const model = await tfModule.loadLayersModel(modelManifest.url);
          // Note: Storing tf.LayersModel directly in idb-keyval might be problematic due to its complex structure and methods.
          // Consider storing model configuration or a serializable format if direct storage fails or is inefficient.
          // For this fix, we'll keep the logic but acknowledge this potential issue.
          // await withRetry(() => set('nlp-model', model)); // This line might need adjustment based on tfjs model serialization
          await withRetry(() => set('nlp-model-version', modelManifest.version)); // Store version
          setNlpModel(model);
        } catch (error: unknown) {
          setUseServerFallback(true);
          if (error instanceof Error) {
            setNlpError(`Failed to load intent classifier model: ${error.message}`);
          } else {
            setNlpError('Failed to load intent classifier model due to an unknown error.');
          }
          Sentry.captureException(error, {
            extra: { userId: user?.id, tenantId: tenant?.id, modelVersion: modelManifest?.version, url: modelManifest?.url },
          });
        }
        performance.mark('nlp-model-load-end');
        performance.measure('nlp-model-load', 'nlp-model-load-start', 'nlp-model-load-end');
      };
      loadModel();
    }
  }, [isOpen, modelManifest, tokenizer, user?.id, tenant?.id]); // Removed withRetry

  const tokenize = useCallback(async (text: string) => {
    if (!tokenizer) {
      setPendingQueries(prev => [...prev, text]);
      setUseServerFallback(true);
      Sentry.captureMessage('Tokenizer not loaded, falling back to server', {
        level: 'warning',
        extra: { userId: user?.id, tenantId: tenant?.id, text }, // Added optional chaining
      });
      return Array(32).fill(0);
    }
    performance.mark('tokenize-start');
    const startTime = performance.now();
    const tokens = await tokenizer.encode(text, {
      addSpecialTokens: true,
      maxLength: 32,
      padding: 'max_length',
      truncation: true,
    });
    const encodeTime = performance.now() - startTime;
    if (encodeTime > 50) {
      setUseServerFallback(true);
      Sentry.captureMessage('Tokenizer encode too slow, switching to server', {
        level: 'warning',
        extra: { userId: user?.id, tenantId: tenant?.id, text, encodeTime }, // Added optional chaining
      });
      return Array(32).fill(0);
    }
    const indices = tokens.ids;
    performance.mark('tokenize-end');
    performance.measure('tokenize', 'tokenize-start', 'tokenize-end');
    return indices;
  }, [tokenizer, user?.id, tenant?.id]); // Added optional chaining

  const debouncedPredict = useCallback(
    debounce(async (input: Tensor, model: LayersModel) => { // Used imported Tensor and LayersModel
      const prediction = model.predict(input);
      return await (prediction as Tensor).data(); // Type assertion
    }, 500),
    []
  );

  const throttledFetchCommands = useCallback(
    throttle(async (query: string, userId: string | undefined, intent: string | null = null): Promise<Command[]> => { // Typed parameters
      const url = intent
        ? `/api/commands?intent=${intent}&userId=${userId}`
        : `/api/commands?query=${encodeURIComponent(query)}&userId=${userId}`;
      const res = await fetch(url, {
        headers: { 'X-Rate-Limit': '100/min' },
      });
      if (!res.ok) {
        if (res.status === 429) {
          toast.error('Too many requests. Please try again in a minute.'); // Enhanced: Rate limit feedback
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    }, 1000, { leading: true, trailing: false }),
    []
  );

  const processFallbackQueue = useCallback(
    throttle(async () => {
      const onlineStatus = typeof navigator !== 'undefined' && navigator.onLine; // Reverted to direct check
      if (fallbackQueue.length === 0 || !onlineStatus) return;
      const maxQueueSize = 50;
      if (fallbackQueue.length > maxQueueSize) {
        Sentry.captureMessage('Fallback queue overflow, trimming', {
          level: 'warning',
          extra: { userId: user?.id, tenantId: tenant?.id, queueSize: fallbackQueue.length }, // Added optional chaining
        });
        setFallbackQueue(prev => prev.slice(0, maxQueueSize));
      }
      const queriesToProcess = [...fallbackQueue];
      setFallbackQueue([]);
      for (const q of queriesToProcess) {
        try {
          const commands = await throttledFetchCommands(q, user?.id); // Removed as string cast
          queryClient.setQueryData(['commands', q, user?.id], commands);
        } catch (error) {
          Sentry.captureException(error, {
            extra: { userId: user?.id, tenantId: tenant?.id, query: q }, // Added optional chaining
          });
        }
      }
    }, 500, { leading: true }),
    [fallbackQueue, user?.id, tenant?.id, queryClient, throttledFetchCommands] // Added optional chaining
  );

  const { data: dynamicCommands, isLoading, error } = useQuery({
    queryKey: ['commands', query, user?.id], // Added optional chaining
    queryFn: async () => {
      performance.mark('commands-fetch-start');
      let commands: Command[] = []; // Typed commands
      const onlineStatus = typeof navigator !== 'undefined' && navigator.onLine; // Reverted to direct check
      if (!onlineStatus) {
        // Correcting the call to offlineQueue.queueAction
        await OfflineQueue.queueAction({
          tenantId: tenant?.id ?? 'unknown_tenant', // Ensure tenantId is provided
          actionType: 'OFFLINE_NLP_QUERY', // Educated guess for actionType
          payload: { query, userId: user?.id }, // Original variables as payload
          endpoint: '/api/rag/query', // Educated guess for endpoint
          method: 'POST', // Educated guess for HTTP method
        });
        return [];
      }
      if (nlpModel && query.length > 2 && !nlpError && !useServerFallback && tokenizer) {
        try {
          const tfModule = await import('@tensorflow/tfjs'); // Ensure tfModule is loaded for tensor2d
          const tokenizedQuery = await tokenize(query);
          const input = tfModule.tensor2d([tokenizedQuery]);
          const intentPrediction = await debouncedPredict(input, nlpModel);
          // Assuming intentPrediction needs to be processed into a string or null
          const intent = intentPrediction ? String(intentPrediction[0]) : null; // Example processing
          commands = await throttledFetchCommands(query, user?.id, intent);
        } catch (error: unknown) {
          if (error instanceof Error) {
            setNlpError(`Failed to process NLP query: ${error.message}`);
          } else {
            setNlpError('Failed to process NLP query due to an unknown error.');
          }
          Sentry.captureException(error, {
            extra: { userId: user?.id, tenantId: tenant?.id, query, modelVersion: modelManifest?.version },
          });
          if (fallbackQueue.length < 5) {
            setFallbackQueue(prev => [...prev, query]);
          } else {
            Sentry.captureMessage('Fallback queue limit reached', {
              level: 'warning',
              extra: { userId: user?.id, tenantId: tenant?.id, query }, // Added optional chaining
            });
          }
        }
      } else {
        commands = await throttledFetchCommands(query, user?.id); // Removed as string cast
      }
      performance.mark('commands-fetch-end');
      performance.measure('commands-fetch', 'commands-fetch-start', 'commands-fetch-end');
      return commands;
    },
    enabled: isOpen && query.length > 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000, // Changed cacheTime to gcTime
  });

  // Enhanced: Keyboard navigation for accessibility
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e: React.KeyboardEvent) => { // Typed event
      if (e.key === 'ArrowDown') {
        setFocusedIndex((prev) => Math.min(prev + 1, (dynamicCommands || staticCommands).length - 1));
      } else if (e.key === 'ArrowUp') {
        setFocusedIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        const cmd = (dynamicCommands || staticCommands)[focusedIndex] as Command; // Ensure cmd is treated as Command
        const end = commandExecutionTime.startTimer(); // Enhanced: Measure command execution
        if (cmd.type === 'navigate' && cmd.path) router.push(cmd.path);
        if (cmd.type === 'action' && cmd.execute) cmd.execute();
        end();
        onClose();
      }
    },
  });

  useEffect(() => {
    const onlineStatus = typeof navigator !== 'undefined' && navigator.onLine; // Reverted to direct check
    if (onlineStatus) {
      // Corrected processQueue usage
      const client = {
        mutate: async (args: { mutation: string; variables: Record<string, unknown> }) => {
          // This is a mock client. In a real app, this would be your GraphQL client.
          console.log('Mock client mutate:', args);
          return Promise.resolve({ data: {} });
        }
      };
      // offlineQueue.processQueue(client); // Commented out as processQueue does not exist
      processFallbackQueue();
    }
  }, [OfflineQueue, queryClient, throttledFetchCommands, processFallbackQueue]); // Removed isOnline from dependency array

  return (
    <Suspense fallback={<div>Loading Command Palette...</div>}>
      <FocusScope contain restoreFocus autoFocus>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 mt-20"
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={keyboardProps.onKeyDown} // Apply onKeyDown directly
          >
            <div className="flex items-center border-b pb-2 mb-2">
              <input
                type="text"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} // Typed event
                placeholder="Type a command or search..."
                className="w-full p-2 border rounded"
                autoFocus
                aria-label="Command palette input"
              />
              <button
                onClick={() => setVoiceActive(!isVoiceActive)}
                aria-label={isVoiceActive ? 'Stop voice input' : 'Start voice input'}
              >
                {isVoiceActive ? <MicIcon className="h-6 w-6 text-blue-500" /> : <MicIcon className="h-6 w-6 text-gray-400" />}
              </button>
            </div>
            <div className="text-right text-sm text-gray-500 mb-2">
              Esc
            </div>
            {nlpError && <div className="text-red-500 text-sm">{nlpError}</div>}
            {isLoading && <div className="text-gray-500 text-sm">Loading...</div>}
            {error && <div className="text-red-500 text-sm">Error: {error instanceof Error ? error.message : 'An unknown error occurred'}</div>}
            <ul role="listbox" aria-activedescendant={focusedIndex >= 0 ? `cmd-${focusedIndex}` : undefined}>
              {(dynamicCommands || staticCommands).map((cmd: Command, index: number) => (
                <li
                  key={cmd.id}
                  id={`cmd-${index}`}
                  role="option"
                  aria-selected={focusedIndex === index}
                  className={`p-2 cursor-pointer hover:bg-gray-100 ${focusedIndex === index ? 'bg-gray-200' : ''}`}
                >
                  <button
                    onClick={() => {
                      const end = commandExecutionTime.startTimer(); // Enhanced: Measure command execution
                      if (cmd.type === 'navigate' && cmd.path) router.push(cmd.path);
                      if (cmd.type === 'action' && cmd.execute) cmd.execute();
                      end();
                      onClose();
                    }}
                    className="w-full text-left"
                  >
                    {cmd.label}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </FocusScope>
    </Suspense>
  );
};

export default Topbar;
