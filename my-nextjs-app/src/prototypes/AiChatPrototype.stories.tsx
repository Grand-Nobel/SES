import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import AiChatPrototype, { AiChatPrototypeProps } from './AiChatPrototype';

export default {
  title: 'Prototypes/AiChatPrototype',
  component: AiChatPrototype,
  parameters: { 
    a11y: { 
      config: { 
        rules: [
          { id: 'aria-label', enabled: true }, // Example, adjust as needed
          // You might need to disable certain rules if they conflict with complex components
          // or if ARIA attributes are dynamically generated in ways Storybook a11y addon can't easily parse.
        ],
      }, 
    },
  },
} as Meta;

const Template: StoryFn<AiChatPrototypeProps> = (args) => <AiChatPrototype {...args} />;

export const Default = Template.bind({});
Default.args = {
  initialSuggestions: ['Hello', 'How are you?', 'Tell me about SEED-OS'],
  'data-testid': 'ai-chat-prototype-storybook',
};

export const NoSuggestions = Template.bind({});
NoSuggestions.args = {
  initialSuggestions: [],
  'data-testid': 'ai-chat-prototype-no-suggestions-storybook',
};
