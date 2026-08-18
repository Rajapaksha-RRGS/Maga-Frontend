import React from 'react';
import magaLogo from '../assets/maga-logo-47321F1221-seeklogo.com.png';

export interface SplashScreenProps {
  theme?: 'light' | 'dark';
  indicatorType?: 'dots' | 'progress' | 'both';
  showSubtitle?: boolean;
  onAnimationEnd?: () => void;
  className?: string;
  isStandaloneMobile?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  theme = 'light',
  indicatorType = 'dots',
  showSubtitle = true,
  className = '',
  isStandaloneMobile = true,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`relative flex flex-col items-center justify-between w-full h-full select-none overflow-hidden ${
        isDark ? 'bg-[#0a1416] text-slate-100' : 'bg-[#f8fafc] text-slate-800'
      } ${isStandaloneMobile ? 'min-h-screen min-h-[100svh]' : ''} ${className}`}
      style={{
        backgroundColor: isDark ? '#091618' : '#f8fafc',
      }}
    >
      {/* Top spacer for balanced vertical optical centering in 9:19.5 ratio */}
      <div className="w-full pt-12 flex items-center justify-center opacity-0 pointer-events-none">
        <span className="text-xs">Top Header Space</span>
      </div>

      {/* Center Hero Block: Logo + Entrance Animation + App Title */}
      <div className="flex flex-col items-center justify-center px-6 -mt-8 w-full max-w-xs">
        {/* Logo Container with Fade-in & Scale-up Entrance Animation */}
        <div className="relative flex items-center justify-center animate-splash-logo-entrance">
          <img
            src={magaLogo}
            alt="MäGA - The Saga of Quality Construction"
            className={`w-48 sm:w-52 h-auto object-contain transition-all duration-300 ${
              isDark ? 'brightness-[1.8] contrast-[1.1] drop-shadow-[0_0_1px_rgba(255,255,255,0.2)]' : ''
            }`}
            style={{
              maxWidth: '220px',
              imageRendering: 'auto',
            }}
          />
        </div>

        {/* Understated App Name */}
        {showSubtitle && (
          <div className="mt-5 text-center animate-splash-fade-in delay-200">
            <h1
              className={`text-[12px] font-medium tracking-[0.18em] uppercase ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                letterSpacing: '0.18em',
              }}
            >
              Labour Entry System
            </h1>
          </div>
        )}
      </div>

      {/* Bottom Loading Indicator Area */}
      <div className="w-full pb-14 sm:pb-16 flex flex-col items-center justify-center gap-3 animate-splash-fade-in delay-300">
        {/* Indicator: Pulsing / Bouncing Dots */}
        {(indicatorType === 'dots' || indicatorType === 'both') && (
          <div className="flex items-center justify-center gap-1.5 h-6">
            <span
              className="w-2 h-2 rounded-full animate-splash-bounce"
              style={{
                backgroundColor: isDark ? '#2dd4bf' : '#0a5a5d',
                animationDelay: '0ms',
              }}
            />
            <span
              className="w-2 h-2 rounded-full animate-splash-bounce"
              style={{
                backgroundColor: isDark ? '#2dd4bf' : '#0a5a5d',
                animationDelay: '160ms',
              }}
            />
            <span
              className="w-2 h-2 rounded-full animate-splash-bounce"
              style={{
                backgroundColor: isDark ? '#2dd4bf' : '#0a5a5d',
                animationDelay: '320ms',
              }}
            />
          </div>
        )}

        {/* Indicator: Thin Minimalist Progress Bar */}
        {(indicatorType === 'progress' || indicatorType === 'both') && (
          <div
            className={`relative w-28 h-[2.5px] rounded-full overflow-hidden ${
              isDark ? 'bg-slate-800' : 'bg-slate-200'
            }`}
          >
            <div
              className="absolute top-0 bottom-0 left-0 h-full rounded-full animate-splash-progress-indeterminate"
              style={{
                backgroundColor: isDark ? '#2dd4bf' : '#0a5a5d',
              }}
            />
          </div>
        )}

        {/* Optional subtle version tag */}
        <span
          className={`text-[10px] tracking-wider uppercase font-medium mt-1 ${
            isDark ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          v1.0 • Field Ready
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
