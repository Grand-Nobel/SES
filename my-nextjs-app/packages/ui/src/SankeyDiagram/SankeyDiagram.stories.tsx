import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import SankeyDiagram, { SankeyDiagramProps } from './SankeyDiagram';

export default {
  title: 'Components/SankeyDiagram',
  component: SankeyDiagram,
  parameters: { a11y: { config: { rules: { 'aria-label': { enabled: true } } } } },
} as Meta;

const Template: StoryFn<SankeyDiagramProps> = (args) => <SankeyDiagram {...args} />;

export const Default = Template.bind({});
Default.args = {
  nodes: [
    { name: 'Lead A' },
    { name: 'Lead B' },
    { name: 'Sale' },
  ],
  links: [
    { source: 'Lead A', target: 'Sale', value: 5 },
    { source: 'Lead B', target: 'Sale', value: 3 },
  ],
  tenantId: 'tenant-1',
  chartId: 'chart-1',
};
