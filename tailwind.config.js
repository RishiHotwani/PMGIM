/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0B6CF6',
          blueDark: '#0252D7',
          blueLight: '#EBF3FE',
          green: '#05B667',
          greenLight: '#E6F8F0',
          orange: '#FF7315',
          orangeLight: '#FFF2E9',
          purple: '#8B46C6',
          purpleLight: '#F4EBFB',
          grayBg: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
