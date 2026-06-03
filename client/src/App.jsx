import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import LoginScreen from './components/LoginScreen';
import PlayerDashboard from './components/PlayerDashboard';
import GMDashboard from './components/GMDashboard';
import InstallPrompt from './components/InstallPrompt';
import { Shield, MessageSquare, Award, LogOut, BellRing, User, Settings } from 'lucide-react';
import PlayerAvatar from './components/PlayerAvatar';

// Synthesize gothic sounds using browser Web Audio API
export const playSound = (type) => {
  try {
    const soundsEnabled = localStorage.getItem('traitors_sounds_enabled') !== 'false';
    if (!soundsEnabled) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    if (type === 'alert') {
      // Gothic Gong sound
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(110, audioCtx.currentTime); // A2
      osc1.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 2);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(115, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(57.5, audioCtx.currentTime + 2);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 2.1);
      osc2.stop(audioCtx.currentTime + 2.1);
    } else if (type === 'message') {
      // Light paper / text alert
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'death') {
      // Dark descending tone
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 1.8);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.8);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 1.9);
    }
  } catch (err) {
    console.error('Failed to play synthesized sound:', err);
  }
};

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('traitors_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [gameState, setGameState] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, chat, voting
  const [toast, setToast] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState(false);
  const socketRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => {
    return localStorage.getItem('traitors_push_enabled') !== 'false';
  });
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    return localStorage.getItem('traitors_sounds_enabled') !== 'false';
  });

  // Setup PWA Service Worker & Auto Update detection on boot
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('PWA Service Worker registered successfully.');
        
        // Periodically poll for updates (every 60 seconds)
        const updateInterval = setInterval(() => {
          registration.update();
        }, 60000);

        return () => clearInterval(updateInterval);
      }).catch((err) => {
        console.error('PWA Service Worker registration failed:', err);
      });

      // Reload client window when new Service Worker takes over
      const handleControllerChange = () => {
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setGameState(null);
      return;
    }

    const socketUrl = window.location.origin;
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected to backend');
      socket.emit('authenticate', { 
        userId: user.id, 
        sessionToken: user.sessionToken 
      });
    });

    socket.on('authFailed', () => {
      console.error('Socket authentication failed. Logging out...');
      setUser(null);
      localStorage.removeItem('traitors_user');
    });

    socket.on('gameState', (newGameState) => {
      // Look for notifications / updates by comparing states
      setGameState((prev) => {
        if (prev) {
          // Play sounds for dramatic shifts
          if (!prev.votingActive && newGameState.votingActive) {
            playSound('alert');
            showToast('The Roundtable is active! Cast your vote.', null, 'voting');
          }
          if (prev.clientPlayer?.status === 'ALIVE' && newGameState.clientPlayer?.status === 'DEAD') {
            playSound('death');
            showToast('You have been assassinated.', null, 'dashboard');
          }
          if (newGameState.messages.length > prev.messages.length) {
            const newMsg = newGameState.messages[newGameState.messages.length - 1];
            if (newMsg.senderId !== user.id) {
              if (newMsg.channelId === 'gm-alerts') {
                playSound('alert');
                showToast(`GM Alert: ${newMsg.text}`, null, 'dashboard');
              } else {
                playSound('message');
                const channelName = newMsg.channelId === 'global' ? 'Lounge' : 
                                    newMsg.channelId === 'traitors' ? 'Den' : 
                                    newMsg.channelId === 'graveyard' ? 'Graveyard' :
                                    newMsg.channelId.startsWith('group_') ? 'Alliance' : 'Private';
                showToast(`New letter in ${channelName} from ${newMsg.senderName}`, newMsg.channelId, 'chat');
              }
            }
          }
        }
        return newGameState;
      });
    });

    socket.on('votingResults', (results) => {
      // Custom event for GM or players to display
      if (user.role === 'GM') {
        window.dispatchEvent(new CustomEvent('traitors_voting_results', { detail: results }));
      }
    });

    // Watch for navigation postMessage from service worker
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'navigate_chat') {
        setActiveTab('chat');
        window.dispatchEvent(new CustomEvent('traitors_select_chat', { detail: event.data.channelId }));
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Register PWA service worker and push notifications if enabled
    if (localStorage.getItem('traitors_push_enabled') !== 'false') {
      registerPush(user);
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [user]);

  // Track unread alerts targeting the player
  useEffect(() => {
    if (!gameState || !user || activeTab === 'dashboard') {
      if (activeTab === 'dashboard') {
        setUnreadAlerts(false);
      }
      return;
    }
    
    const currentAlerts = gameState.messages.filter(msg => msg.channelId === 'gm-alerts');
    const savedCount = parseInt(localStorage.getItem(`last_seen_alerts_${user.id}`) || '0', 10);
    if (currentAlerts.length > savedCount) {
      setUnreadAlerts(true);
    }
  }, [gameState?.messages, activeTab, user?.id]);

  useEffect(() => {
    if (activeTab === 'dashboard' && gameState && user) {
      const currentAlerts = gameState.messages.filter(msg => msg.channelId === 'gm-alerts');
      localStorage.setItem(`last_seen_alerts_${user.id}`, currentAlerts.length.toString());
      setUnreadAlerts(false);
    }
  }, [activeTab, gameState?.messages, user]);

  const showToast = (text, channelId = null, tab = null) => {
    setToast({ text, channelId, tab });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5500);
  };

  const handleToastClick = () => {
    if (!toast) return;
    if (toast.tab) {
      setActiveTab(toast.tab);
      if (toast.tab === 'chat' && toast.channelId) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('traitors_select_chat', { detail: toast.channelId }));
        }, 50);
      }
    }
    setToast(null);
  };

  const togglePush = async (enable) => {
    if (!enable) {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
            await fetch('/api/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playerId: user.id,
                endpoint: subscription.endpoint
              })
            });
          }
        } catch (err) {
          console.warn('Failed to unsubscribe:', err);
        }
      }
      localStorage.setItem('traitors_push_enabled', 'false');
      setPushEnabled(false);
      showToast('Push notifications silenced.');
    } else {
      localStorage.setItem('traitors_push_enabled', 'true');
      setPushEnabled(true);
      if (user) {
        await registerPush(user);
        showToast('Push notifications enabled.');
      }
    }
  };

  const toggleSounds = (enable) => {
    localStorage.setItem('traitors_sounds_enabled', enable ? 'true' : 'false');
    setSoundsEnabled(enable);
    if (enable) {
      playSound('message');
    }
  };

  const registerPush = async (userObj) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Web Push is not supported in this browser.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key
      const keyRes = await fetch('/api/vapid-public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: userObj.id,
          subscription
        })
      });
      console.log('Registered for push notifications successfully.');
    } catch (err) {
      console.warn('Push registration failed or denied:', err);
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = reader.result;
        const res = await fetch('/api/upload-avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            playerId: user.id,
            image: base64Data
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const updatedUser = { ...user, avatarUrl: data.avatarUrl };
          setUser(updatedUser);
          localStorage.setItem('traitors_user', JSON.stringify(updatedUser));
          showToast('Profile portrait updated.', null, 'dashboard');
        } else {
          alert(data.error || 'Failed to upload image.');
        }
      } catch (err) {
        console.error('Avatar upload error:', err);
        alert('Network error. Failed to upload avatar.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    localStorage.setItem('traitors_user', JSON.stringify(loggedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('traitors_user');
  };

  // Helper trigger socket events
  const emitSocket = (event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Banner */}
      {toast && (
        <div 
          className="toast-banner" 
          onClick={handleToastClick}
          style={{ cursor: 'pointer', transition: 'var(--transition-fast)' }}
        >
          <BellRing className="text-gold" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-serif)', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '2px' }}>Castle Courier</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{toast.text}</p>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield className="text-gold" size={22} style={{ animation: 'flicker 4s infinite alternate' }} />
          <h2 style={{ fontSize: '1rem', margin: 0, letterSpacing: '0.1em' }} className="title-gothic">The Traitors</h2>
        </div>
        
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                <User size={12} className="text-gold" /> {user.name}
              </span>
              {gameState?.clientPlayer && (
                <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }} className={gameState.clientPlayer.status === 'DEAD' ? 'text-crimson' : 'text-gold'}>
                  {gameState.clientPlayer.status === 'DEAD' ? 'DEAD' : (gameState.clientPlayer.role !== 'UNKNOWN' ? gameState.clientPlayer.role : 'ALIVE')}
                </span>
              )}
            </div>
            <button 
              onClick={() => setShowSettingsModal(true)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', marginRight: '4px' }}
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button 
              onClick={handleLogout} 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </header>

      {/* Main App Page Routing */}
      <main className="app-content">
        {!user ? (
          <>
            <LoginScreen onLogin={handleLogin} />
            <InstallPrompt />
          </>
        ) : user.role === 'GM' ? (
          <GMDashboard gameState={gameState} emitSocket={emitSocket} />
        ) : (
          <>
            {gameState ? (
              <>
                {activeTab === 'dashboard' && (
                  <PlayerDashboard 
                    gameState={gameState} 
                    emitSocket={emitSocket}
                    onNavigateChat={(chanId) => {
                      setActiveTab('chat');
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('traitors_select_chat', { detail: chanId }));
                      }, 50);
                    }}
                  />
                )}
                {activeTab === 'chat' && (
                  <PlayerDashboard 
                    gameState={gameState} 
                    emitSocket={emitSocket}
                    initialTab="chat"
                  />
                )}
                {activeTab === 'voting' && (
                  <PlayerDashboard 
                    gameState={gameState} 
                    emitSocket={emitSocket}
                    initialTab="voting"
                  />
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flex1: 1, alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '15px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--gold-dark)', borderTopColor: 'var(--gold)', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)' }}>Connecting to the Castle...</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Navigation Footer for mobile players */}
      {user && user.role !== 'GM' && (
        <footer className="footer-nav">
          <button 
            className={`footer-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ position: 'relative' }}
          >
            <Shield size={18} style={{ marginBottom: '4px' }} />
            Dashboard
            {unreadAlerts && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '25%',
                width: '8px',
                height: '8px',
                backgroundColor: 'var(--crimson-glow)',
                borderRadius: '50%',
                boxShadow: '0 0 8px var(--crimson-glow)',
                animation: 'flicker 2s infinite alternate ease-in-out'
              }} />
            )}
          </button>
          <button 
            className={`footer-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} style={{ marginBottom: '4px' }} />
            Chamber Chat
          </button>
          <button 
            className={`footer-tab ${activeTab === 'voting' ? 'active' : ''}`}
            onClick={() => setActiveTab('voting')}
          >
            <Award size={18} style={{ marginBottom: '4px' }} />
            Roundtable
          </button>
        </footer>
      )}

      {/* User Settings Modal Overlay */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div 
            className="gothic-panel candle-glow" 
            style={{
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              margin: 0
            }}
          >
            <h3 style={{ fontSize: '1rem', color: 'var(--gold)', textAlign: 'center', borderBottom: '1px solid rgba(197, 160, 40, 0.3)', paddingBottom: '8px' }}>
              User Settings
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Profile Image Upload */}
              {user && user.id !== 'gm' && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '10px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  marginBottom: '6px'
                }}>
                  <PlayerAvatar 
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    fallbackType="initials"
                    initialsSize="1.8rem"
                    containerStyle={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '50%',
                      border: '2px solid var(--gold)',
                      background: 'var(--bg-primary)',
                      boxShadow: '0 0 10px rgba(197, 160, 40, 0.2)'
                    }}
                  />
                  <label 
                    className="gothic-btn" 
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.7rem', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Change Portrait</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              )}
              {/* Sound toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', fontWeight: '500' }}>Gothic Sound Chimes</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Play low atmospheric sounds on alerts</span>
                </div>
                <div 
                  onClick={() => toggleSounds(!soundsEnabled)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    background: soundsEnabled ? 'var(--gold-dark)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid var(--gold)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--text-primary)',
                    position: 'absolute',
                    top: '2px',
                    left: soundsEnabled ? '22px' : '2px',
                    transition: 'var(--transition-smooth)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                  }} />
                </div>
              </div>

              {/* Web Push toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', fontWeight: '500' }}>Web Push Alerts</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Silence alerts in the background</span>
                </div>
                <div 
                  onClick={() => togglePush(!pushEnabled)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    background: pushEnabled ? 'var(--gold-dark)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid var(--gold)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--text-primary)',
                    position: 'absolute',
                    top: '2px',
                    left: pushEnabled ? '22px' : '2px',
                    transition: 'var(--transition-smooth)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                  }} />
                </div>
              </div>

              {/* PWA manual details */}
              <div style={{ 
                marginTop: '6px', 
                padding: '10px', 
                background: 'rgba(255,255,255,0.02)', 
                border: 'var(--border-dark)', 
                borderRadius: '4px',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4'
              }}>
                <strong style={{ color: 'var(--gold)', display: 'block', marginBottom: '2px' }}>PWA Home Screen Installation</strong>
                iOS Safari users must click Share 📤 then "Add to Home Screen" to receive background push notifications.
              </div>
            </div>
            
            <button 
              className="gothic-btn" 
              style={{ width: '100%', padding: '10px', fontSize: '0.8rem', marginTop: '4px' }}
              onClick={() => setShowSettingsModal(false)}
            >
              Close Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
