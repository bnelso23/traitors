import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function PlayerAvatar({ 
  name, 
  avatarUrl, 
  containerStyle = {},
  fallbackType = 'initials', 
  initialsSize = '0.85rem', 
  initialsColor = 'var(--gold)',
  shieldSize = 36,
  shieldClassName = 'text-gold',
  shieldStyle = {}
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (avatarUrl) {
      setImageSrc(avatarUrl);
      setFailed(false);
    } else if (name) {
      setImageSrc(`/defaults/${name}.jpg`);
      setFailed(false);
    } else {
      setImageSrc(null);
      setFailed(true);
    }
  }, [avatarUrl, name]);

  const handleError = () => {
    // If the custom upload failed, try the default .jpg image
    if (imageSrc === avatarUrl && name) {
      setImageSrc(`/defaults/${name}.jpg`);
    } else if (imageSrc === `/defaults/${name}.jpg` && name) {
      // Default .jpg failed, try .png
      setImageSrc(`/defaults/${name}.png`);
    } else if (imageSrc === `/defaults/${name}.png` && name) {
      // Default .png failed, try .jpeg
      setImageSrc(`/defaults/${name}.jpeg`);
    } else {
      // Everything failed
      setFailed(true);
    }
  };

  if (failed || !imageSrc) {
    if (fallbackType === 'shield') {
      return (
        <Shield 
          size={shieldSize} 
          className={shieldClassName} 
          style={shieldStyle} 
        />
      );
    }
    return (
      <div style={{
        ...containerStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <span style={{ fontSize: initialsSize, color: initialsColor, fontWeight: 'bold', fontFamily: 'var(--font-serif)' }}>
          {name ? name[0] : '?'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, overflow: 'hidden' }}>
      <img 
        src={imageSrc} 
        alt={name} 
        onError={handleError}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
      />
    </div>
  );
}
