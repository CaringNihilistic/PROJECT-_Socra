/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f0efe8',
          100: '#d4d2c8',
          200: '#b4b2a8',
          300: '#9998a0',
          400: '#7a7880',
          500: '#55545c',
          600: '#3e3d44',
          700: '#2e2e38',
          800: '#18181c',
          900: '#111114',
          950: '#0a0a0b',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        mono: ['"DM Mono"', 'monospace'],
        sans: ['"Instrument Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
