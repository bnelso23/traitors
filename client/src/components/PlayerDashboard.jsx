import React, { useState, useEffect, useRef } from 'react';
import { Shield, MessageSquare, Award, Volume2, Key, HelpCircle, User, Users, Lock, ChevronRight, Check } from 'lucide-react';

function PlayerDashboard({ gameState, emitSocket, initialTab = 'dashboard', onNavigateChat }) {
  const [tab, setTab] = useState(initialTab);
  const [activeChannel, setActiveChannel] = useState('global'); // global, traitors, graveyard, private-pX
  const [selectedPmPlayer, setSelectedPmPlayer] = useState(null); // player object for DM
  const [chatText, setChatText] = useState('');
  const [votedPlayerId, setVotedPlayerId] = useState(null);
  
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
            <Shield 
              size={36} 
              className={isTraitor && isAlive ? 'text-crimson' : 'text-gold'} 
              style={{ margin: '0 auto 10px', display: 'block', animation: 'flicker 4s infinite alternate' }} 
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
                    style={{ cursor: pAlive ? 'pointer' : 'default' }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{p.name}</span>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      {pTraitor && (
                        <span className="player-badge badge-traitor" style={{ fontSize: '0.5rem', padding: '1px 3px' }}>Traitor</span>
                      )}
                      {!pAlive && (
                        <span className="player-badge badge-dead" style={{ fontSize: '0.5rem', padding: '1px 3px' }}>Dead</span>
                      )}
                      {pAlive && !pTraitor && (
                        <span className="player-badge badge-faithful" style={{ fontSize: '0.5rem', padding: '1px 3px', opacity: 0.6 }}>Alive</span>
                      )}
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
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
            
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

            {/* Selected PM Target Tab */}
            {selectedPmPlayer && (
              <button 
                className="gothic-btn"
                style={{ padding: '8px 12px', fontSize: '0.7rem', flexShrink: 0, borderRadius: '4px', border: '1px solid var(--gold)' }}
              >
                ✉️ {selectedPmPlayer.name}
              </button>
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

            {/* Input Bar */}
            <form onSubmit={handleSendChat} className="chat-input-bar">
              <input 
                type="text" 
                value={chatText} 
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Write message..." 
                className="gothic-input"
                style={{ padding: '8px 12px', fontSize: '0.85rem', flex: 1, borderBottom: 'none' }}
                disabled={activeChannel !== 'graveyard' && !gameState.chatsEnabled}
              />
              <button 
                type="submit" 
                className="gothic-btn" 
                style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                disabled={!chatText.trim() || (activeChannel !== 'graveyard' && !gameState.chatsEnabled)}
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
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '15px' }}>
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

    </div>
  );
}

export default PlayerDashboard;
