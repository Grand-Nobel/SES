// tailwind.config.js
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}', // Assuming this path is correct for your UI package
  ],
  theme: {
    extend: {
      colors: {
        background: '#1A1C2C',
        surface: '#212336',
        onBackground: '#E0E0FF',
        primary: '#00F0FF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: '8px',
      },
      spacing: {
        4: '16px',
        6: '24px',
      },
      fontSize: {
        h1: ['2.25rem', '2.5rem'],
        h2: ['1.5rem', '2rem'],
        body: ['1rem', '1.5rem'],
      },
    },
  },
}
