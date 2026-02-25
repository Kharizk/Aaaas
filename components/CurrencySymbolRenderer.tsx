import React from 'react';
import { CurrencySymbolType } from '../types';

export const SaudiRiyalIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M16 3v18" />
    <path d="M8 3v14c0 2.5-2 4-4 4" />
    <path d="M3 10h18" />
    <path d="M3 14h18" />
  </svg>
);

interface CurrencySymbolRendererProps {
  type: CurrencySymbolType;
  imageUrl?: string | null;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const CurrencySymbolRenderer: React.FC<CurrencySymbolRendererProps> = ({ type, imageUrl, color, className, style }) => {
  if (type === 'custom_image' && imageUrl) {
    return <img src={imageUrl} className={`object-contain ${className}`} style={style} alt="Currency" />;
  }
  
  if (type === 'icon') {
    return <SaudiRiyalIcon className={className} style={{ ...style, color }} />;
  }

  return <span className={className} style={{ ...style, color }}>ر.س</span>;
};
