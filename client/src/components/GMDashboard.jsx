import React, { useState, useEffect, useRef } from 'react';
import { Play, Users, Skull, MessageSquare, Volume2, KeyRound, Award, RefreshCw, ChevronDown, ChevronUp, Bell, Check, Send, Lock, Eye } from 'lucide-react';

function GMDashboard({ gameState, emitSocket }) {
  const [activeSection, setActiveSection] = useState('players'); // players, chats, voting, broadcast, setup
  const [selectedTraitors, setSelectedTraitors] = useState([]);
  const [editPlayers, setEditPlayers] = useState([]);
  const [alertText, setAlertText] = useState('');
  const [alertTarget, setAlertTarget] = useState('all');
  const [votingResults, setVotingResults] = useState(null);
  
  // Chat Monitor state
  const [monitorChannel, setMonitorChannel] = useState('global'); // global, traitors, graveyard, private-pX-pY
  const [gmChatText, setGmChatText] = useState('');
  const monitorMessagesEndRef = useRef(null);

  // Sync edit state when players list loads
  useEffect(() => {
    if (gameState?.players) {
      setEditPlayers(gameState.players.map(p => ({ id: p.id, name: p.name, pin: p.pin })));
      // Default selected traitors from current state if they exist
      const traitors = gameState.players.filter(p => p.role === 'TRAITOR').map(p => p.id);
      setSelectedTraitors(traitors);
    }
  }, [gameState?.players]);

  // Listen to voting results event
  useEffect(() => {
    const handleResults = (e) => {
      setVotingResults(e.detail);
    };
    window.addEventListener('traitors_voting_results', handleResults);
    return () => window.removeEventListener('traitors_voting_results', handleResults);
  }, []);

  // Scroll monitor chat to bottom
  useEffect(() => {
    monitorMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [monitorChannel, gameState?.messages, activeSection]);

  if (!gameState) return null;

  const handleSaveSetup = () => {
    emitSocket('gmUpdatePlayers', { players: editPlayers });
    alert('Player roster updated.');
  };

  const handleEditPlayerChange = (id, field, value) => {
    setEditPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleTraitorSelection = (id) => {
    setSelectedTraitors(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const handleAssignRoles = () => {
    if (selectedTraitors.length === 0) {
      alert('Please select at least one Traitor.');
      return;
    }
    if (window.confirm(`Assign selected players as Traitors? Everyone else will be Faithful.`)) {
      emitSocket('gmAssignRoles', { traitorIds: selectedTraitors });
    }
  };

  const handleStartGame = () => {
    if (window.confirm('Start the game? Player rosters and pins will be locked.')) {
      emitSocket('gmStartGame');
    }
  };

  const handleToggleChat = (type, currentVal) => {
    const chats = {
      chatsEnabled: gameState.chatsEnabled,
      privateChatsEnabled: gameState.privateChatsEnabled,
      traitorsChatEnabled: gameState.traitorsChatEnabled
    };
    chats[type] = !currentVal;
    emitSocket('gmToggleChats', chats);
  };

  const handleStartVoting = (type) => {
    emitSocket('gmToggleVoting', { active: true, votingType: type });
    setVotingResults(null);
  };

  const handleCloseVoting = () => {
    emitSocket('gmToggleVoting', { active: false });
  };

  const handleFinalizeVoting = () => {
    emitSocket('gmFinalizeVoting');
  };

  const handleSendAlert = (e) => {
    e.preventDefault();
    if (!alertText.trim()) return;
    emitSocket('gmAlert', { target: alertTarget, text: alertText });
    setAlertText('');
    alert('Broadcast sent.');
  };

  const handleToggleStatus = (playerId, currentStatus) => {
    const nextStatus = currentStatus === 'ALIVE' ? 'DEAD' : 'ALIVE';
    const action = nextStatus === 'DEAD' ? 'Eliminate' : 'Revive';
    if (window.confirm(`Are you sure you want to ${action} this player?`)) {
      emitSocket('gmUpdatePlayerStatus', { playerId, status: nextStatus });
    }
  };

  const handleResetGame = () => {
    if (window.confirm('WARNING: This resets the entire room state, message history, roles, and restores default players. Continue?')) {
      emitSocket('gmResetGame');
      setVotingResults(null);
    }
  };

  const handleSendGmChat = (e) => {
    e.preventDefault();
    if (!gmChatText.trim()) return;
    emitSocket('sendMessage', {
      channelId: monitorChannel,
      text: gmChatText
    });
    setGmChatText('');
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Lobby Banner */}
      <div className="gothic-panel" style={{ borderTopColor: 'var(--crimson-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Master Controls</h3>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--crimson-glow)' }}>GM PANEL</h2>
        </div>
        <span style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', border: 'var(--border-dark)', color: 'var(--text-secondary)' }}>
          State: <strong style={{ color: 'var(--gold)' }}>{gameState.gameStatus}</strong>
        </span>
      </div>

      {/* Tab Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', background: 'rgba(25, 24, 29, 0.6)', border: 'var(--border-dark)', borderRadius: '4px', padding: '2px' }}>
        <button 
          onClick={() => setActiveSection('players')} 
          className={`gothic-btn-muted ${activeSection === 'players' ? 'text-gold' : ''}`}
          style={{ padding: '8px 4px', fontSize: '0.65rem', border: activeSection === 'players' ? '1px solid var(--gold-dark)' : 'none' }}
        >
          Players
        </button>
        <button 
          onClick={() => setActiveSection('chats')} 
          className={`gothic-btn-muted ${activeSection === 'chats' ? 'text-gold' : ''}`}
          style={{ padding: '8px 4px', fontSize: '0.65rem', border: activeSection === 'chats' ? '1px solid var(--gold-dark)' : 'none' }}
        >
          Chats
        </button>
        <button 
          onClick={() => setActiveSection('voting')} 
          className={`gothic-btn-muted ${activeSection === 'voting' ? 'text-gold' : ''}`}
          style={{ padding: '8px 4px', fontSize: '0.65rem', border: activeSection === 'voting' ? '1px solid var(--gold-dark)' : 'none' }}
        >
          Voting
        </button>
        <button 
          onClick={() => setActiveSection('broadcast')} 
          className={`gothic-btn-muted ${activeSection === 'broadcast' ? 'text-gold' : ''}`}
          style={{ padding: '8px 4px', fontSize: '0.65rem', border: activeSection === 'broadcast' ? '1px solid var(--gold-dark)' : 'none' }}
        >
          Alert
        </button>
      </div>

      {/* SECTION: PLAYER SETUP / ROSTER (LOBBY & ACTIVE) */}
      {activeSection === 'players' && (
        <div>
          {gameState.gameStatus === 'LOBBY' ? (
            <div className="gothic-panel">
              <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={14} /> Player Lobby & PINs
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '15px' }}>
                {editPlayers.map((p, idx) => (
                  <div key={p.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', width: '20px', color: 'var(--text-muted)' }}>{idx + 1}.</span>
                    <input 
                      type="text" 
                      value={p.name} 
                      onChange={(e) => handleEditPlayerChange(p.id, 'name', e.target.value)}
                      className="gothic-input"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      placeholder="Name"
                    />
                    <input 
                      type="text" 
                      maxLength={4}
                      value={p.pin} 
                      onChange={(e) => handleEditPlayerChange(p.id, 'pin', e.target.value)}
                      className="gothic-input"
                      style={{ padding: '6px 8px', fontSize: '0.8rem', width: '60px', textAlign: 'center' }}
                      placeholder="PIN"
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSaveSetup} className="gothic-btn" style={{ flex: 1, padding: '10px', fontSize: '0.75rem' }}>
                  Save Roster
                </button>
              </div>

              {/* Roles assign panel */}
              <div style={{ borderTop: 'var(--border-dark)', marginTop: '15px', paddingTop: '15px' }}>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--crimson-glow)', marginBottom: '8px' }}>Select & Assign Traitors</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
                  {gameState.players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => toggleTraitorSelection(p.id)}
                      className="gothic-btn-muted"
                      style={{ 
                        padding: '8px 4px', 
                        fontSize: '0.7rem', 
                        border: selectedTraitors.includes(p.id) ? '1px solid var(--crimson-glow)' : 'var(--border-dark)',
                        background: selectedTraitors.includes(p.id) ? 'rgba(138, 19, 19, 0.2)' : ''
                      }}
                    >
                      {selectedTraitors.includes(p.id) && <Check size={10} style={{ display: 'inline', marginRight: '4px' }} />}
                      {p.name}
                    </button>
                  ))}
                </div>
                <button onClick={handleAssignRoles} className="gothic-btn gothic-btn-crimson" style={{ width: '100%', padding: '10px', fontSize: '0.75rem' }}>
                  Assign Roles
                </button>
              </div>

              {/* Start game trigger */}
              <button 
                onClick={handleStartGame} 
                className="gothic-btn" 
                style={{ width: '100%', marginTop: '15px', padding: '12px', fontSize: '0.85rem', background: 'linear-gradient(185deg, #16a34a 0%, #15803d 100%)', border: '1px solid #22c55e' }}
              >
                <Play size={14} style={{ marginRight: '6px' }} /> Start Game Session
              </button>

            </div>
          ) : (
            // ACTIVE PLAYERS DIRECTORY
            <div className="gothic-panel">
              <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={14} /> Active Characters
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {gameState.players.map((p) => {
                  const isAlive = p.status === 'ALIVE';
                  const isTraitor = p.role === 'TRAITOR';
                  return (
                    <div 
                      key={p.id} 
                      className={`player-card ${!isAlive ? 'dead' : ''}`}
                      style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 14px',
                        borderLeft: isAlive ? (isTraitor ? '4px solid var(--crimson)' : '4px solid #1e293b') : '4px solid var(--text-muted)'
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{p.name}</span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                          <span className={`player-badge ${isTraitor ? 'badge-traitor' : 'badge-faithful'}`} style={{ fontSize: '0.55rem', padding: '1px 4px' }}>
                            {p.role}
                          </span>
                          <span className="player-badge badge-dead" style={{ fontSize: '0.55rem', padding: '1px 4px', display: isAlive ? 'none' : 'inline' }}>
                            DEAD
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleStatus(p.id, p.status)}
                        className={`gothic-btn ${isAlive ? 'gothic-btn-crimson' : ''}`}
                        style={{ padding: '6px 10px', fontSize: '0.65rem', height: 'fit-content', borderRadius: '4px' }}
                      >
                        {isAlive ? <Skull size={10} /> : <RefreshCw size={10} />}
                        <span style={{ marginLeft: '4px' }}>{isAlive ? 'Kill' : 'Revive'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* SECTION: CHAT LOCKS & SETTINGS */}
      {activeSection === 'chats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Locks Control */}
          <div className="gothic-panel" style={{ padding: '15px', marginBottom: 0 }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={14} /> Castle Communication Locks
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Global Lounge Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '4px', border: 'var(--border-dark)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Castle Lounge (Global)</span>
                <button 
                  onClick={() => handleToggleChat('chatsEnabled', gameState.chatsEnabled)}
                  className={`gothic-btn ${gameState.chatsEnabled ? '' : 'gothic-btn-crimson'}`}
                  style={{ padding: '4px 10px', fontSize: '0.65rem', borderRadius: '3px' }}
                >
                  {gameState.chatsEnabled ? 'SUNRISE (Open)' : 'NIGHT (Locked)'}
                </button>
              </div>

              {/* Traitors Den Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '4px', border: 'var(--border-dark)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Traitors' Den Chat</span>
                <button 
                  onClick={() => handleToggleChat('traitorsChatEnabled', gameState.traitorsChatEnabled)}
                  className={`gothic-btn ${gameState.traitorsChatEnabled ? 'gothic-btn-crimson' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.65rem', borderRadius: '3px' }}
                >
                  {gameState.traitorsChatEnabled ? 'OPEN' : 'CLOSED'}
                </button>
              </div>

              {/* Private Letters Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '4px', border: 'var(--border-dark)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Secret Letters (1-on-1)</span>
                <button 
                  onClick={() => handleToggleChat('privateChatsEnabled', gameState.privateChatsEnabled)}
                  className={`gothic-btn ${gameState.privateChatsEnabled ? '' : 'gothic-btn-crimson'}`}
                  style={{ padding: '4px 10px', fontSize: '0.65rem', borderRadius: '3px' }}
                >
                  {gameState.privateChatsEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </div>

          {/* SPYGLASS CHAT MONITOR */}
          <div className="gothic-panel" style={{ padding: '15px' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={14} /> Spyglass Chat Monitor
            </h3>

            {/* Monitor Channel Selector Slider */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px', scrollbarWidth: 'none' }}>
              <button 
                onClick={() => setMonitorChannel('global')}
                className={`gothic-btn-muted ${monitorChannel === 'global' ? 'text-gold' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.65rem', borderRadius: '4px', border: monitorChannel === 'global' ? '1px solid var(--gold)' : 'var(--border-dark)', flexShrink: 0 }}
              >
                Castle Lounge
              </button>
              <button 
                onClick={() => setMonitorChannel('traitors')}
                className={`gothic-btn-muted ${monitorChannel === 'traitors' ? 'text-crimson' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.65rem', borderRadius: '4px', border: monitorChannel === 'traitors' ? '1px solid var(--crimson-glow)' : 'var(--border-dark)', flexShrink: 0 }}
              >
                Traitors' Den
              </button>
              <button 
                onClick={() => setMonitorChannel('graveyard')}
                className={`gothic-btn-muted ${monitorChannel === 'graveyard' ? 'text-crimson' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.65rem', borderRadius: '4px', border: monitorChannel === 'graveyard' ? '1px solid var(--border-crimson)' : 'var(--border-dark)', flexShrink: 0 }}
              >
                Graveyard
              </button>

              {/* Private message dropdown */}
              <select
                value={monitorChannel.startsWith('private-') ? monitorChannel : ''}
                onChange={(e) => setMonitorChannel(e.target.value)}
                className="gothic-input"
                style={{ padding: '4px 8px', fontSize: '0.65rem', width: '130px', height: '28px', borderBottom: 'none', background: 'var(--bg-tertiary)', border: 'var(--border-dark)', flexShrink: 0 }}
              >
                <option value="">— Whispers ({
                  Array.from(new Set(gameState.messages.filter(m => m.channelId.startsWith('private-')).map(m => m.channelId))).length
                }) —</option>
                {Array.from(new Set(gameState.messages.filter(m => m.channelId.startsWith('private-')).map(m => m.channelId))).map(chanId => {
                  const parts = chanId.split('-');
                  const p1 = gameState.players.find(p => p.id === parts[1]);
                  const p2 = gameState.players.find(p => p.id === parts[2]);
                  return (
                    <option key={chanId} value={chanId}>
                      {p1 ? p1.name : 'Unknown'} & {p2 ? p2.name : 'Unknown'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Chat Stream Window */}
            <div className="chat-window" style={{ height: '250px', display: 'flex', flexDirection: 'column' }}>
              <div className="chat-messages" style={{ flex: 1 }}>
                {gameState.messages.filter(msg => msg.channelId === monitorChannel).length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, flexDirection: 'column', height: '100%' }}>
                    <MessageSquare size={20} style={{ marginBottom: '6px' }} />
                    <span style={{ fontSize: '0.7rem' }}>No whispers recorded.</span>
                  </div>
                ) : (
                  gameState.messages
                    .filter(msg => msg.channelId === monitorChannel)
                    .map((msg) => {
                      const isOwn = msg.senderId === 'gm';
                      return (
                        <div 
                          key={msg.id}
                          className={`message-bubble ${isOwn ? 'outgoing' : 'incoming'}`}
                          style={{ maxWidth: '85%' }}
                        >
                          {!isOwn && (
                            <div className="message-sender" style={{ color: 'var(--gold)' }}>{msg.senderName}</div>
                          )}
                          <div>{msg.text}</div>
                          <div className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })
                )}
                <div ref={monitorMessagesEndRef} />
              </div>

              {/* Chat Input enabling GM to participate */}
              <form onSubmit={handleSendGmChat} className="chat-input-bar">
                <input 
                  type="text" 
                  value={gmChatText} 
                  onChange={(e) => setGmChatText(e.target.value)}
                  placeholder={`Speak in ${
                    monitorChannel === 'global' ? 'Lounge' :
                    monitorChannel === 'traitors' ? 'Den' :
                    monitorChannel === 'graveyard' ? 'Graveyard' : 'Whisper'
                  }...`}
                  className="gothic-input"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1, borderBottom: 'none' }}
                />
                <button 
                  type="submit" 
                  className="gothic-btn" 
                  style={{ padding: '6px 12px', fontSize: '0.7rem' }}
                  disabled={!gmChatText.trim()}
                >
                  Post
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* SECTION: VOTING CONTROLS */}
      {activeSection === 'voting' && (
        <div className="gothic-panel">
          <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={14} /> Voting Roundtable Orchestration
          </h3>

          {!gameState.votingActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Start a digital voting portal for players. Tallies are calculated instantly.</p>
              <button 
                onClick={() => handleStartVoting('EXILE')} 
                className="gothic-btn" 
                style={{ width: '100%', padding: '12px', fontSize: '0.75rem' }}
              >
                Start Roundtable Vote (Exile)
              </button>
              <button 
                onClick={() => handleStartVoting('MURDER')} 
                className="gothic-btn gothic-btn-crimson" 
                style={{ width: '100%', padding: '12px', fontSize: '0.75rem' }}
              >
                Start Traitor Vote (Murder)
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Active Voting Status Card */}
              <div className="gothic-panel-crimson" style={{ margin: 0, padding: '12px' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--crimson-glow)' }}>
                  Active Portal: {gameState.votingType === 'EXILE' ? 'ROUNDTABLE EXILE' : 'TRAITOR ASSASSINATION'}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                  Votes Cast: <strong>{gameState.votesCount}</strong> / {
                    gameState.votingType === 'EXILE' 
                      ? gameState.players.filter(p => p.status === 'ALIVE').length 
                      : gameState.players.filter(p => p.status === 'ALIVE' && p.role === 'TRAITOR').length
                  }
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleFinalizeVoting} className="gothic-btn" style={{ flex: 1, padding: '10px', fontSize: '0.7rem' }}>
                  Tally & Close Voting
                </button>
                <button onClick={handleCloseVoting} className="gothic-btn gothic-btn-crimson" style={{ flex: 1, padding: '10px', fontSize: '0.7rem' }}>
                  Cancel Session
                </button>
              </div>

            </div>
          )}

          {/* Results Reveal Overlay Box */}
          {votingResults && (
            <div className="gothic-panel" style={{ marginTop: '16px', borderTopColor: 'var(--gold)', background: 'rgba(0,0,0,0.4)' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--gold)', marginBottom: '8px', borderBottom: 'var(--border-dark)', paddingBottom: '4px' }}>
                Tabulated Results
              </h4>
              <p style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-primary)', fontStyle: 'italic', marginBottom: '10px' }}>
                {votingResults.summary}
              </p>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <strong>Voter Logs:</strong>
                {votingResults.details.map((log, idx) => (
                  <div key={idx} style={{ padding: '2px 4px', borderLeft: '2px solid var(--gold-dark)', marginLeft: '4px' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION: GM ALERTS / BROADCASTS */}
      {activeSection === 'broadcast' && (
        <div className="gothic-panel">
          <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={14} /> Send Master Scroll Broadcast
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
            Sends a high-priority banner toast, plays a deep gothic chime, and triggers web push notifications to the selected group's devices.
          </p>

          <form onSubmit={handleSendAlert} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>Target Group</label>
              <select 
                value={alertTarget} 
                onChange={(e) => setAlertTarget(e.target.value)}
                className="gothic-input"
                style={{ appearance: 'none', backgroundImage: 'radial-gradient(var(--bg-primary), var(--bg-secondary))' }}
              >
                <option value="all">All Players</option>
                <option value="traitors">Traitors Only</option>
                <option value="faithfuls">Faithfuls Only</option>
                <option disabled>— Specific Player —</option>
                {gameState.players.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>Alert Message</label>
              <textarea 
                value={alertText} 
                onChange={(e) => setAlertText(e.target.value)}
                className="gothic-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="e.g. Gather at the Roundtable. Exile will begin shortly."
              />
            </div>

            <button type="submit" className="gothic-btn" style={{ width: '100%', padding: '10px', fontSize: '0.75rem' }}>
              <Send size={12} style={{ marginRight: '6px' }} /> Broadcast Alert
            </button>
          </form>
        </div>
      )}

      {/* DANGER ZONE RESET BUTTON */}
      <div className="gothic-panel" style={{ borderTopColor: 'var(--crimson-glow)', borderStyle: 'dashed' }}>
        <h4 style={{ fontSize: '0.75rem', color: 'var(--crimson-glow)', marginBottom: '8px' }}>Danger Zone</h4>
        <button 
          onClick={handleResetGame}
          className="gothic-btn gothic-btn-crimson" 
          style={{ width: '100%', padding: '10px', fontSize: '0.7rem' }}
        >
          <RefreshCw size={12} style={{ marginRight: '6px' }} /> Reset Game Lobby
        </button>
      </div>

    </div>
  );
}

export default GMDashboard;
