module.exports = {
  stories: ['../packages/ui/src/**/*.stories.tsx', '../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'], // Adjusted to include packages/ui
  addons: [
    '@storybook/addon-links', // Default, good to keep
    '@storybook/addon-essentials', // Includes Controls, Actions, Backgrounds, etc.
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
    'storybook-addon-rtl', // Assuming this is the correct package name
    '@storybook/addon-interactions',
    // '@storybook/addon-knobs', // addon-essentials provides Controls, which is newer
  ],
  framework: {
    name: '@storybook/nextjs', // For Next.js specific features
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'], // To serve static assets from public folder
};
