import React, { useState, useEffect, useRef } from 'react';
import { Shield, MessageSquare, Award, Volume2, Key, HelpCircle, User, Users, Lock, ChevronRight, Check, Bell } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';

function PlayerDashboard({ gameState, emitSocket, initialTab = 'dashboard', onNavigateChat }) {
  const [tab, setTab] = useState(initialTab);
  const [activeChannel, setActiveChannel] = useState('global'); // global, traitors, graveyard, private-pX
  const [selectedPmPlayer, setSelectedPmPlayer] = useState(null); // player object for DM
  const [chatText, setChatText] = useState('');
  const [votedPlayerId, setVotedPlayerId] = useState(null);
  
  // Group creation state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  
  const messagesEndRef = useRef(null);

  // Sync tab when prop changes
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Handle custom SW notification navigation event
  useEffect(() => {
    const handleSelectChat = (e) => {
      const channelId = e.detail;
      if (channelId.startsWith('private-')) {
        const parts = channelId.split('-');
        const otherId = parts.find(id => id !== 'private' && id !== gameState.clientPlayer.id);
        const otherPlayer = gameState.players.find(p => p.id === otherId);
        if (otherPlayer) {
          setSelectedPmPlayer(otherPlayer);
          setActiveChannel(channelId);
        }
      } else {
        setSelectedPmPlayer(null);
        setActiveChannel(channelId);
      }
      setTab('chat');
    };
    window.addEventListener('traitors_select_chat', handleSelectChat);
    return () => window.removeEventListener('traitors_select_chat', handleSelectChat);
  }, [gameState?.players, gameState?.clientPlayer]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.messages, activeChannel, tab]);

  if (!gameState) return null;

  const { clientPlayer } = gameState;
  const isAlive = clientPlayer.status === 'ALIVE';
  const isTraitor = clientPlayer.role === 'TRAITOR';

  // --- HELPER LOGIC FOR PRIVATE MESSAGES ---
  // Returns sorted channel ID for 1-on-1 private chats between user and target
  const getPrivateChannelId = (targetId) => {
    const sorted = [clientPlayer.id, targetId].sort();
    return `private-${sorted[0]}-${sorted[1]}`;
  };

  const handleSelectPmPlayer = (player) => {
    setSelectedPmPlayer(player);
    setActiveChannel(getPrivateChannelId(player.id));
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    emitSocket('sendMessage', {
      channelId: activeChannel,
      text: chatText
    });
    setChatText('');
  };

  const handleCastVote = (candidateId) => {
    setVotedPlayerId(candidateId);
    emitSocket('castVote', { votedId: candidateId });
  };

  // Get list of messages for current channel
  const getCurrentChannelMessages = () => {
    return gameState.messages.filter(msg => msg.channelId === activeChannel);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1 }}>
      
      {/* SECTION: PLAYER DASHBOARD TAB */}
      {tab === 'dashboard' && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Identity Box */}
          <div 
            className={`gothic-panel ${isTraitor && isAlive ? 'gothic-panel-crimson crimson-glow' : 'candle-glow'}`}
            style={{ textAlign: 'center' }}
          >
            <PlayerAvatar 
              name={clientPlayer.name}
              avatarUrl={clientPlayer.avatarUrl}
              fallbackType="shield"
              shieldSize={36}
              shieldClassName={isTraitor && isAlive ? 'text-crimson' : 'text-gold'}
              shieldStyle={{ margin: '0 auto 10px', display: 'block', animation: 'flicker 4s infinite alternate' }}
              containerStyle={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: isTraitor && isAlive ? '2px solid var(--crimson)' : '2px solid var(--gold)',
                margin: '0 auto 12px',
                boxShadow: isTraitor && isAlive ? 'var(--shadow-crimson)' : 'var(--shadow-candle)',
                animation: 'flicker 4s infinite alternate ease-in-out'
              }}
            />
            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your Secret Order</h3>
            <h2 style={{ fontSize: '1.4rem', letterSpacing: '0.15em', marginTop: '4px' }}>
              {gameState.gameStatus === 'LOBBY' ? 'IDENTITY SECURED' : (isAlive ? clientPlayer.role : 'ELIMINATED')}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
              {gameState.gameStatus === 'LOBBY' ? (
                'Wait in the lounge. The Game Master will seal your identity shortly.'
              ) : isAlive ? (
                isTraitor 
                  ? 'Murder Faithfuls in the dark. Form alliances. Do not get caught.' 
                  : 'Root out the Traitors. Keep your eyes open. Vote wisely.'
              ) : (
                'You have met your demise. You can no longer speak with the living, only whisper in the Graveyard.'
              )}
            </p>
            {clientPlayer.shielded && isAlive && (
              <div 
                style={{
                  marginTop: '15px',
                  padding: '10px 14px',
                  background: 'rgba(197, 160, 40, 0.08)',
                  border: '1px solid var(--gold)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  justifyContent: 'center'
                }}
              >
                <Shield size={16} className="text-gold" style={{ filter: 'drop-shadow(0 0 4px var(--gold-glow))', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 'bold', letterSpacing: '0.05em', textAlign: 'left' }}>
                  Sacred Shield Active: You are protected from Traitor murder tonight.
                </span>
              </div>
            )}
          </div>

          {/* Web Push Notification status */}
          {typeof window.Notification !== 'undefined' && window.Notification.permission !== 'granted' && (
            <div className="gothic-panel" style={{ borderTopColor: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px' }}>
              <Volume2 className="text-gold" size={24} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.75rem', display: 'block' }}>Muted Notifications</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Ensure you add this app to your Home Screen and accept alerts to receive GM orders!</span>
              </div>
            </div>
          )}

          {/* GM DECREES / ALERTS */}
          <div className="gothic-panel" style={{ borderTopColor: 'var(--crimson-glow)' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--crimson-glow)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={14} className="text-crimson" /> Decrees of the Game Master
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
              {gameState.messages.filter(msg => msg.channelId === 'gm-alerts').length === 0 ? (
                <div style={{ padding: '12px 0', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No decrees have been issued from the tower.
                </div>
              ) : (
                gameState.messages
                  .filter(msg => msg.channelId === 'gm-alerts')
                  .slice().reverse() // Show newest first
                  .map(msg => (
                    <div 
                      key={msg.id}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(138, 19, 19, 0.05)',
                        borderLeft: '3px solid var(--crimson)',
                        borderTop: 'var(--border-dark)',
                        borderRight: 'var(--border-dark)',
                        borderBottom: 'var(--border-dark)',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '0.8rem',
                        lineHeight: '1.4'
                      }}
                    >
                      <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{msg.text}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* ACTIVE PLAYERS DIRECTORY */}
          <div className="gothic-panel">
            <h3 style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={14} /> The Castle Inhabitants
            </h3>
            
            <div className="player-grid">
              {gameState.players.map(p => {
                if (p.id === clientPlayer.id) return null; // Skip self
                const pAlive = p.status === 'ALIVE';
                const pTraitor = p.role === 'TRAITOR';
                
                return (
                  <div 
                    key={p.id} 
                    className={`player-card ${!pAlive ? 'dead' : ''}`}
                    onClick={() => pAlive && handleSelectPmPlayer(p)}
                    style={{ cursor: pAlive ? 'pointer' : 'default', padding: '10px 12px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <PlayerAvatar 
                        name={p.name}
                        avatarUrl={p.avatarUrl}
                        fallbackType="initials"
                        initialsSize="0.8rem"
                        containerStyle={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: '1px solid var(--gold)',
                          background: 'var(--bg-primary)',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{p.name}</span>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          {pTraitor && (
                            <span className="player-badge badge-traitor" style={{ fontSize: '0.45rem', padding: '1px 3px' }}>Traitor</span>
                          )}
                          {!pAlive && (
                            <span className="player-badge badge-dead" style={{ fontSize: '0.45rem', padding: '1px 3px' }}>Dead</span>
                          )}
                          {pAlive && !pTraitor && (
                            <span className="player-badge badge-faithful" style={{ fontSize: '0.45rem', padding: '1px 3px', opacity: 0.6 }}>Alive</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {pAlive && (
                      <ChevronRight size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* SECTION: CHAMBER CHAT TAB */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, padding: '12px' }}>
          
          {/* Channel Select Slider */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none', alignItems: 'center' }}>
            
            {/* Lounge Tab */}
            {isAlive && (
              <button 
                onClick={() => { setSelectedPmPlayer(null); setActiveChannel('global'); }}
                className={`gothic-btn-muted ${activeChannel === 'global' ? 'text-gold' : ''}`}
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: activeChannel === 'global' ? '1px solid var(--gold)' : 'var(--border-dark)' }}
              >
                Castle Lounge
              </button>
            )}

            {/* Den Tab (Traitors Only) */}
            {isAlive && isTraitor && (
              <button 
                onClick={() => { setSelectedPmPlayer(null); setActiveChannel('traitors'); }}
                className={`gothic-btn-muted ${activeChannel === 'traitors' ? 'text-crimson' : ''}`}
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: activeChannel === 'traitors' ? '1px solid var(--crimson-glow)' : 'var(--border-dark)' }}
              >
                Traitors' Den
              </button>
            )}

            {/* Graveyard Tab (Dead Only) */}
            {!isAlive && (
              <button 
                onClick={() => { setSelectedPmPlayer(null); setActiveChannel('graveyard'); }}
                className={`gothic-btn-muted ${activeChannel === 'graveyard' ? 'text-crimson' : ''}`}
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: activeChannel === 'graveyard' ? '1px solid var(--border-crimson)' : 'var(--border-dark)' }}
              >
                The Graveyard
              </button>
            )}

            {/* Alliance Group Tabs */}
            {(gameState.groups || []).map(group => (
              <button
                key={group.id}
                onClick={() => { setSelectedPmPlayer(null); setActiveChannel(group.id); }}
                className={`gothic-btn-muted ${activeChannel === group.id ? 'text-gold' : ''}`}
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: activeChannel === group.id ? '1px solid var(--gold)' : 'var(--border-dark)' }}
              >
                🛡️ {group.name}
              </button>
            ))}

            {/* Selected PM Target Tab */}
            {selectedPmPlayer && (
              <button 
                className="gothic-btn"
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: '1px solid var(--gold)' }}
              >
                ✉️ {selectedPmPlayer.name}
              </button>
            )}

            {/* Form Alliance Action button */}
            {isAlive && (
              <button 
                onClick={() => {
                  setNewGroupName('');
                  setSelectedGroupMembers([]);
                  setShowCreateGroupModal(true);
                }}
                className="gothic-btn-muted"
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: '1px solid var(--gold)', color: 'var(--gold)' }}
              >
                + Form Alliance
              </button>
            )}

            {/* Inline Whispering Dropdown */}
            {isAlive && (
              <select
                value={selectedPmPlayer ? selectedPmPlayer.id : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setSelectedPmPlayer(null);
                    setActiveChannel('global');
                  } else {
                    const p = gameState.players.find(pl => pl.id === val);
                    if (p) {
                      handleSelectPmPlayer(p);
                    }
                  }
                }}
                className="gothic-input"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  height: '32px',
                  backgroundColor: 'rgba(20, 20, 20, 0.8)',
                  color: 'var(--gold)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: '4px',
                  flexShrink: 0,
                  width: 'auto',
                  minWidth: '100px'
                }}
              >
                <option value="">💬 Whisper...</option>
                {gameState.players
                  .filter(p => p.id !== clientPlayer.id && p.status === 'ALIVE')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                }
              </select>
            )}

          </div>

          {/* Main Chat Stream Window */}
          <div className="chat-window" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            
            {/* Header displaying channel description */}
            <div className="chat-header">
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.75rem', color: 'var(--gold)', textTransform: 'uppercase' }}>
                {activeChannel === 'global' && 'Castle Lounge (Public)'}
                {activeChannel === 'traitors' && 'Traitors\' Den (Confidential)'}
                {activeChannel === 'graveyard' && 'Graveyard Whispers'}
                {activeChannel.startsWith('private-') && `Secret Letter to ${selectedPmPlayer?.name}`}
                {activeChannel.startsWith('group_') && `Alliance: ${(gameState.groups || []).find(g => g.id === activeChannel)?.name || 'Custom Group'}`}
              </span>
              {activeChannel === 'traitors' && <Lock size={12} className="text-crimson" />}
            </div>

            {/* Chat Messages */}
            <div className="chat-messages">
              {getCurrentChannelMessages().length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, flexDirection: 'column' }}>
                  <MessageSquare size={28} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-serif)' }}>No letters have been received.</span>
                </div>
              ) : (
                getCurrentChannelMessages().map((msg) => {
                  const isOwn = msg.senderId === clientPlayer.id;
                  const isGm = msg.senderId === 'gm';
                  
                  return (
                    <div 
                      key={msg.id}
                      className={`message-bubble ${isOwn ? 'outgoing' : 'incoming'} ${isGm ? 'alert' : ''}`}
                    >
                      {!isOwn && !isGm && (
                        <div className="message-sender">{msg.senderName}</div>
                      )}
                      <div>{msg.text}</div>
                      <div className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* GM Lockout overlay if chats disabled */}
            {activeChannel !== 'graveyard' && !gameState.chatsEnabled && (
              <div className="chat-lockout-overlay">
                <Lock size={32} className="text-crimson" style={{ marginBottom: '10px', animation: 'flicker 4s infinite alternate' }} />
                <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--crimson-glow)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Lounges Sealed</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Night hours have commenced. You are forbidden from exchanging letters under order of the Game Master.
                </p>
              </div>
            )}

            {/* Locked private chats overlay */}
            {activeChannel.startsWith('private-') && gameState.chatsEnabled && !gameState.privateChatsEnabled && (
              <div className="chat-lockout-overlay">
                <Lock size={32} className="text-crimson" style={{ marginBottom: '10px' }} />
                <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--crimson-glow)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Private Letters Silenced</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Secret letters have been locked by the Game Master.
                </p>
              </div>
            )}

            {/* Locked group chats overlay */}
            {activeChannel.startsWith('group_') && gameState.chatsEnabled && !gameState.privateChatsEnabled && (
              <div className="chat-lockout-overlay">
                <Lock size={32} className="text-crimson" style={{ marginBottom: '10px' }} />
                <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--crimson-glow)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Alliance Chats Silenced</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Alliance channels have been locked by the Game Master.
                </p>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendChat} className="chat-input-bar">
              <input 
                type="text" 
                value={chatText} 
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Write message..." 
                className="gothic-input"
                style={{ padding: '8px 12px', fontSize: '0.85rem', flex: 1, borderBottom: 'none' }}
                disabled={(activeChannel !== 'graveyard' && !gameState.chatsEnabled) || (activeChannel.startsWith('group_') && !gameState.privateChatsEnabled)}
              />
              <button 
                type="submit" 
                className="gothic-btn" 
                style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                disabled={!chatText.trim() || (activeChannel !== 'graveyard' && !gameState.chatsEnabled) || (activeChannel.startsWith('group_') && !gameState.privateChatsEnabled)}
              >
                Send
              </button>
            </form>

          </div>
        </div>
      )}

      {/* SECTION: ROUNDTABLE (VOTING) TAB */}
      {tab === 'voting' && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
          
          {!gameState.votingActive ? (
            // INACTIVE VOTING
            <div className="gothic-panel candle-glow" style={{ textAlign: 'center', padding: '30px 16px' }}>
              <Lock 
                size={36} 
                className="text-gold" 
                style={{ margin: '0 auto 12px', display: 'block', animation: 'flicker 5s infinite alternate' }} 
              />
              <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '8px' }}>Roundtable Adjourned</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                The roundtable is currently silent. Keep your counsel, gather information, and be ready to vote when the Game Master strikes the gong.
              </p>
            </div>
          ) : (
            // ACTIVE VOTING PORTAL
            <div>
              {/* Check if target is correct */}
              {gameState.votingType === 'MURDER' && !isTraitor ? (
                // FAITHFULS CANNOT VOTE DURING MURDER ROUNDS
                <div className="gothic-panel candle-glow" style={{ textAlign: 'center', padding: '30px 16px' }}>
                  <Lock size={36} className="text-gold" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '8px' }}>Night Terrors</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    The Traitors are walking the castle corridors. You are asleep in your chamber, praying to survive the sunrise...
                  </p>
                </div>
              ) : !isAlive ? (
                // DEAD PLAYERS CANNOT VOTE
                <div className="gothic-panel" style={{ textAlign: 'center', padding: '30px 16px', borderTopColor: 'var(--crimson)' }}>
                  <Lock size={36} className="text-crimson" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <h3 style={{ fontSize: '1rem', color: 'var(--crimson-glow)', marginBottom: '8px' }}>Roundtable Forbidden</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Dead characters carry no vote. You can only observe the living.
                  </p>
                </div>
              ) : gameState.clientVoted || votedPlayerId ? (
                // PLAYER HAS CAST VOTE
                <div className="gothic-panel candle-glow" style={{ textAlign: 'center', padding: '30px 16px' }}>
                  <Check 
                    size={36} 
                    className="text-gold" 
                    style={{ margin: '0 auto 12px', display: 'block', boxShadow: '0 0 15px rgba(197, 160, 40, 0.4)', borderRadius: '50%', background: 'rgba(197, 160, 40, 0.1)', padding: '6px' }} 
                  />
                  <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '8px' }}>Vote Sealed</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Your ballot has been cast. It has been sealed in the archives. The Game Master will reveal the results once the roundtable concludes.
                  </p>
                </div>
              ) : (
                // CAST BALLOT INTERFACE
                <div className="gothic-panel">
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '4px', textAlign: 'center' }}>
                    {gameState.votingType === 'EXILE' ? 'Roundtable Exile Vote' : 'Traitor Murder Ballot'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '15px' }}>
                    {gameState.votingType === 'EXILE' 
                      ? 'Choose the player you wish to exile from the castle:' 
                      : 'Traitors, agree and choose a Faithful to assassinate:'
                    }
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {gameState.players
                      .filter(p => gameState.votingOptions.includes(p.id) && p.id !== clientPlayer.id)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleCastVote(p.id)}
                          className="gothic-btn-crimson gothic-btn"
                          style={{ padding: '12px 6px', fontSize: '0.75rem', fontFamily: 'var(--font-serif)' }}
                        >
                          {p.name}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Alliance Creation Modal Overlay */}
      {showCreateGroupModal && (
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
              maxHeight: '80vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              margin: 0
            }}
          >
            <h3 style={{ fontSize: '1rem', color: 'var(--gold)', textAlign: 'center', borderBottom: '1px solid rgba(197, 160, 40, 0.3)', paddingBottom: '8px' }}>
              Form Secret Alliance
            </h3>
            
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Alliance Name</label>
              <input 
                type="text" 
                className="gothic-input" 
                placeholder="e.g. Faithful Pact"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={30}
              />
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Invite Members (Must be Alive)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {gameState.players
                  .filter(p => p.id !== clientPlayer.id && p.status === 'ALIVE')
                  .map(p => {
                    const isChecked = selectedGroupMembers.includes(p.id);
                    return (
                      <div 
                        key={p.id}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== p.id));
                          } else {
                            setSelectedGroupMembers([...selectedGroupMembers, p.id]);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          background: isChecked ? 'rgba(197, 160, 40, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: isChecked ? '1px solid var(--gold)' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '1px solid var(--gold)',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isChecked ? 'var(--gold-dark)' : 'transparent'
                        }}>
                          {isChecked && <Check size={12} className="text-gold-glow" />}
                        </div>
                        <span style={{ fontSize: '0.85rem', color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.name}</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                className="gothic-btn-muted" 
                style={{ flex: 1, padding: '10px', fontSize: '0.8rem' }}
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupName('');
                  setSelectedGroupMembers([]);
                }}
              >
                Cancel
              </button>
              <button 
                className="gothic-btn" 
                style={{ flex: 1, padding: '10px', fontSize: '0.8rem' }}
                disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                onClick={() => {
                  emitSocket('createGroup', {
                    name: newGroupName,
                    memberIds: selectedGroupMembers
                  });
                  setShowCreateGroupModal(false);
                  setNewGroupName('');
                  setSelectedGroupMembers([]);
                }}
              >
                Seal Pact
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PlayerDashboard;
