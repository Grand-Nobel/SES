// Import global styles into Storybook
import '../src/app/globals.css'; // Next.js global styles
import '../public/styles/colors.css'; // Custom global colors
import '../public/styles/tokens.css'; // Generated design tokens
import '../public/styles/global.css'; // Other global styles like spacing utilities

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" }, // Log actions for on[A-Z].* props
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  // Viewport addon configuration (optional, can be customized)
  viewport: {
    // viewports: INITIAL_VIEWPORTS, // or your custom viewports
  },
  // Accessibility addon configuration (optional)
  a11y: {
    element: '#storybook-root', // or your app's root element
    config: {},
    options: {},
    manual: false,
  },
};
