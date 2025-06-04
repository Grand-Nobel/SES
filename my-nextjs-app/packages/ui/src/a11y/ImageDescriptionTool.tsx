'use client';
import React, { useState, useEffect } from 'react';
import { ImageType, getAltTextGuidelines, validateAltText, generateAiAltText } from './alt-text-utils';
// Assuming AccessibleImage component will be available at this path or created later
// If not, this import will cause an error. For now, we'll proceed as per the outline.
// import { AccessibleImage } from '@/components/AccessibleImage'; 
import './ImageDescriptionTool.module.css';

interface ImageDescriptionToolProps {
  onGenerateAlt?: (alt: string, type: ImageType, longDescription?: string) => void; // Added longDescription
  initialSrc?: string;
  initialType?: ImageType;
  className?: string;
  'data-testid'?: string;
}

// Placeholder for AccessibleImage if not available, to avoid breaking the component
const AccessibleImagePlaceholder: React.FC<{ src: string; alt: string; className?: string; describedBy?: string }> = ({ src, alt, className, describedBy }) => {
  if (!src) return <div className={`image-description-tool__placeholder ${className || ''}`}>No image source provided</div>;
  return <img src={src} alt={alt} className={className} aria-describedby={describedBy} style={{ maxWidth: '100%', height: 'auto' }} />;
};


export const ImageDescriptionTool: React.FC<ImageDescriptionToolProps> = ({
  onGenerateAlt,
  initialSrc = '',
  initialType = ImageType.INFORMATIONAL,
  className = '',
  'data-testid': dataTestId = 'image-description-tool',
}) => {
  const [imageSrc, setImageSrc] = useState(initialSrc);
  const [imageType, setImageType] = useState<ImageType>(initialType);
  const [altText, setAltText] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [validation, setValidation] = useState<{ isValid: boolean; issues: string[]; suggestions: string[] } | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Update alt text placeholder when image type changes
  useEffect(() => {
    if (imageType === ImageType.DECORATIVE) {
      setAltText(''); // Decorative images should have empty alt text
    }
  }, [imageType]);

  const validateCurrentAlt = async () => {
    if (imageType === ImageType.DECORATIVE) {
        setValidation({ isValid: true, issues: [], suggestions: [] }); // Decorative is always valid with empty alt
        return;
    }
    const result = await validateAltText(altText, imageType);
    setValidation(result);
  };

  const handleGenerateAiAlt = async () => {
    if (!imageSrc) {
      setValidation({ isValid: false, issues: ['Image URL is required to generate AI alt text.'], suggestions: ['Enter an image URL.'] });
      return;
    }
    setIsLoadingAi(true);
    try {
      const aiAlt = await generateAiAltText(imageSrc, imageType);
      setAltText(aiAlt);
      // Automatically validate after AI generation
      const result = await validateAltText(aiAlt, imageType);
      setValidation(result);
    } catch (error) {
      console.error("Error generating AI alt text:", error);
      setValidation({ isValid: false, issues: ['AI alt text generation failed.'], suggestions: ['Try again or write manually.'] });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleGenerateCode = () => {
    if (onGenerateAlt) {
      onGenerateAlt(altText, imageType, imageType === ImageType.COMPLEX ? longDescription : undefined);
    }
    // The component itself displays the generated code, so onGenerateAlt might be for external use.
  };
  
  const longDescId = `${dataTestId}-long-desc`;

  return (
    <div className={`image-description-tool ${className}`} data-testid={dataTestId}>
      <div className="image-description-tool__preview" data-testid={`${dataTestId}-preview-section`}>
        {imageSrc ? (
          // Using placeholder for now. Replace with actual AccessibleImage if available.
          (<AccessibleImagePlaceholder src={imageSrc} alt={altText} className="image-description-tool__image" describedBy={imageType === ImageType.COMPLEX && longDescription ? longDescId : undefined} />)
        ) : (
          <div className="image-description-tool__placeholder" data-testid={`${dataTestId}-image-placeholder`}>Image Preview</div>
        )}
      </div>
      <div className="image-description-tool__controls">
        <div className="image-description-tool__input-group">
          <label htmlFor={`${dataTestId}-image-url`}>Image URL</label>
          <input
            id={`${dataTestId}-image-url`}
            type="text"
            value={imageSrc}
            onChange={(e) => setImageSrc(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="input" // Assuming a global .input class or define locally
            data-testid={`${dataTestId}-image-url`}
          />
        </div>
        
        <div className="image-description-tool__input-group">
          <label htmlFor={`${dataTestId}-image-type`}>Image Type</label>
          <select
            id={`${dataTestId}-image-type`}
            value={imageType}
            onChange={(e) => setImageType(e.target.value as ImageType)}
            className="select" // Assuming a global .select class or define locally
            data-testid={`${dataTestId}-image-type`}
          >
            {Object.values(ImageType).map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <p className="image-description-tool__guideline" data-testid={`${dataTestId}-guideline`}>{getAltTextGuidelines(imageType)}</p>
        </div>
        
        <div className="image-description-tool__input-group">
          <label htmlFor={`${dataTestId}-alt-text`}>Alt Text</label>
          <textarea // Changed to textarea for better multiline editing
            id={`${dataTestId}-alt-text`}
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder={imageType === ImageType.DECORATIVE ? 'Leave empty for decorative images' : 'Enter alt text'}
            className="textarea" // Assuming a global .textarea class or define locally
            rows={3}
            aria-describedby={`${dataTestId}-alt-text-help`}
            data-testid={`${dataTestId}-alt-text`}
            disabled={imageType === ImageType.DECORATIVE}
          />
          <small id={`${dataTestId}-alt-text-help`}>
            {imageType !== ImageType.DECORATIVE ? "Keep under 125 characters for most types unless it's text content." : "Alt text should be empty for decorative images."}
          </small>
        </div>
        
        {imageType === ImageType.COMPLEX && (
          <div className="image-description-tool__input-group">
            <label htmlFor={`${dataTestId}-long-description`}>Long Description</label>
            <textarea
              id={`${dataTestId}-long-description`}
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              placeholder="Enter detailed description for complex images"
              className="textarea"
              rows={4}
              data-testid={`${dataTestId}-long-description`}
            />
          </div>
        )}
        
        <div className="image-description-tool__actions">
          <button
            className="button button--secondary" // Assuming global button styles
            onClick={validateCurrentAlt}
            data-testid={`${dataTestId}-validate`}
            disabled={imageType === ImageType.DECORATIVE && altText !== ''}
          >
            Validate Alt Text
          </button>
          <button
            className="button button--primary"
            onClick={handleGenerateAiAlt}
            data-testid={`${dataTestId}-generate-ai`}
            disabled={isLoadingAi || !imageSrc || imageType === ImageType.DECORATIVE}
          >
            {isLoadingAi ? 'Generating...' : 'Generate AI Alt Text'}
          </button>
          <button
            className="button button--primary"
            onClick={handleGenerateCode}
            disabled={!imageSrc || (!altText && imageType !== ImageType.DECORATIVE)}
            data-testid={`${dataTestId}-generate-code`}
          >
            {onGenerateAlt ? 'Call onGenerateAlt' : 'Log Code to Console'}
          </button>
        </div>
      </div>
      {validation && (
        <div
          className={`image-description-tool__validation ${
            validation.isValid ? 'image-description-tool__validation--valid' : 'image-description-tool__validation--invalid'
          }`}
          data-testid={`${dataTestId}-validation-results`}
          role="alert"
        >
          <h4>Validation Results</h4>
          {validation.isValid ? (
            <p>✓ Alt text appears suitable based on current guidelines.</p>
          ) : (
            <>
              {validation.issues.length > 0 && (
                <div className="image-description-tool__issues">
                  <h5>Issues:</h5>
                  <ul>
                    {validation.issues.map((issue, index) => (
                      <li key={index} data-testid={`${dataTestId}-issue-${index}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.suggestions.length > 0 && (
                <div className="image-description-tool__suggestions">
                  <h5>Suggestions:</h5>
                  <ul>
                    {validation.suggestions.map((suggestion, index) => (
                      <li key={index} data-testid={`${dataTestId}-suggestion-${index}`}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="image-description-tool__code-output">
        <h4>Generated HTML Code Snippet</h4>
        <pre className="code" data-testid={`${dataTestId}-generated-code-snippet`}>
          <code>
            {imageType === ImageType.COMPLEX && longDescription ? (
              `<figure>\n  <img src="${imageSrc || 'image.jpg'}" alt="${altText}" aria-describedby="${longDescId}" />\n  <figcaption id="${longDescId}">${longDescription}</figcaption>\n</figure>`
            ) : (
              `<img src="${imageSrc || 'image.jpg'}" alt="${imageType === ImageType.DECORATIVE ? '' : altText}" />`
            )}
          </code>
        </pre>
      </div>
    </div>
  );
};
