import React, { useState, useEffect } from 'react';
import { Search, X, Maximize2, Compass, Shield, CheckCircle, Info } from 'lucide-react';

export default function GalleryView({ gameState, emitSocket, user }) {
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPainting, setSelectedPainting] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  // Shield mechanic state
  const [showClaimAnimation, setShowClaimAnimation] = useState(false);
  const [claimedPaintingId, setClaimedPaintingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [feedbackType, setFeedbackType] = useState(null); // 'success', 'error'
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    fetch('/api/paintings')
      .then(res => res.json())
      .then(data => {
        setPaintings(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load paintings metadata:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleShieldResult = (e) => {
      const result = e.detail;
      if (result.success) {
        setClaimedPaintingId(result.paintingId);
        setShowClaimAnimation(true);
        
        // Generate sparkle particles
        const newParticles = [];
        for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 40 + Math.random() * 120;
          newParticles.push({
            id: i,
            dx: Math.cos(angle) * distance,
            dy: Math.sin(angle) * distance,
            delay: Math.random() * 0.4,
            size: 3 + Math.random() * 6
          });
        }
        setParticles(newParticles);
      } else {
        setFeedbackMessage(result.error || 'Nothing is hidden behind this portrait.');
        setFeedbackType('error');
        // Clear feedback message after 4 seconds
        setTimeout(() => {
          setFeedbackMessage(null);
          setFeedbackType(null);
        }, 4000);
      }
    };

    window.addEventListener('traitors_gallery_shield_result', handleShieldResult);
    return () => {
      window.removeEventListener('traitors_gallery_shield_result', handleShieldResult);
    };
  }, []);

  const handleClaimShield = (paintingId) => {
    if (!emitSocket) return;
    setFeedbackMessage(null);
    setFeedbackType(null);
    emitSocket('claimGalleryShield', { paintingId });
  };

  const handleHideShield = (paintingId) => {
    if (!emitSocket) return;
    emitSocket('gmHideGalleryShield', { paintingId });
  };

  const getClaimedPlayerName = () => {
    if (!gameState || !gameState.galleryShield || !gameState.galleryShield.claimedBy) return '';
    const claimer = gameState.players?.find(p => p.id === gameState.galleryShield.claimedBy);
    return claimer ? claimer.name : 'Unknown Inhabitant';
  };

  const filteredPaintings = paintings.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.artist.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '15px', padding: '40px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--gold-dark)', borderTopColor: 'var(--gold)', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)' }}>Entering the Castle Gallery...</p>
      </div>
    );
  }

  const isGM = user?.role === 'GM';
  const isPlayer = user && user.role !== 'GM';
  const shieldClaimed = gameState?.galleryShield?.claimed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1, minHeight: 0 }}>
      {/* Search Header */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: 'var(--border-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search paintings or artists..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="gothic-input"
            style={{ padding: '6px 12px 6px 32px', fontSize: '0.8rem', borderBottom: 'none', background: 'var(--bg-primary)', border: 'var(--border-dark)', borderRadius: '4px' }}
          />
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="gothic-btn-muted"
            style={{ padding: '6px 10px', fontSize: '0.7rem', borderRadius: '4px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Gallery Wall Scroll View */}
      <div className="gallery-wall">
        <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(197, 160, 40, 0.15)', paddingBottom: '10px', width: '100%', maxWidth: '420px' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--gold)', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Compass size={16} /> Castle Portrait Gallery
          </h2>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Admire the secrets of the ancient inhabitants
          </p>
        </div>

        {filteredPaintings.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: 0.4, padding: '40px 0' }}>
            <Compass size={32} style={{ marginBottom: '8px' }} />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-serif)' }}>No portraits found.</span>
          </div>
        ) : (
          <div className="gallery-grid">
            {filteredPaintings.map((painting) => {
              const isHiddenHere = isGM && gameState?.galleryShield?.hiddenPaintingId === painting.id;
              const isClaimedHere = isGM && isHiddenHere && gameState?.galleryShield?.claimed;
              return (
                <div 
                  key={painting.id}
                  className="painting-card-wrapper"
                  onClick={() => {
                    setSelectedPainting(painting);
                    setFeedbackMessage(null);
                    setFeedbackType(null);
                  }}
                >
                  <div className="painting-frame" style={isHiddenHere ? { borderColor: 'var(--gold-dark)', boxShadow: '0 0 15px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.8)' } : {}}>
                    {isHiddenHere && (
                      <div className="gallery-shield-gm-badge" title={isClaimedHere ? `Claimed by ${getClaimedPlayerName()}` : "Sacred Shield Hidden Here"}>
                        <Shield size={16} style={{ color: isClaimedHere ? 'var(--text-muted)' : 'var(--gold-glow)' }} />
                      </div>
                    )}
                    <div className="painting-mat">
                      <img 
                        src={painting.url} 
                        alt={painting.title}
                        className="painting-image"
                        loading="lazy"
                      />
                      <div className="painting-placard">
                        <div className="placard-title">{painting.title}</div>
                        <div className="placard-artist">{painting.artist}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-Screen Enlargement Modal Overlay */}
      {selectedPainting && (
        <div 
          className="gallery-overlay"
          onClick={() => { setSelectedPainting(null); setIsZoomed(false); }}
        >
          <button 
            className="gallery-close-btn"
            onClick={(e) => { e.stopPropagation(); setSelectedPainting(null); setIsZoomed(false); }}
          >
            <X size={20} />
          </button>
          
          <div 
            className="painting-frame frame-enlarged"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              ...(isGM && gameState?.galleryShield?.hiddenPaintingId === selectedPainting.id ? { borderColor: 'var(--gold-dark)', boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)' } : {})
            }}
          >
            <div className="painting-mat mat-enlarged">
              <div 
                style={{ 
                  width: '100%', 
                  overflow: isZoomed ? 'auto' : 'hidden', 
                  maxHeight: '60vh', 
                  display: isZoomed ? 'block' : 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                  border: '3px solid #000',
                  boxShadow: '0 6px 15px rgba(0,0,0,0.6)',
                  background: '#0a0a0c',
                  position: 'relative'
                }}
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <img 
                  src={selectedPainting.url} 
                  alt={selectedPainting.title}
                  style={{
                    width: isZoomed ? '250%' : '100%',
                    height: 'auto',
                    maxWidth: isZoomed ? 'none' : '100%',
                    maxHeight: isZoomed ? 'none' : '60vh',
                    objectFit: 'contain',
                    display: 'block',
                    margin: isZoomed ? '0' : 'auto',
                    transition: 'width 0.2s ease-in-out'
                  }}
                />
              </div>
              
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>
                {isZoomed ? "💡 Swipe/scroll to pan | Tap again to zoom out" : "💡 Tap image to zoom & pan"}
              </div>
              
              <div className="painting-placard placard-enlarged">
                <div className="placard-title-large">{selectedPainting.title}</div>
                <div className="placard-artist-large">by {selectedPainting.artist}</div>
              </div>

              {/* Shield Mechanic Interactive Panel */}
              <div style={{ marginTop: '15px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                
                {/* GM CONTROLS */}
                {isGM && (
                  <div style={{
                    width: '100%',
                    background: 'rgba(10, 10, 12, 0.6)',
                    border: '1px solid rgba(197, 160, 40, 0.2)',
                    borderRadius: '6px',
                    padding: '12px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {gameState?.galleryShield?.hiddenPaintingId === selectedPainting.id ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gold)', fontFamily: 'var(--font-serif)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Shield size={16} style={{ color: 'var(--gold-glow)' }} /> Sacred Shield Hidden Here
                        </div>
                        {gameState.galleryShield.claimed ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--crimson-glow)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                            <CheckCircle size={14} /> Claimed by {getClaimedPlayerName()}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Status: <span style={{ color: 'var(--gold-glow)', fontWeight: 'bold' }}>UNCLAIMED</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {gameState?.galleryShield?.hiddenPaintingId 
                            ? "Move the hidden Sacred Shield to this portrait."
                            : "Hide the Sacred Shield behind this portrait for players to find."}
                        </p>
                        <button
                          onClick={() => handleHideShield(selectedPainting.id)}
                          className="gothic-btn"
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            marginTop: '4px'
                          }}
                        >
                          <Shield size={14} /> Hide Sacred Shield here
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* PLAYER CONTROLS */}
                {isPlayer && (
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    {feedbackMessage && (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        marginBottom: '10px',
                        width: '100%',
                        fontFamily: 'var(--font-serif)',
                        background: feedbackType === 'error' ? 'rgba(138, 19, 19, 0.15)' : 'rgba(197, 160, 40, 0.15)',
                        border: feedbackType === 'error' ? '1px solid var(--crimson)' : '1px solid var(--gold)',
                        color: feedbackType === 'error' ? 'var(--crimson-glow)' : 'var(--gold-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        animation: 'scaleUp 0.2s ease-out'
                      }}>
                        <Info size={14} />
                        {feedbackMessage}
                      </div>
                    )}

                    {user.status === 'ALIVE' ? (
                      <button
                        onClick={() => handleClaimShield(selectedPainting.id)}
                        className="gothic-btn"
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          background: 'linear-gradient(135deg, #181513 0%, #302008 100%)',
                          border: '1px solid var(--gold-dark)',
                          cursor: 'pointer'
                        }}
                      >
                        <Compass size={14} className="text-gold" /> Search Behind Frame
                      </button>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--crimson-glow)', fontStyle: 'italic', padding: '8px' }}>
                        💀 Deceased spirits cannot claim the Sacred Shield.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Celebration Overlay */}
      {showClaimAnimation && (
        <div className="shield-celebration-overlay" onClick={() => setShowClaimAnimation(false)}>
          <div className="shield-celebration-content" onClick={(e) => e.stopPropagation()}>
            {particles.map((p) => (
              <span
                key={p.id}
                className="shield-sparkle"
                style={{
                  top: '50%',
                  left: '50%',
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                  animation: `particleRise 1.2s ease-out ${p.delay}s forwards`,
                  display: 'block'
                }}
              />
            ))}

            <div className="shield-reveal-card">
              <div className="shield-glow-bg"></div>
              <Shield className="shield-icon-glowing" size={100} />
            </div>

            <h2 style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--gold-glow)',
              fontSize: '1.4rem',
              letterSpacing: '0.1em',
              margin: '20px 0 10px 0',
              textShadow: '0 0 10px rgba(197, 160, 40, 0.6)',
              textTransform: 'uppercase'
            }}>
              Sacred Shield Found!
            </h2>
            
            <p style={{
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              lineHeight: '1.4',
              marginBottom: '20px',
              fontFamily: 'var(--font-sans)'
            }}>
              You have discovered the hidden Sacred Shield. You are protected from assassination tonight!
            </p>

            <button
              onClick={() => {
                setShowClaimAnimation(false);
                setSelectedPainting(null);
              }}
              className="gothic-btn"
              style={{
                padding: '8px 24px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                borderColor: 'var(--gold)'
              }}
            >
              Excellence
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
