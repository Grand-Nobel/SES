import { createTranslator } from 'next-intl';
import { supabase } from './supabase';
import { get, set } from 'idb-keyval';

export async function getTranslator(locale: string, namespace: string, agentHint?: string) {
  const effectiveLocale = agentHint || locale;
  const cacheKey = `translations_${effectiveLocale}_${namespace}`;
  const cached = await get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return createTranslator({ locale: effectiveLocale, namespace, messages: cached.translations });
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from('translations')
    .select('key, value')
    .eq('locale', effectiveLocale)
    .eq('namespace', namespace);

  let translations = Object.fromEntries(messagesData?.map(({ key, value }) => [key, value]) ?? []);

  if (messagesError || !messagesData?.length) {
    console.warn(`No translations found for locale ${effectiveLocale}, namespace ${namespace}. Falling back to 'en'.`, messagesError);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('translations')
      .select('key, value')
      .eq('locale', 'en')
      .eq('namespace', namespace);
    translations = Object.fromEntries(fallbackData?.map(({ key, value }) => [key, value]) ?? []);
    if (fallbackError) {
      console.error('Error fetching fallback translations:', fallbackError);
    }
  }

  await set(cacheKey, {
    translations,
    expires: Date.now() + 24 * 60 * 60 * 1000,
  });

  return createTranslator({ locale: effectiveLocale, namespace, messages: translations });
}
