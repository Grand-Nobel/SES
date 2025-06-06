import { memo, useMemo, useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useAuth, useNotifications, useUI, useAgentSuggestions, useWindowSize } from '../hooks';
import { motion } from 'framer-motion';
import { debounce, throttle } from 'lodash';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TenantLogo, RoleSwitcher, NotificationDropdown, SettingsDropdown, UserMenu, CommandPalette, ContextualAction } from '../components/ui';
import { MenuIcon, SearchIcon, SparkleIcon, MicIcon } from '../components/icons';
import { useRouter } from 'next/navigation';
import { FocusScope, useKeyboard } from '@react-aria/focus';
import { supabase } from '../lib/supabase';
import Fuse from 'fuse.js';
import * as Sentry from '@sentry/react';
import { PerformanceObserver, histogram } from '../lib/performance'; // Enhanced: Prometheus metrics
import { get, set } from 'idb-keyval';
import { Tokenizer } from '@huggingface/tokenizers';
import { OfflineQueue } from '../lib/integrations/offline/OfflineQueue';
import { isOnline } from '../lib/network';
import { toast } from 'react-toastify'; // Enhanced: For rate limit feedback

const tf = lazy(() => import('@tensorflow/tfjs'));

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV === 'production' ? 'prod' : 'staging',
  release: `app@${process.env.APP_VERSION}`,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});

const commandExecutionTime = histogram('topbar_command_execution_time', 'Time to execute a command in Topbar', [50, 100, 500]); // Enhanced: Prometheus metric

const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [isVoiceActive, setVoiceActive] = useState(false);
  const [nlpError, setNlpError] = useState(null);
  const [pendingQueries, setPendingQueries] = useState([]);
  const [fallbackQueue, setFallbackQueue] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(-1); // Enhanced: For accessibility
  const router = useRouter();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const offlineQueue = useMemo(() => new OfflineQueue('nlp-queries'), []);

  const staticCommands = [
    { id: 'dashboard', type: 'navigate', label: 'Go to Dashboard', path: '/dashboard', usageCount: 10, contextRelevance: 0.8 },
    { id: 'leads', type: 'navigate', label: 'Go to Leads', path: '/leads', usageCount: 15, contextRelevance: 0.9 },
    { id: 'new-lead', type: 'action', label: 'Create New Lead', execute: () => router.push('/leads/new'), usageCount: 5, contextRelevance: 0.7 },
  ];

  const fuse = useMemo(() => new Fuse(staticCommands, {
    keys: ['label'],
    threshold: 0.3,
    includeScore: true,
  }), []);

  const { data: modelManifest, refetch: refetchManifest } = useQuery({
    queryKey: ['nlp-model-manifest'],
    queryFn: async () => {
      const res = await fetch('/models/intent-classifier/manifest.json');
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const [nlpModel, setNlpModel] = useState(null);
  const [tokenizer, setTokenizer] = useState(null);
  const [useServerFallback, setUseServerFallback] = useState(false);

  // Enhanced: Voice input using SpeechRecognition
  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const recognition = useMemo(() => SpeechRecognition ? new SpeechRecognition() : null, []);

  useEffect(() => {
    if (isVoiceActive && recognition) {
      recognition.start();
      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setQuery(text);
        throttledParse(text);
      };
      recognition.onerror = (error) => {
        setNlpError(`Voice recognition failed: ${error.error}`);
        setVoiceActive(false);
        Sentry.captureException(error, { extra: { userId: user.id, tenantId: tenant.id } });
      };
      return () => recognition.stop();
    }
  }, [isVoiceActive, recognition, user.id, tenant.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      refetchManifest();
    }, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetchManifest]);

  const withRetry = async (fn, retries = 3) => {
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
              extra: { userId: user.id, tenantId: tenant.id, loadTime: performance.now() - start },
            });
            return;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const tokenizerData = await res.json();
          const sizeBytes = new TextEncoder().encode(JSON.stringify(tokenizerData)).length;
          if (sizeBytes > 1_000_000) {
            Sentry.captureMessage('Tokenizer size exceeds 1MB', {
              level: 'warning',
              extra: { userId: user.id, tenantId: tenant.id, sizeBytes, url: modelManifest.tokenizerUrl },
            });
            setUseServerFallback(true); // Enhanced: Fallback for large tokenizers
            return;
          }
          const cachedTokenizerVersion = await withRetry(() => get('tokenizer-version'));
          if (cachedTokenizerVersion === modelManifest.version) {
            const cachedTokenizerData = await withRetry(() => get('tokenizer'));
            if (cachedTokenizerData && cachedTokenizerData === JSON.stringify(tokenizerData)) {
              const tokenizer = await Tokenizer.fromJSON(cachedTokenizerData);
              setTokenizer(tokenizer);
              return;
            }
          }
          const tokenizer = await Tokenizer.fromJSON(tokenizerData);
          await withRetry(() => set('tokenizer', tokenizerData));
          await withRetry(() => set('tokenizer-version', modelManifest.version));
          setTokenizer(tokenizer);
        } catch (error) {
          setUseServerFallback(true);
          Sentry.captureException(error, {
            extra: { userId: user.id, tenantId: tenant.id, modelVersion: modelManifest?.version, url: modelManifest?.tokenizerUrl },
          });
        }
        performance.mark('tokenizer-load-end');
        performance.measure('tokenizer-load', 'tokenizer-load-start', 'tokenizer-load-end');
      };
      loadTokenizer();
    }
  }, [isOpen, modelManifest, user.id, tenant.id]);

  useEffect(() => {
    if (tokenizer && pendingQueries.length > 0) {
      setPendingQueries([]);
      queryClient.invalidateQueries(['commands', query, user.id]);
    }
  }, [tokenizer, pendingQueries, queryClient, query, user.id]);

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
          const model = await tf.loadLayersModel(modelManifest.url);
          await withRetry(() => set('nlp-model', model));
          await withRetry(() => set('nlp-model-version', modelManifest.version));
          setNlpModel(model);
        } catch (error) {
          setUseServerFallback(true);
          setNlpError(`Failed to load intent classifier model: ${error.message}`);
          Sentry.captureException(error, {
            extra: { userId: user.id, tenantId: tenant.id, modelVersion: modelManifest?.version, url: modelManifest?.url },
          });
        }
        performance.mark('nlp-model-load-end');
        performance.measure('nlp-model-load', 'nlp-model-load-start', 'nlp-model-load-end');
      };
      loadModel();
    }
  }, [isOpen, modelManifest, tokenizer, user.id, tenant.id]);

  const tokenize = useCallback((text) => {
    if (!tokenizer) {
      setPendingQueries(prev => [...prev, text]);
      setUseServerFallback(true);
      Sentry.captureMessage('Tokenizer not loaded, falling back to server', {
        level: 'warning',
        extra: { userId: user.id, tenantId: tenant.id, text },
      });
      return Array(32).fill(0);
    }
    performance.mark('tokenize-start');
    const startTime = performance.now();
    const tokens = tokenizer.encode(text, {
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
        extra: { userId: user.id, tenantId: tenant.id, text, encodeTime },
      });
      return Array(32).fill(0);
    }
    const indices = tokens.ids;
    performance.mark('tokenize-end');
    performance.measure('tokenize', 'tokenize-start', 'tokenize-end');
    return indices;
  }, [tokenizer, user.id, tenant.id]);

  const debouncedPredict = useCallback(
    debounce(async (input, model) => {
      const prediction = model.predict(input);
      return await prediction.data();
    }, 500),
    []
  );

  const throttledFetchCommands = useCallback(
    throttle(async (query, userId, intent = null) => {
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
      if (fallbackQueue.length === 0 || !isOnline()) return;
      const maxQueueSize = 50;
      if (fallbackQueue.length > maxQueueSize) {
        Sentry.captureMessage('Fallback queue overflow, trimming', {
          level: 'warning',
          extra: { userId: user.id, tenantId: tenant.id, queueSize: fallbackQueue.length },
        });
        setFallbackQueue(prev => prev.slice(0, maxQueueSize));
      }
      const queriesToProcess = [...fallbackQueue];
      setFallbackQueue([]);
      for (const q of queriesToProcess) {
        try {
          const commands = await throttledFetchCommands(q, user.id);
          queryClient.setQueryData(['commands', q, user.id], commands);
        } catch (error) {
          Sentry.captureException(error, {
            extra: { userId: user.id, tenantId: tenant.id, query: q },
          });
        }
      }
    }, 500, { leading: true }),
    [fallbackQueue, user.id, tenant.id, queryClient, throttledFetchCommands]
  );

  const { data: dynamicCommands, isLoading, error } = useQuery({
    queryKey: ['commands', query, user.id],
    queryFn: async () => {
      performance.mark('commands-fetch-start');
      let commands = [];
      if (!isOnline()) {
        await offlineQueue.enqueue({ query, userId: user.id });
        return [];
      }
      if (nlpModel && query.length > 2 && !nlpError && !useServerFallback && tokenizer) {
        try {
          const input = tf.tensor2d([tokenize(query)]);
          const intent = await debouncedPredict(input, nlpModel);
          commands = await throttledFetchCommands(query, user.id, intent);
        } catch (error) {
          setNlpError(`Failed to process NLP query: ${error.message}`);
          Sentry.captureException(error, {
            extra: { userId: user.id, tenantId: tenant.id, query, modelVersion: modelManifest?.version },
          });
          if (fallbackQueue.length < 5) {
            setFallbackQueue(prev => [...prev, query]);
          } else {
            Sentry.captureMessage('Fallback queue limit reached', {
              level: 'warning',
              extra: { userId: user.id, tenantId: tenant.id, query },
            });
          }
        }
      } else {
        commands = await throttledFetchCommands(query, user.id);
      }
      performance.mark('commands-fetch-end');
      performance.measure('commands-fetch', 'commands-fetch-start', 'commands-fetch-end');
      return commands;
    },
    enabled: isOpen && query.length > 2,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  // Enhanced: Keyboard navigation for accessibility
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown') {
        setFocusedIndex((prev) => Math.min(prev + 1, (dynamicCommands || staticCommands).length - 1));
      } else if (e.key === 'ArrowUp') {
        setFocusedIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        const cmd = (dynamicCommands || staticCommands)[focusedIndex];
        const end = commandExecutionTime.startTimer(); // Enhanced: Measure command execution
        if (cmd.type === 'navigate') router.push(cmd.path);
        if (cmd.type === 'action') cmd.execute();
        end();
        onClose();
      }
    },
  });

  useEffect(() => {
    if (isOnline()) {
      offlineQueue.process(async (item) => {
        const commands = await throttledFetchCommands(item.query, item.userId);
        queryClient.setQueryData(['commands', item.query, item.userId], commands);
      });
      processFallbackQueue();
    }
  }, [isOnline, offlineQueue, queryClient, throttledFetchCommands, processFallbackQueue]);

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
            {...keyboardProps}
          >
            <div className="flex items-center border-b pb-2 mb-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
            {error && <div className="text-red-500 text-sm">Error: {error.message}</div>}
            <ul role="listbox" aria-activedescendant={focusedIndex >= 0 ? `cmd-${focusedIndex}` : undefined}>
              {(dynamicCommands || staticCommands).map((cmd, index) => (
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
                      if (cmd.type === 'navigate') router.push(cmd.path);
                      if (cmd.type === 'action') cmd.execute();
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

export default CommandPalette;
