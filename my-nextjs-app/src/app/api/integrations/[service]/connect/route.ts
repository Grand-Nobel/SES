import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  const service = request.url.split('/').pop(); // Extract service from the URL

  if (!tenantId || !service) {
    return NextResponse.json({ error: 'Missing tenant ID or service', code: 'MISSING_PARAMETERS' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('integrations')
      .upsert({ tenant_id: tenantId, service, status: 'connected' });
    if (error) throw error;
    return NextResponse.json({ status: 'connected' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to connect integration', code: 'INTEGRATION_FAILED', details: error.message },
      { status: 500 }
    );
  }
}
