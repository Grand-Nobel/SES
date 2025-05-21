import fs from 'fs';
import tokens from '../tokens/seed-tokens.json';

// CSS Custom Properties
const cssVars = Object.entries(tokens.colors).map(([key, value]) => `--color-${key}: ${value};`).join('\\n');
fs.writeFileSync('public/styles/tokens.css', `:root {\\n${cssVars}\\n}`);

// Tailwind Config
const tailwindConfig = `
module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(tokens.colors, null, 2)},
      spacing: ${JSON.stringify(tokens.spacing, null, 2)},
      fontFamily: {
        primary: ["${tokens.typography['family-primary']}"],
        secondary: ["${tokens.typography['family-secondary']}"]
      },
      fontSize: ${JSON.stringify({
        body: tokens.typography['text-body'],
        caption: tokens.typography['text-caption']
      }, null, 2)},
      borderRadius: ${JSON.stringify(tokens.radii, null, 2)},
      boxShadow: ${JSON.stringify(tokens.shadows, null, 2)},
      transitionDuration: {
        short: "${tokens.motion['duration-short']}",
        medium: "${tokens.motion['duration-medium']}"
      }
    }
  }
};
`;
fs.writeFileSync('tailwind.config.js', tailwindConfig);

// Flutter (simplified)
const flutterTokens = `
class SeedTokens {
  static const Map colors = ${JSON.stringify(tokens.colors, null, 2)};
  static const Map spacing = ${JSON.stringify(tokens.spacing, null, 2)};
}
`;
fs.writeFileSync('flutter/lib/tokens.dart', flutterTokens);
