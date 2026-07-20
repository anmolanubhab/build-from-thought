// Minimal monochrome brand marks, rendered via currentColor so they inherit theme color.
import type { SVGProps } from "react";

export const ReactIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" {...props}>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    <g>
      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
    </g>
  </svg>
);

export const TypeScriptIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor" opacity="0.12" />
    <rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M7 10.5h5M9.5 10.5V17M13.5 15.2c0 1 .9 1.8 2 1.8s2-.6 2-1.5c0-2.2-4-1.3-4-3.5 0-.9.8-1.5 1.9-1.5s1.9.6 2 1.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export const TailwindIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35.99 1 2.13 2.15 4.59 2.15 2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C15.6 7.15 14.46 6 12 6zM7 12c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35.99 1 2.13 2.15 4.59 2.15 2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C10.6 13.15 9.46 12 7 12z" />
  </svg>
);

export const SupabaseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M13.3 2.2c.4-.5 1.2-.2 1.2.5v8.6h6c.9 0 1.4 1.1.8 1.8l-9.6 11.7c-.4.5-1.2.2-1.2-.5v-8.6h-6c-.9 0-1.4-1.1-.8-1.8L13.3 2.2z" />
  </svg>
);

export const VercelIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 3l10 18H2L12 3z" />
  </svg>
);

export const GitHubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 6.58 2 12.2c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49 0-.24-.01-1.02-.01-1.85-2.78.61-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.55 2.34 1.1 2.91.84.09-.66.35-1.1.63-1.35-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.8-4.58 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.2C22 6.58 17.52 2 12 2z" />
  </svg>
);
