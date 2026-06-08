import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        's2': '#1e1e1e',
        's3': '#252525',
        border: '#2a2a2a',
        'border-strong': '#3f3f3f',
        tx: '#d4d4d4',
        muted: '#6b6b6b',
        dim: '#3a3a3a',
        accent: '#f59e0b',
        'accent-dim': '#451a03',
        'accent-mid': '#92400e',
        success: '#22c55e',
        'success-dim': '#052e16',
        danger: '#ef4444',
        'danger-dim': '#450a0a',
        info: '#3b82f6',
        'info-dim': '#172554',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Fira Code"', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
