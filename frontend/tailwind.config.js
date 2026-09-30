import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pixel redesign tokens (docs/superpowers/specs/2026-09-30-socra-pixel-foundation-design.md §3)
        px: {
          night: '#16142b',
          panel: '#221f3f',
          edge: '#3a3566',
          screen: '#f4ecd8',
          ink: '#1b1a2e',
          muted: '#b9b3d6',
          soft: '#d8d2ee',
          xp: '#ffd23f',
          'xp-dark': '#c9941a',
          plan: '#3ec7b5',
          'plan-dark': '#1f8577',
          glitch: '#e8474c', // fills/borders only: fails AA as text on a panel
          'glitch-dark': '#9e2a36',
          'glitch-text': '#ff7a7e',
          psy: '#9b7be0',
          steel: '#9aa7b8',
          psychic: '#e0609f',
          fighting: '#e0703a',
          electric: '#f5c518',
          ghost: '#5b3fa8',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'], // titles & names only, never below 10px
        term: ['VT323', 'monospace'], // all text: never below 20px, 22px+ for reading
      },
      typography: ({ theme }) => ({
        // `prose prose-pixel`: VT323 body at 22px (small x-height needs the size), pixel-face headings
        pixel: {
          css: {
            '--tw-prose-body': theme('colors.px.soft'),
            '--tw-prose-headings': theme('colors.px.screen'),
            '--tw-prose-links': theme('colors.px.plan'),
            '--tw-prose-bold': theme('colors.px.screen'),
            '--tw-prose-bullets': theme('colors.px.xp'),
            '--tw-prose-counters': theme('colors.px.xp'),
            '--tw-prose-hr': theme('colors.px.edge'),
            '--tw-prose-quotes': theme('colors.px.soft'),
            '--tw-prose-quote-borders': theme('colors.px.xp'),
            '--tw-prose-code': theme('colors.px.xp'),
            '--tw-prose-th-borders': theme('colors.px.edge'),
            '--tw-prose-td-borders': theme('colors.px.edge'),
            fontFamily: theme('fontFamily.term').join(', '),
            fontSize: '22px',
            lineHeight: '1.4',
            'h1, h2': {
              fontFamily: theme('fontFamily.pixel').join(', '),
              fontWeight: '400',
              lineHeight: '1.7',
            },
            h1: { fontSize: '14px' },
            h2: { fontSize: '12px', color: theme('colors.px.xp') },
            'thead th': {
              fontFamily: theme('fontFamily.term').join(', '),
              fontSize: '20px',
              fontWeight: '400',
            },
          },
        },
        // `prose prose-dialog`: markdown inside the cream dialog box, all ink (the only AA-safe text colour on cream)
        dialog: {
          css: {
            '--tw-prose-body': theme('colors.px.ink'),
            '--tw-prose-headings': theme('colors.px.ink'),
            '--tw-prose-links': theme('colors.px.ink'),
            '--tw-prose-bold': theme('colors.px.ink'),
            '--tw-prose-bullets': theme('colors.px.ink'),
            '--tw-prose-counters': theme('colors.px.ink'),
            '--tw-prose-hr': theme('colors.px.ink'),
            '--tw-prose-quotes': theme('colors.px.ink'),
            '--tw-prose-quote-borders': theme('colors.px.edge'),
            '--tw-prose-code': theme('colors.px.ink'),
            // Size and leading come from utilities on the element (text-[22px] leading-snug):
            // the base `prose` rule would win over them here
            fontFamily: theme('fontFamily.term').join(', '),
            p: { marginTop: '0.4em', marginBottom: '0.4em' },
            li: { marginTop: '0.15em', marginBottom: '0.15em' },
            'h1, h2, h3': {
              fontFamily: theme('fontFamily.pixel').join(', '),
              fontSize: '12px',
              fontWeight: '400',
              lineHeight: '1.7',
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
}
