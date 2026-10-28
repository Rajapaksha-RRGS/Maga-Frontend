import React from 'react';

interface TopUpErrorViewProps {
  title?: string;
  subtitle?: string;
  massage?: string;
  message?: string;
  onRetry?: () => void;
  buttonText?: string;
}

export const TopUpErrorView: React.FC<TopUpErrorViewProps> = ({
  title = "Something went wrong!",
  subtitle = "We have encountered an unexpected error.",
  massage,
  message,
  onRetry,
  buttonText = "RELOAD PAGE",
}) => {
  const displayError = message || massage;
  const handleReload = onRetry || (() => window.location.reload());

  return (
    <div className="flex flex-col items-center justify-center min-h-[440px] w-full p-6 text-center select-none">
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-2.5">
        {title}
      </h1>

      <p className="text-gray-600 text-sm md:text-base font-normal max-w-md mb-6">
        {subtitle}
      </p>

      {displayError && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200/70 rounded-md px-3.5 py-1.5 mb-6 max-w-md break-words font-mono">
          {displayError}
        </div>
      )}

      <button
        type="button"
        onClick={handleReload}
        className="bg-gradient-to-r from-[#6d00a8] via-[#880d83] to-[#a31562] hover:brightness-110 active:scale-95 text-white font-bold text-xs tracking-widest uppercase px-8 py-3 rounded-full shadow-lg shadow-purple-900/20 transition-all duration-200 cursor-pointer"
      >
        {buttonText}
      </button>
    </div>
  );
};
