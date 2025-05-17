import React from 'react';

interface AccessibleImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  // Add any specific accessible image props here if needed
}

const AccessibleImage: React.FC<AccessibleImageProps> = (props) => {
  return (
    <img {...props} />
  );
};

export default AccessibleImage;