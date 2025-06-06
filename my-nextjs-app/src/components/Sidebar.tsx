// Elite+++++++ Sidebar with configurable search threshold, predictive navigation, and accessibility
import React, { memo, useState, useEffect, useCallback } from 'react'; // Added React import
import { useAuth } from '../hooks/useAuth';
import { useUI } from '../hooks/useUI';
import { useWindowSize } from '../hooks/useWindowSize';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import * as Sentry from '@sentry/nextjs'; // Changed to nextjs
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NavItem from '../components/ui/NavItem'; // Adjusted import path
import { prefetchRouteData } from '../lib/prefetch'; // Changed to prefetchData
import { get, set } from 'idb-keyval';
import * as tf from '@tensorflow/tfjs';
import { debounce } from 'lodash';
import { useKeyboard } from '@react-aria/interactions'; // Enhanced: For accessibility

// Define basic types for now, assuming full definitions are elsewhere
interface NavItemType {
  id: string;
  label: string;
  path: string;
  icon?: string;
  parent_id?: string;
  user_id: string;
}

const Sidebar = memo(() => {
  const { session } = useAuth();
  const user = session?.user as { id: string; tenantId?: string } | undefined; // Assuming user object has an id and optional tenantId
  // Removed: const tenant = session?.tenant as { id: string } | undefined; // Property 'tenant' does not exist on type 'Session'.
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { width } = useWindowSize(); // Enhanced: For mobile responsiveness
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<NavItemType[]>([]); // Explicit type
  const [predictiveModel, setPredictiveModel] = useState<tf.LayersModel | null>(null); // Explicit type
  const [focusedIndex, setFocusedIndex] = useState(-1); // Enhanced: For accessibility
  const NAV_SEARCH_THRESHOLD = parseInt(process.env.NAV_SEARCH_THRESHOLD || '1000', 10);
  const isCondensed = width < 600; // Enhanced: Condensed mode for mobile

  const actualNavSearchThreshold = isNaN(NAV_SEARCH_THRESHOLD) ? 0 : NAV_SEARCH_THRESHOLD; // FIX 4: Ensure NAV_SEARCH_THRESHOLD is a valid number


  const { data: navItems, error: navError } = useQuery({
    queryKey: ['nav-items', user?.id], // FIX 3: Optional chaining for user.id
    queryFn: async () => {
      if (!user?.id) return []; // FIX 3: Return empty array if user.id is not available
      const { data, error } = await supabase
        .from('nav_items')
        .select('id, label, path, icon, parent_id, user_id')
        .eq('user_id', user.id); // user.id is safe here because of enabled: !!user?.id
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id, // FIX 3: Only enable query if user.id is available
  });

  useEffect(() => {
    const loadPredictiveModel = async () => {
      try {
        const model = await tf.loadLayersModel('/models/nav-predictor/model.json');
        setPredictiveModel(model as tf.LayersModel); // Type assertion
      } catch (error) {
        Sentry.captureException(error, {
          extra: { userId: user?.id, tenantId: user?.tenantId }, // FIX 2: Use user?.tenantId
        });
      }
    };
    loadPredictiveModel();
  }, [user?.id, user?.tenantId]); // FIX 2 & 3: Optional chaining and use user?.tenantId

  useEffect(() => {
    if (predictiveModel && navItems) {
      const predictFrequentItems = async () => {
        const input = tf.tensor2d([[parseInt(user?.id || '0'), parseInt(user?.tenantId || '0'), Date.now() % (24 * 60 * 60 * 1000)]]); // FIX 2: Use user?.tenantId
        const prediction = predictiveModel.predict(input) as tf.Tensor; // Type assertion
        const itemIndices = (await prediction.data()).slice(0, 3);
        itemIndices.forEach(async (index: number) => { // Explicit type
          const item = navItems[index];
          if (item) {
            try {
              // Removed navPrefetchTime as histogram is not exported
              await prefetchRouteData(item.path); // Changed to prefetchData
              // Removed end() as navPrefetchTime is removed
              await supabase.from('prefetch_metrics').insert({
                user_id: user?.id, // Added nullish coalescing
                path: item.path,
                hit: false, // Updated on navigation
              }); // Enhanced: Track prefetch accuracy
            } catch (error) {
              Sentry.captureException(error, {
                extra: { userId: user?.id, tenantId: user?.tenantId, path: item.path }, // FIX 2: Use user?.tenantId
              });
            }
          }
        });
      };
      predictFrequentItems();
    }
  }, [predictiveModel, navItems, user?.id, user?.tenantId]); // FIX 2: Use user?.tenantId

  const updatePreferencesWithRetry = async (prefs: { lastNav: string }) => { // Explicit type
    for (let i = 0; i < 3; i++) {
      try {
        await supabase.from('user_preferences').upsert({
          user_id: user?.id, // FIX 2: Optional chaining
          tenant_id: user?.tenantId, // FIX 2: Use user?.tenantId
          preferences: prefs,
        });
        return;
      } catch (error) {
        if (i === 2) {
          Sentry.captureException(error, {
            extra: { userId: user?.id, tenantId: user?.tenantId, attempt: i + 1 }, // FIX 2: Use user?.tenantId
          });
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (query: string) => { // Explicit type
      if (query.length < 2 || (navItems && navItems.length <= actualNavSearchThreshold)) {
        Sentry.captureMessage('Using client-side search', {
          level: 'info',
          extra: { userId: user?.id, tenantId: user?.tenantId, threshold: actualNavSearchThreshold, itemCount: navItems?.length }, // FIX 2: Use user?.tenantId
        });
        setFilteredItems(
          navItems?.filter((item: NavItemType) => item.label.toLowerCase().includes(query.toLowerCase())) || [] // Explicit type
        );
      } else {
        try {
          const { data, error } = await supabase
            .rpc('search_nav_items', { query, user_id: user?.id }); // Added nullish coalescing
          if (error) error;
          setFilteredItems(data as NavItemType[]); // Type assertion
        } catch (error) {
          Sentry.captureException(error, {
            extra: { userId: user?.id, tenantId: user?.tenantId, query }, // FIX 2: Use user?.tenantId
          });
          setFilteredItems([]);
        }
      }
    }, 300), // Enhanced: Debounced search
    [navItems, user?.id, user?.tenantId, actualNavSearchThreshold] // FIX 2: Use user?.tenantId
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Enhanced: Keyboard navigation for accessibility
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e: React.KeyboardEvent) => {
      const itemsToNavigate = filteredItems.length > 0 ? filteredItems : (navItems || []);
      if (e.key === 'ArrowDown') {
        setFocusedIndex((prev: number) => Math.min(prev + 1, itemsToNavigate.length - 1));
      } else if (e.key === 'ArrowUp') {
        setFocusedIndex((prev: number) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        const item = itemsToNavigate[focusedIndex];
        if (item) {
          updatePreferencesWithRetry({ lastNav: item.path });
        }
      }
    },
  });

  return (
    <motion.aside
      initial={{ x: -250 }}
      animate={{ x: isSidebarOpen ? 0 : -250 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-0 left-0 h-full bg-gray-800 text-white w-64 p-4 z-40 shadow-lg"
      role="navigation"
      aria-label="Main Sidebar Navigation"
    >
      <input
        type="text"
        value={searchQuery}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} // Explicit type
        className="w-full p-2 border rounded"
        style={{ display: isCondensed ? 'none' : 'block' }} // Enhanced: Hide on mobile
        placeholder="Search navigation..."
        aria-label="Search navigation items"
        {...keyboardProps} // FIX 6: Apply keyboardProps to the input
      />
      <ul className="mt-4" role="listbox" aria-activedescendant={focusedIndex >= 0 ? `nav-${focusedIndex}` : undefined}>
        {(filteredItems.length > 0 ? filteredItems : (navItems || []))?.map((item: NavItemType, index: number) => ( // FIX 5: Ensure navItems is an array
          <li
            key={item.id}
            id={`nav-${index}`}
            role="option"
            aria-selected={focusedIndex === index}
            className={`mb-2 ${focusedIndex === index ? 'bg-gray-700' : ''}`}
          >
            <NavItem
              item={item}
              isCondensed={isCondensed}
              onClick={() => updatePreferencesWithRetry({ lastNav: item.path })}
            />
          </li>
        ))}
      </ul>
    </motion.aside>
  );
});

export default Sidebar;
