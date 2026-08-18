import React, { useState } from 'react';
import { SplashScreen } from '../components/SplashScreen';
import { Play, Moon, Sun, Smartphone, Layers } from 'lucide-react';

export const SplashShowcasePage: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<'both' | 'light' | 'dark'>('both');
  const [indicator, setIndicator] = useState<'dots' | 'progress' | 'both'>('dots');
  const [showSubtitle, setShowSubtitle] = useState<boolean>(true);
  const [animKey, setAnimKey] = useState<number>(0);
  const [isFullMobileView, setIsFullMobileView] = useState<boolean>(false);
  const [fullMobileTheme, setFullMobileTheme] = useState<'light' | 'dark'>('light');

  const replayAnimation = () => {
    setAnimKey((prev) => prev + 1);
  };

  if (isFullMobileView) {
    return (
      <div className="relative w-full h-full min-h-screen">
        {/* Floating control bar in fullscreen mode */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-700 text-xs">
          <button
            onClick={() => setFullMobileTheme(fullMobileTheme === 'light' ? 'dark' : 'light')}
            className="flex items-center gap-1 hover:text-teal-300 transition-colors px-2 py-1"
          >
            {fullMobileTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{fullMobileTheme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={replayAnimation}
            className="flex items-center gap-1 hover:text-teal-300 transition-colors px-2 py-1"
          >
            <Play size={14} />
            <span>Replay</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setIsFullMobileView(false)}
            className="hover:text-red-300 transition-colors px-2 py-1"
          >
            Exit Fullscreen
          </button>
        </div>

        <SplashScreen
          key={animKey}
          theme={fullMobileTheme}
          indicatorType={indicator}
          showSubtitle={showSubtitle}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center p-4 sm:p-8 font-sans">
      {/* Top Header / Meta Bar */}
      <header className="w-full max-w-6xl flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase bg-teal-100 text-teal-800 rounded border border-teal-200">
              Mobile Spec
            </span>
            <span className="text-xs text-slate-500 font-mono">9:19.5 Portrait Ratio</span>
          </div>
          <h1 className="text-2xl font-medium text-slate-900 mt-1">
            MäGA • Labour Entry System Splash Screen
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Utilitarian, high-contrast, flat field mobile splash screen with animated logo entrance & loading indicators.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={replayAnimation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
          >
            <Play size={15} className="text-teal-700" />
            <span>Replay Animation</span>
          </button>

          <button
            onClick={() => {
              setFullMobileTheme('light');
              setIsFullMobileView(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0a5a5d] text-white text-sm font-medium hover:bg-[#08484a] active:bg-[#063739] transition-colors shadow-sm"
          >
            <Smartphone size={15} />
            <span>Open Mobile View</span>
          </button>
        </div>
      </header>

      {/* Interactive Controls Bar */}
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-xl p-4 mb-8 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Theme Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium mr-1">
            Display Mode:
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
            <button
              onClick={() => setActiveTheme('both')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTheme === 'both'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side by Side (Both)
            </button>
            <button
              onClick={() => setActiveTheme('light')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTheme === 'light'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Light Surface
            </button>
            <button
              onClick={() => setActiveTheme('dark')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTheme === 'dark'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dark Surface
            </button>
          </div>
        </div>

        {/* Indicator Style Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium mr-1">
            Indicator:
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
            <button
              onClick={() => setIndicator('dots')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                indicator === 'dots'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 Pulsing Dots
            </button>
            <button
              onClick={() => setIndicator('progress')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                indicator === 'progress'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thin Progress Bar
            </button>
          </div>
        </div>

        {/* Subtitle Toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showSubtitle}
            onChange={(e) => setShowSubtitle(e.target.checked)}
            className="w-4 h-4 rounded text-[#0a5a5d] focus:ring-[#0a5a5d] border-slate-300"
          />
          <span>Show "Labour Entry System" text</span>
        </label>
      </div>

      {/* 9:19.5 Mobile Devices Showcase Container */}
      <div className="w-full max-w-6xl flex flex-wrap items-center justify-center gap-8 lg:gap-12 mb-12">
        {/* Light Variant Phone Frame */}
        {(activeTheme === 'both' || activeTheme === 'light') && (
          <div className="flex flex-col items-center">
            <div className="mb-3 flex items-center justify-between w-full px-2">
              <div className="flex items-center gap-1.5">
                <Sun size={14} className="text-amber-500" />
                <span className="text-xs font-medium text-slate-700">
                  Light Variant (Solid #f8fafc)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">9:19.5 • High Contrast</span>
            </div>

            {/* Mobile Phone Mockup (375px × 812px / 9:19.5 aspect ratio) */}
            <div
              className="relative w-[340px] sm:w-[370px] h-[720px] sm:h-[780px] bg-slate-900 rounded-[44px] p-3 shadow-2xl ring-1 ring-slate-800/10 flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.18)',
              }}
            >
              {/* Phone Speaker & Dynamic Island Pill */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-30 pointer-events-none flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 ml-auto mr-1.5" />
              </div>

              {/* Screen Inner Viewport */}
              <div className="w-full h-full rounded-[34px] overflow-hidden bg-[#f8fafc] relative">
                <SplashScreen
                  key={`light-${animKey}`}
                  theme="light"
                  indicatorType={indicator}
                  showSubtitle={showSubtitle}
                  isStandaloneMobile={false}
                  className="h-full"
                />

                {/* Home Indicator Bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Dark Variant Phone Frame */}
        {(activeTheme === 'both' || activeTheme === 'dark') && (
          <div className="flex flex-col items-center">
            <div className="mb-3 flex items-center justify-between w-full px-2">
              <div className="flex items-center gap-1.5">
                <Moon size={14} className="text-teal-400" />
                <span className="text-xs font-medium text-slate-700">
                  Dark Variant (Solid #091618)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">9:19.5 • Night / Rugged</span>
            </div>

            {/* Mobile Phone Mockup (375px × 812px / 9:19.5 aspect ratio) */}
            <div
              className="relative w-[340px] sm:w-[370px] h-[720px] sm:h-[780px] bg-slate-950 rounded-[44px] p-3 shadow-2xl ring-1 ring-slate-800/40 flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              }}
            >
              {/* Phone Speaker & Dynamic Island Pill */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-30 pointer-events-none flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 ml-auto mr-1.5" />
              </div>

              {/* Screen Inner Viewport */}
              <div className="w-full h-full rounded-[34px] overflow-hidden bg-[#091618] relative">
                <SplashScreen
                  key={`dark-${animKey}`}
                  theme="dark"
                  indicatorType={indicator}
                  showSubtitle={showSubtitle}
                  isStandaloneMobile={false}
                  className="h-full"
                />

                {/* Home Indicator Bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-700 rounded-full pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Design Specifications & Guidelines Card */}
      <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-900 mb-4 flex items-center gap-2">
          <Layers size={18} className="text-teal-700" />
          <span>Construction Field Design Specifications</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="border border-slate-100 bg-slate-50/70 rounded-lg p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Color Palette Harmony
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center justify-between">
                <span>Logo Native Teal:</span>
                <span className="font-mono font-medium text-slate-900">#0a5a5d</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Light Surface (Solid):</span>
                <span className="font-mono font-medium text-slate-900">#f8fafc (Slate-50)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Dark Surface (Solid):</span>
                <span className="font-mono font-medium text-slate-900">#091618 (Deep Night)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>No Gradients:</span>
                <span className="text-emerald-700 font-medium">100% Flat Solid Fill</span>
              </li>
            </ul>
          </div>

          <div className="border border-slate-100 bg-slate-50/70 rounded-lg p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Motion & Timing Curves
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center justify-between">
                <span>Logo Entrance:</span>
                <span className="font-mono text-slate-800">Scale 0.92 → 1.0 (750ms)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Entrance Easing:</span>
                <span className="font-mono text-slate-800">cubic-bezier(0.16, 1, 0.3, 1)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Bouncing Dots:</span>
                <span className="font-mono text-slate-800">1100ms loop (160ms delay)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Progress Bar:</span>
                <span className="font-mono text-slate-800">1400ms loop</span>
              </li>
            </ul>
          </div>

          <div className="border border-slate-100 bg-slate-50/70 rounded-lg p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Typography & Hierarchy
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center justify-between">
                <span>Visual Focus:</span>
                <span className="text-slate-900 font-medium">Logo Primary Anchor</span>
              </li>
              <li className="flex items-center justify-between">
                <span>App Title:</span>
                <span className="font-mono text-slate-800">Inter 12px / 500 / 0.18em</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Aspect Ratio:</span>
                <span className="font-mono text-slate-800">9:19.5 Portrait Format</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Field Clarity:</span>
                <span className="text-emerald-700 font-medium">Zero clutter & noise</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashShowcasePage;
