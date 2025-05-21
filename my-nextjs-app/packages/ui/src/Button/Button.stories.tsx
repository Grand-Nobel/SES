import React from 'react';
import { Story, Meta } from '@storybook/react';
import Button, { ButtonProps } from './Button';

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    loading: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
} as Meta;

const Template: Story<ButtonProps> = (args: ButtonProps) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = { children: 'Primary Button', variant: 'primary', loading: false };

export const Secondary = Template.bind({});
Secondary.args = { children: 'Secondary Button', variant: 'secondary', loading: false };

export const Loading = Template.bind({});
Loading.args = { children: 'Loading Button', variant: 'primary', loading: true };
