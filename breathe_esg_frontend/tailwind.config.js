/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1E3F20',
          light: '#2d5e30',
          dark: '#122613',
        },
        mint: {
          DEFAULT: '#2E7D32',
          light: '#4caf50',
          dark: '#1b5e20',
        },
        sage: {
          DEFAULT: '#F4F8F4',
          light: '#fbfdfb',
          dark: '#e3eae3',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
