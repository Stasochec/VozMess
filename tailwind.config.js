/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF7A00', // core Vozduxan orange
          600: '#E66E00',
          700: '#C25700',
          800: '#9A4300',
          900: '#7C3400',
          gradientStart: '#FF9500',
          gradientEnd: '#FF5500',
          lightBubble: '#FFF0E6',
          darkBubble: '#994200',
        },
        dark: {
          bg: '#0F0F12',
          sidebar: '#18181C',
          card: '#1F1F24',
          hover: '#26262D',
          border: '#2C2C35',
          textMuted: '#8E8E93',
          bubbleIn: '#212127',
          bubbleOut: '#8C3E00',
        },
        light: {
          bg: '#F4F4F5',
          sidebar: '#FFFFFF',
          card: '#FAFAFA',
          hover: '#F2F2F5',
          border: '#E4E4E7',
          textMuted: '#71717A',
          bubbleIn: '#FFFFFF',
          bubbleOut: '#FFEADC',
        }
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'Inter',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        'brand-glow': '0 0 20px -3px rgba(255, 122, 0, 0.45)',
        'brand-glow-lg': '0 0 35px -5px rgba(255, 122, 0, 0.55)',
      },
      keyframes: {
        stream: {
          '0%': { transform: 'translateX(-100%) scaleX(0.8)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(100%) scaleX(1.2)', opacity: '0' },
        },
        vortex: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        }
      },
      animation: {
        'air-stream': 'stream 2.5s ease-in-out infinite',
        'vortex-slow': 'vortex 16s linear infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
