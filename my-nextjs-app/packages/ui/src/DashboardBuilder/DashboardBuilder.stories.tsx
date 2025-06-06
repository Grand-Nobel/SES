import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import DashboardBuilder, { DashboardBuilderProps } from './DashboardBuilder';

export default {
  title: 'Components/DashboardBuilder',
  component: DashboardBuilder,
  parameters: { a11y: { config: { rules: { 'aria-label': { enabled: true } } } } },
} as Meta;

const Template: StoryFn<DashboardBuilderProps> = (args) => <DashboardBuilder {...args} />;

export const Default = Template.bind({});
Default.args = {
  initialLayout: [
    { id: 'widget-1', type: 'kpi', x: 0, y: 0, w: 2, h: 2, config: { title: 'Revenue', value: 100000, trend: 'up' } },
  ],
};
