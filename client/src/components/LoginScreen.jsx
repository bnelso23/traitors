import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, KeyRound } from 'lucide-react';

const STATIC_PLAYER_SLOTS = [
  'Hayli', 'Jen', 'Alix', 'Tanner',
  'Bryce', 'Kelsie', 'Alyssa', 'Naeim',
  'Matt', 'Allyson', 'Sarah', 'Derek'
];

function LoginScreen({ onLogin }) {
  const [isGm, setIsGm] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeyClick = (num) => {
    setError('');
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setError('PIN must be 4 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isGm ? 'Game Master' : selectedName,
          pin,
          isGm
        })
      });

      const data = await response.json();
      if (response.ok) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Authentication failed.');
        setPin('');
      }
    } catch (err) {
      setError('Server unreachable. Try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Automatically submit when 4 digits are typed
  React.useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  const selectPlayer = (name) => {
    setSelectedName(name);
    setPin('');
    setError('');
  };

  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center' }}>
      
      {/* Visual Seal Logo */}
      <div style={{ textAlign: 'center', margin: '10px 0 0' }}>
        <img 
          src="/icon-512.png" 
          alt="Traitors Seal" 
          style={{ width: '90px', height: '90px', borderRadius: '50%', border: '2px solid var(--gold)', boxShadow: 'var(--shadow-candle)', animation: 'flicker 6s infinite alternate' }} 
        />
        <h1 style={{ fontSize: '1.6rem', marginTop: '12px', letterSpacing: '0.15em' }} className="title-gothic">The Roundtable</h1>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Enter the Castle. State your name.
        </p>
      </div>

      {/* Role Selector Tabs */}
      <div style={{ display: 'flex', background: 'rgba(25, 24, 29, 0.6)', border: 'var(--border-dark)', borderRadius: '4px', padding: '3px' }}>
        <button
          onClick={() => { setIsGm(false); setSelectedName(''); setPin(''); setError(''); }}
          className="gothic-btn"
          style={{ 
            flex: 1, 
            padding: '8px', 
            fontSize: '0.75rem', 
            background: !isGm ? 'linear-gradient(185deg, var(--gold-dark) 0%, #443407 100%)' : 'none',
            border: !isGm ? '1px solid var(--gold)' : 'none',
            boxShadow: !isGm ? 'none' : 'none'
          }}
        >
          Player
        </button>
        <button
          onClick={() => { setIsGm(true); setSelectedName(''); setPin(''); setError(''); }}
          className="gothic-btn"
          style={{ 
            flex: 1, 
            padding: '8px', 
            fontSize: '0.75rem', 
            background: isGm ? 'linear-gradient(185deg, var(--crimson) 0%, var(--crimson-dark) 100%)' : 'none',
            border: isGm ? '1px solid var(--crimson-glow)' : 'none',
            boxShadow: isGm ? 'none' : 'none'
          }}
        >
          Game Master
        </button>
      </div>

      {/* Login Panels */}
      {!isGm ? (
        // PLAYER SELECTION SLOTS
        <div>
          {!selectedName ? (
            <div className="gothic-panel">
              <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={14} /> Select Your Identity
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {STATIC_PLAYER_SLOTS.map((name) => (
                  <button
                    key={name}
                    onClick={() => selectPlayer(name)}
                    className="gothic-btn-muted"
                    style={{ 
                      padding: '12px 6px', 
                      fontSize: '0.75rem', 
                      borderRadius: '4px', 
                      border: 'var(--border-dark)', 
                      cursor: 'pointer',
                      fontFamily: 'var(--font-serif)',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // CUSTOM PIN KEYPAD FOR SELECTED PLAYER
            <div className="gothic-panel candle-glow" style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '4px' }}>Welcome, {selectedName}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>Enter your secret 4-digit PIN</p>
              
              {/* Star-dots for entered PIN characters */}
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', margin: '15px 0' }}>
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    style={{ 
                      width: '16px', 
                      height: '16px', 
                      borderRadius: '50%', 
                      border: '1px solid var(--gold)',
                      backgroundColor: pin.length > idx ? 'var(--gold)' : 'transparent',
                      boxShadow: pin.length > idx ? '0 0 8px var(--gold-glow)' : 'none',
                      transition: 'all 0.15s ease-out'
                    }}
                  />
                ))}
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', justify: 'center', gap: '6px', color: 'var(--crimson-glow)', fontSize: '0.75rem', margin: '10px 0' }}>
                  <ShieldAlert size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* Pad grid */}
              <div className="pin-grid">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button key={num} onClick={() => handleKeyClick(num)} className="pin-key" disabled={loading}>
                    {num}
                  </button>
                ))}
                <button onClick={handleClear} className="pin-key" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }} disabled={loading}>
                  Clear
                </button>
                <button onClick={() => handleKeyClick('0')} className="pin-key" disabled={loading}>
                  0
                </button>
                <button onClick={handleBackspace} className="pin-key" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }} disabled={loading}>
                  Del
                </button>
              </div>

              <button
                onClick={() => setSelectedName('')}
                className="gothic-btn-muted"
                style={{ marginTop: '20px', width: '100%', fontSize: '0.75rem', padding: '10px' }}
                disabled={loading}
              >
                Change Player
              </button>
            </div>
          )}
        </div>
      ) : (
        // GAME MASTER LOGIN
        <div className="gothic-panel-crimson crimson-glow" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--crimson-glow)', marginBottom: '4px' }}>Chamber of the Master</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>Provide the Key to rule the Roundtable</p>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', margin: '15px 0' }}>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '50%', 
                  border: '1px solid var(--crimson-glow)',
                  backgroundColor: pin.length > idx ? 'var(--crimson-glow)' : 'transparent',
                  boxShadow: pin.length > idx ? '0 0 8px var(--crimson-glow)' : 'none',
                  transition: 'all 0.15s ease-out'
                }}
              />
            ))}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', justify: 'center', gap: '6px', color: 'var(--crimson-glow)', fontSize: '0.75rem', margin: '10px 0' }}>
              <ShieldAlert size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="pin-grid">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button key={num} onClick={() => handleKeyClick(num)} className="pin-key" style={{ borderColor: 'rgba(138, 19, 19, 0.3)' }} disabled={loading}>
                {num}
              </button>
            ))}
            <button onClick={handleClear} className="pin-key" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }} disabled={loading}>
              Clear
            </button>
            <button key="0" onClick={() => handleKeyClick('0')} className="pin-key" style={{ borderColor: 'rgba(138, 19, 19, 0.3)' }} disabled={loading}>
              0
            </button>
            <button onClick={handleBackspace} className="pin-key" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }} disabled={loading}>
              Del
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginScreen;
