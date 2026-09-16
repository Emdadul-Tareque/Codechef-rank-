/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bccdff',
          300: '#8fa8ff',
          400: '#5c78ff',
          500: '#3550f5',
          600: '#2536d1',
          700: '#1f2ba8',
          800: '#1e2985',
          900: '#1c266b',
        },
      },
    },
  },
  plugins: [],
};
