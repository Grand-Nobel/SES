import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { agentRunner } from '@/lib/agents'; // Assuming agentRunner is correctly set up
import { useAuthStore } from '@/stores/authStore';

export enum ImageType {
  DECORATIVE = 'decorative',
  FUNCTIONAL = 'functional',
  INFORMATIONAL = 'informational',
  COMPLEX = 'complex',
  TEXT = 'text',
}

export function getAltTextGuidelines(type: ImageType): string {
  switch (type) {
    case ImageType.DECORATIVE: return 'Use empty alt="" for decorative images that do not convey information and are purely stylistic.';
    case ImageType.FUNCTIONAL: return 'Describe the function or action of the image (e.g., "Search products", "Open user menu").';
    case ImageType.INFORMATIONAL: return 'Concisely describe the information the image conveys. Avoid "image of" or "picture of".';
    case ImageType.COMPLEX: return 'Provide a brief summary in alt text, and a longer description elsewhere on the page or via aria-describedby.';
    case ImageType.TEXT: return 'If the image is primarily text, transcribe all important text content accurately.';
    default: return 'Provide a concise, meaningful description of the image content and purpose.';
  }
}

export async function validateAltText(alt: string, type: ImageType): Promise<{
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (type === ImageType.DECORATIVE) {
    if (alt !== '') {
      issues.push('Decorative images should have empty alt text (alt="").');
      suggestions.push('Set alt text to an empty string.');
    }
    // For decorative images, if alt is empty, it's valid.
    // No further checks needed.
  } else { // For non-decorative images
    if (alt === '') {
      issues.push('Alt text should not be empty for non-decorative images.');
      suggestions.push('Add a descriptive alt text.');
    }
    if (/^(image of|picture of|graphic of|photo of)/i.test(alt)) {
      issues.push('Avoid redundant phrases like "image of", "picture of", etc.');
      suggestions.push('Describe the content directly, e.g., "A black cat" instead of "Image of a black cat".');
    }
    if (alt.length > 125 && type !== ImageType.COMPLEX && type !== ImageType.TEXT) {
      // W3C recommends around 125 characters as a guideline, not a strict rule.
      issues.push('Alt text is quite long (over 125 characters). Consider if it can be more concise or if it is a complex image.');
      suggestions.push('Aim for conciseness. If detailed description is needed, consider if it is a complex image requiring a longer description elsewhere.');
    }
    if (alt.length < 5 && alt !== '' && type === ImageType.INFORMATIONAL) { // Arbitrary short length check
        issues.push('Alt text seems very short. Ensure it adequately describes the image.');
        suggestions.push('Review if the description is sufficient for the image type.');
    }
  }
  
  const isValid = issues.length === 0;

  try {
    const maskedEvent = await PrivacyLogger().maskPersonalData({ alt, type, issues, suggestions, isValid });
    // @ts-ignore
    await supabase.from('ui_events').insert({
      tenant_id: useAuthStore().getState().tenantId,
      event: 'alt_text_validation',
      payload: maskedEvent,
    });
  } catch (error) {
    console.error("Failed to log alt_text_validation event:", error);
  }

  return { isValid, issues, suggestions };
}

export async function generateAiAltText(imageUrl: string, type: ImageType): Promise<string> {
  try {
    const response = await agentRunner.run({
      agentName: 'AltTextGenerator', // This agent needs to be defined and configured
      action: 'generateAltText',
      payload: { imageUrl, type, tenantId: useAuthStore().getState().tenantId },
      cache: { key: `alt-text:${imageUrl}:${type}`, ttl: 3600 }, // Added type to cache key
    });
    // @ts-ignore // Assuming response structure
    return response.altText || getAltTextGuidelines(type); // Fallback to guidelines
  } catch (error) {
    console.error("AI alt text generation failed:", error);
    // Fallback to guidelines if AI generation fails
    return getAltTextGuidelines(type);
  }
}
