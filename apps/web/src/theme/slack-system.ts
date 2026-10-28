import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Slack-inspired design tokens.
 * Colors/shadows approximate Slack's product UI (aubergine brand, soft elevation).
 */
const slackConfig = defineConfig({
  globalCss: {
    body: {
      bg: 'bg.canvas',
      color: 'fg.default',
      fontFamily: 'body',
      lineHeight: '1.5',
    },
    'a:focus-visible, button:focus-visible, input:focus-visible': {
      outline: '2px solid',
      outlineColor: 'slack.blue',
      outlineOffset: '2px',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: 'var(--font-lato), "Lato", "Helvetica Neue", Helvetica, sans-serif' },
        body: { value: 'var(--font-lato), "Lato", "Helvetica Neue", Helvetica, sans-serif' },
      },
      colors: {
        slack: {
          aubergine: { value: '#4A154B' },
          aubergineDark: { value: '#350D36' },
          aubergineDeep: { value: '#1A1D21' },
          white: { value: '#FFFFFF' },
          canvas: { value: '#F8F8F8' },
          ink: { value: '#1D1C1D' },
          muted: { value: '#616061' },
          border: { value: '#DDDDDD' },
          borderSubtle: { value: '#E8E8E8' },
          blue: { value: '#1264A3' },
          sky: { value: '#36C5F0' },
          green: { value: '#2EB67D' },
          greenDark: { value: '#007A5A' },
          yellow: { value: '#ECB22E' },
          red: { value: '#E01E5A' },
          hover: { value: '#F6F6F6' },
        },
      },
      shadows: {
        slack: {
          value:
            '0 0 0 1px rgba(29, 28, 29, 0.13), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        },
        slackMd: {
          value:
            '0 0 0 1px rgba(29, 28, 29, 0.13), 0 4px 12px 0 rgba(0, 0, 0, 0.12)',
        },
        slackLg: {
          value:
            '0 0 0 1px rgba(29, 28, 29, 0.08), 0 12px 28px 0 rgba(0, 0, 0, 0.15)',
        },
      },
      radii: {
        slack: { value: '8px' },
        slackLg: { value: '12px' },
      },
    },
    semanticTokens: {
      colors: {
        'bg.canvas': { value: '{colors.slack.canvas}' },
        'bg.panel': { value: '{colors.slack.white}' },
        'bg.brand': { value: '{colors.slack.aubergine}' },
        'bg.brand.hover': { value: '{colors.slack.aubergineDark}' },
        'fg.default': { value: '{colors.slack.ink}' },
        'fg.muted': { value: '{colors.slack.muted}' },
        'fg.inverse': { value: '{colors.slack.white}' },
        'border.default': { value: '{colors.slack.border}' },
        'border.subtle': { value: '{colors.slack.borderSubtle}' },
        'fg.link': { value: '{colors.slack.blue}' },
        'fg.success': { value: '{colors.slack.greenDark}' },
        'fg.danger': { value: '{colors.slack.red}' },
      },
      shadows: {
        'elevation.sm': { value: '{shadows.slack}' },
        'elevation.md': { value: '{shadows.slackMd}' },
        'elevation.lg': { value: '{shadows.slackLg}' },
      },
    },
    recipes: {
      button: {
        base: {
          fontWeight: '700',
          borderRadius: 'slack',
          transition: 'background 120ms ease, box-shadow 120ms ease, transform 120ms ease',
        },
        variants: {
          size: {
            md: { h: '40px', px: '16px', fontSize: '15px' },
            lg: { h: '44px', px: '20px', fontSize: '15px' },
          },
        },
      },
    },
  },
});

export const slackSystem = createSystem(defaultConfig, slackConfig);
