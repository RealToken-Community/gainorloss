import React from 'react';

interface MagnetLinkProps {
  tokenAddress: string;
  userAddress: string;
  className?: string;
}

const MagnetLink: React.FC<MagnetLinkProps> = ({ tokenAddress, userAddress, className = '' }) => {
  const handleClick = () => {
    const url = `https://gnosisscan.io/token/${tokenAddress}?a=${userAddress}`;
    window.open(url, '_blank');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200 border border-blue-300 dark:border-blue-700 ${className}`}
      aria-label={`Voir les transactions sur GnosisScan pour ${tokenAddress}`}
      title={`Voir les transactions sur GnosisScan pour ${tokenAddress}`}
      tabIndex={0}
    >
      <svg
        className="w-4 h-4 text-blue-600 dark:text-blue-400"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z" />
      </svg>
    </button>
  );
};

export default MagnetLink; 