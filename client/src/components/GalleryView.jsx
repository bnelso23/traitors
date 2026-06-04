import React, { useState, useEffect } from 'react';
import { Search, X, Maximize2, Compass } from 'lucide-react';

export default function GalleryView() {
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPainting, setSelectedPainting] = useState(null);

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
            {filteredPaintings.map((painting) => (
              <div 
                key={painting.id}
                className="painting-card-wrapper"
                onClick={() => setSelectedPainting(painting)}
              >
                <div className="painting-frame">
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
            ))}
          </div>
        )}
      </div>

      {/* Full-Screen Enlargement Modal Overlay */}
      {selectedPainting && (
        <div 
          className="gallery-overlay"
          onClick={() => setSelectedPainting(null)}
        >
          <button 
            className="gallery-close-btn"
            onClick={(e) => { e.stopPropagation(); setSelectedPainting(null); }}
          >
            <X size={20} />
          </button>
          
          <div 
            className="painting-frame frame-enlarged"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <div className="painting-mat mat-enlarged">
              <img 
                src={selectedPainting.url} 
                alt={selectedPainting.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  objectFit: 'contain',
                  border: '3px solid #000',
                  boxShadow: '0 6px 15px rgba(0,0,0,0.6)'
                }}
              />
              
              <div className="painting-placard placard-enlarged">
                <div className="placard-title-large">{selectedPainting.title}</div>
                <div className="placard-artist-large">by {selectedPainting.artist}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
