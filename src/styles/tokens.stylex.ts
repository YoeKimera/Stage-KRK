import * as stylex from '@stylexjs/stylex';

export const colors = stylex.defineVars({
  background: '#101116',
  surface: '#17191f',
  surfaceRaised: '#1d2027',
  surfaceHover: '#252832',
  border: '#2b2e37',
  text: '#f5f4f1',
  textMuted: '#9b9da7',
  textSubtle: '#6f727d',
  accent: '#c3f36b',
  accentDark: '#8bbf35',
  blue: '#8e9cff',
  amber: '#f4bb69',
  danger: '#ff7777',
});

export const space = stylex.defineVars({
  pageMax: '1440px',
  headerHeight: '76px',
});
