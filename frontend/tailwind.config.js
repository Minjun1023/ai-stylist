
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        display: ['Playfair Display', 'Apple SD Gothic Neo', 'Malgun Gothic', 'serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#3C91E6',
          50: '#f3f8fe',
          100: '#e7f1fd',
          200: '#c7e0fb',
          300: '#96c7f6',
          400: '#60a9ef',
          500: '#3C91E6',
          600: '#2d77c7',
          700: '#2660a1',
          800: '#255286',
          900: '#24466f',
        },
        secondary: {
          DEFAULT: '#342E37',
          50: '#f6f5f6',
          100: '#ebe9ec',
          200: '#d7d3d8',
          300: '#b9b1bb',
          400: '#968b98',
          500: '#786d7a',
          600: '#5f565f',
          700: '#4f484f',
          800: '#423d42',
          900: '#342E37',
        },
      },
    },
  },
  plugins: [],
}
