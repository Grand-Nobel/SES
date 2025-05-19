'use client';
import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { agentRunner } from '@/lib/agents';
import './SmartInput.module.css';

interface SmartInputProps {
  name: string;
  label: string;
  schema: z.ZodString;
  initialSuggestions?: string[];
  'data-testid'?: string;
}

const SmartInput: React.FC<SmartInputProps> = ({
  name,
  label,
  schema,
  initialSuggestions = [],
  'data-testid': dataTestId = 'smart-input',
}) => {
  const { register, formState: { errors }, setValue } = useFormContext();
  const { tenantId } = useAuthStore();
  const [suggestions, setSuggestions] = useState(initialSuggestions);

  useEffect(() => {
    // Placeholder for WebSocket connection
    const ws = new WebSocket('wss://personalization.ses.com');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({ tenantId, field: name }));
    };
    return () => ws.close();
  }, [tenantId, name]);

  return (
    
      {label}
      
        {...register(name, {
          validate: (value) => {
            const result = schema.safeParse(value);
            return result.success ? true : result.error.errors[0].message;
          },
        })}
        id={name}
        data-testid={dataTestId}
        onChange={(e) => {
          setValue(name, e.target.value);
          // Placeholder for agentRunner interaction
          agentRunner.run({
            agentName: 'PersonalizationEngine',
            action: 'logInput',
            payload: { tenantId, field: name, value: e.target.value },
          });
        }}
      />
      {suggestions.length > 0 && (
        
          {suggestions.map((suggestion, index) => (
            
              setValue(name, suggestion)}
              role="option"
              aria-selected={false}
            >
              {suggestion}
            
          ))}
        
      )}
      {errors[name] && (
        
          {errors[name]?.message as string}
        
      )}
    
  );
};

export default SmartInput;