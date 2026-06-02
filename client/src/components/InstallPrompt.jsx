import React, { useState, useEffect } from 'react';
import { PlusSquare, Share, HelpCircle, X } from 'lucide-react';

function InstallPrompt() {
  const [isShown, setIsShown] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if the app is already running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (!isStandalone) {
      // Determine if the user is on iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const iosMatch = /iphone|ipad|ipod/.test(userAgent);
      setIsIos(iosMatch);
      
      // Check if user has previously dismissed the prompt during this session
      const dismissed = sessionStorage.getItem('traitors_install_dismissed');
      if (!dismissed) {
        setIsShown(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsShown(false);
    sessionStorage.setItem('traitors_install_dismissed', 'true');
  };

  if (!isShown) return null;

  return (
    <div className="pwa-install-prompt candle-glow">
      <button 
        onClick={handleDismiss} 
        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
      >
        <X size={18} />
      </button>

      <HelpCircle className="text-gold" size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
      <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--gold)' }}>Install Companion App</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
        Install this app on your phone to enable full-screen gothic atmosphere and receive critical alerts from the Game Master when your screen is locked.
      </p>

      <div style={{ borderTop: 'var(--border-dark)', paddingTop: '10px' }}>
        {isIos ? (
          <div>
            <div className="pwa-instruction-step">
              <span className="step-num">1</span>
              <span>Tap the <strong>Share</strong> button <Share size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', color: '#3b82f6' }} /> at the bottom of Safari.</span>
            </div>
            <div className="pwa-instruction-step">
              <span className="step-num">2</span>
              <span>Scroll down and select <strong>Add to Home Screen</strong> <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} />.</span>
            </div>
            <div className="pwa-instruction-step">
              <span className="step-num">3</span>
              <span>Launch "Traitors" from your home screen and grant notifications!</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="pwa-instruction-step">
              <span className="step-num">1</span>
              <span>Tap the browser menu icon (three dots in top right).</span>
            </div>
            <div className="pwa-instruction-step">
              <span className="step-num">2</span>
              <span>Select <strong>Install App</strong> or <strong>Add to Home Screen</strong>.</span>
            </div>
            <div className="pwa-instruction-step">
              <span className="step-num">3</span>
              <span>Open the app from your home screen to subscribe to pushes!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstallPrompt;
