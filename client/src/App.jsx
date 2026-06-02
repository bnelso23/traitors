import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import LoginScreen from './components/LoginScreen';
import PlayerDashboard from './components/PlayerDashboard';
import GMDashboard from './components/GMDashboard';
import InstallPrompt from './components/InstallPrompt';
import { Shield, MessageSquare, Award, LogOut, BellRing, User } from 'lucide-react';

// Synthesize gothic sounds using browser Web Audio API
export const playSound = (type) => {
  try {
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
  const socketRef = useRef(null);

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
      socket.emit('authenticate', { userId: user.id });
    });

    socket.on('gameState', (newGameState) => {
      console.log('Received Game State update:', newGameState);
      
      // Look for notifications / updates by comparing states
      setGameState((prev) => {
        if (prev) {
          // Play sounds for dramatic shifts
          if (!prev.votingActive && newGameState.votingActive) {
            playSound('alert');
            showToast('The Roundtable is active! Cast your vote.');
          }
          if (prev.clientPlayer?.status === 'ALIVE' && newGameState.clientPlayer?.status === 'DEAD') {
            playSound('death');
            showToast('You have been assassinated.');
          }
          if (newGameState.messages.length > prev.messages.length) {
            const newMsg = newGameState.messages[newGameState.messages.length - 1];
            if (newMsg.senderId !== user.id) {
              if (newMsg.channelId === 'gm-alerts') {
                playSound('alert');
                showToast(`GM Alert: ${newMsg.text}`);
              } else {
                playSound('message');
                showToast(`New letter in ${newMsg.channelId === 'global' ? 'Lounge' : newMsg.channelId === 'traitors' ? 'Den' : 'Private'}`);
              }
            }
          }
        }
        return newGameState;
      });
    });

    socket.on('votingResults', (results) => {
      console.log('Received voting results:', results);
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

    // Register PWA service worker and push notifications
    registerPush(user);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [user]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  };

  const registerPush = async (userObj) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Web Push is not supported in this browser.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
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
        <div className="toast-banner">
          <BellRing className="text-gold" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-serif)', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '2px' }}>Castle Courier</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{toast}</p>
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
          >
            <Shield size={18} style={{ marginBottom: '4px' }} />
            Dashboard
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
    </div>
  );
}

export default App;
