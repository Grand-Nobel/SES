import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/react';

export async function executeAction(actionId: string, payload: Record<string, unknown>) { // Changed any to Record<string, unknown>
  try {
    const { data, error } = await supabase
      .rpc('execute_action', { action_id: actionId, action_payload: payload })
      .throwOnError();
    if (error) throw error;
    return data;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export async function undoAction(actionId: string) {
  try {
    const { data, error } = await supabase
      .rpc('undo_action', { action_id: actionId })
      .throwOnError();
    if (error) throw error;
    return data;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}
