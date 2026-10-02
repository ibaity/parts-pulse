import { useId } from 'react';

// "Signal Nut" mark: a hex nut (parts) sending pulse waves (live stock monitoring).
export default function AppLogo({ className = 'w-9 h-9', title = 'MEDISERV Inventory' }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3ddc97" />
          <stop offset="1" stopColor="#1f8f66" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        fill={`url(#${gid})`}
        d="M18 18 H34 L42 32 L34 46 H18 L10 32 Z M26 25.5 A6.5 6.5 0 1 0 26 38.5 A6.5 6.5 0 1 0 26 25.5 Z"
      />
      <path d="M46 20 A16 16 0 0 1 46 44" fill="none" stroke="#3ddc97" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M53 13 A26 26 0 0 1 53 51" fill="none" stroke="#3ddc97" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
