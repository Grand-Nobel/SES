// my-nextjs-app/src/app/api/validation-rules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodString } from 'zod'; // Ensure ZodString is imported if used explicitly
import { supabase } from '../../../lib/supabase'; // Adjusted path

// Define a schema for the expected rules structure if known
// For example, if rules is an object of string-based Zod schemas:
// const RuleSchema = z.string().min(1); // Example, adjust as per actual rule complexity
// const RulesObjectSchema = z.record(RuleSchema);

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('tenant_validation_rules') // Ensure this table exists and has 'rules' column
      .select('rules')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST error code for "0 rows"
        return NextResponse.json({ tenantId, rules: {} }, { status: 200 }); // No rules found is not an error
      }
      console.error('Failed to fetch validation rules:', error.message);
      return NextResponse.json({ error: 'Failed to fetch validation rules', details: error.message }, { status: 500 });
    }

    const rules = data?.rules || {}; // Default to empty object if rules are null/undefined

    // The outline attempts to parse each rule with z.string().min(1).parse(schema)
    // This implies 'rules' is an object where each value is a string that represents a Zod schema definition.
    // This is highly unusual. More commonly, 'rules' would directly contain the validation parameters or pre-defined schemas.
    // If rules are indeed stringified Zod schemas, parsing them safely is complex and potentially insecure if eval-like behavior is used.
    // For this implementation, I will assume 'rules' is an object of simple string values or pre-defined structures,
    // rather than stringified Zod schemas to be parsed at runtime.
    // If they *must* be parsed, a secure parsing mechanism is needed.

    // Example: If rules are just key-value string pairs for validation (e.g. regex patterns)
    const validatedRules: Record<string, string> = {};
    for (const key in rules) {
      if (typeof rules[key] === 'string') {
        validatedRules[key] = rules[key];
      } else {
        // Handle or log unexpected rule format
        console.warn(`Rule for key '${key}' is not a string, skipping.`);
      }
    }

    return NextResponse.json({ tenantId, rules: validatedRules }, { status: 200 });

  } catch (err) {
    console.error('Internal server error fetching validation rules:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal server error';
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}

// To match the outline's intent of parsing stringified Zod schemas (which is risky):
// This is a simplified and potentially UNSAFE example if eval is used.
// A safer approach would be to store schema *configurations* and build Zod schemas from those.
/*
async function parseAndValidateRules(rulesObject: any): Promise<Record<string, ZodString>> {
  const parsedRules: Record<string, ZodString> = {};
  for (const key in rulesObject) {
    if (typeof rulesObject[key] === 'string') {
      try {
        // THIS IS DANGEROUS if rulesObject[key] can be arbitrary code.
        // const schemaDefinition = rulesObject[key]; 
        // For example, if schemaDefinition is "z.string().min(5).email()"
        // You would need a safe way to construct this Zod schema.
        // A direct eval is not safe: const dynamicSchema = eval(schemaDefinition);
        // A safer way is to have predefined schema types and build them based on config.
        // For now, let's assume it's a simple string rule that needs to be a ZodString.
        parsedRules[key] = z.string().min(1); // Placeholder: actual parsing logic is complex and context-dependent
      } catch (e) {
        console.warn(`Failed to parse schema for rule '${key}':`, e);
      }
    }
  }
  return parsedRules;
}
*/