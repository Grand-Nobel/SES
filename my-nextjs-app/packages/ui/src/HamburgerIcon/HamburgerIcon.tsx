import React from 'react';

interface HamburgerIconProps {
  open?: boolean;
  className?: string;
}

export const HamburgerIcon: React.FC<HamburgerIconProps> = ({ open = false, className = '' }) => {
  return (
    <div className={`w-6 h-6 flex flex-col justify-around items-center ${className}`}>
      <span
        className={`block h-0.5 w-full bg-current transform transition duration-300 ease-in-out ${
          open ? 'rotate-45 translate-y-[0.5rem]' : ''
        }`}
      />
      <span
        className={`block h-0.5 w-full bg-current transform transition duration-300 ease-in-out ${
          open ? 'opacity-0' : ''
        }`}
      />
      <span
        className={`block h-0.5 w-full bg-current transform transition duration-300 ease-in-out ${
          open ? '-rotate-45 -translate-y-[0.5rem]' : ''
        }`}
      />
    </div>
  );
};
