import React from 'react';

interface NavItemProps {
  item: {
    id: string;
    label: string;
    path: string;
    icon?: string;
  };
  isCondensed: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ item, isCondensed, onClick }) => {
  return (
    <a href={item.path} onClick={onClick} className="flex items-center p-2 space-x-2 rounded-md hover:bg-gray-700">
      {item.icon && <img src={item.icon} alt={item.label} className="w-5 h-5" />}
      {!isCondensed && <span>{item.label}</span>}
    </a>
  );
};

export default NavItem;