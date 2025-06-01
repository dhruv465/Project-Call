import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ProjectCallLogoSvg from '@/icons/ProjectCallLogo.svg?react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ width = 50, height = 50, className = '' }) => {
  const { theme } = useTheme();
  
  return (
    <div className={`logo-container ${className}`}>
      <ProjectCallLogoSvg 
        width={width} 
        height={height} 
        className={`text-foreground transition-all duration-300 hover:scale-105 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
        style={{
          filter: theme === 'dark' 
            ? 'drop-shadow(0 4px 12px rgba(255, 255, 255, 0.15)) brightness(1.1)' 
            : 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2)) contrast(1.1)',
          fontWeight: 'bold'
        }}
      />
    </div>
  );
};

export default Logo;
