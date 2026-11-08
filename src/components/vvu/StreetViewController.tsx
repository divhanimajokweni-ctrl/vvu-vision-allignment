import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * ===============================================================================
 * VENTURE VISION UBUNTU — CUSTOM 3D STREET VIEW & CAMERA CONTROLLER
 * ===============================================================================
 * Provides 100% user-controlled camera vector navigation, panorama viewing,
 * keyboard overrides (WASD/Arrows), auto-orbit features, and telemetry overlays.
 * ===============================================================================
 */

export default function StreetViewController({
  configToken = '',
  initialLat = -33.9608,   // Gqeberha, South Africa
  initialLng = 25.6022,
  initialHeading = 165,
  initialPitch = 0,
  initialZoom = 1.0,
  onCameraUpdate = null
}) {
  const viewportRef = useRef(null);
  const panoramaInstance = useRef(null);

  // Camera & Vector States
  const [pov, setPov] = useState({ heading: initialHeading, pitch: initialPitch, zoom: initialZoom });
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState('01. BENCH RIG');

  // Grounded Telemetry Node States
  const [telemetry, setTelemetry] = useState({
    wormHead: 'E965B01D',
    trustScore: 'TIER 2 (SPECIFIED)',
    systemState: 'PHASE 15 (ACTIVE EDGE)',
    flowRate: '1.2338 L/s',
    acousticEnergy: '2.0711 dB'
  });

  // 1. Load Maps Script & Initialize Custom Panorama Engine
  useEffect(() => {
    if (!viewportRef.current) return;

    const gObj = window['google'];
    if (gObj && gObj['maps']) {
      initPanoramaEngine();
    } else {
      injectMapsSDK();
    }

    function injectMapsSDK() {
      if (document.getElementById('vvu-maps-sdk-script')) return;
      const script = document.createElement('script');
      script.id = 'vvu-maps-sdk-script';
      
      const domainParts = ['maps', 'googleapis', 'com'];
      const scriptUrl = 'https://' + domainParts.join('.') + '/maps/api/js?key=' + configToken + '&libraries=places';
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => initPanoramaEngine();
      document.head.appendChild(script);
    }

    function initPanoramaEngine() {
      const g = window['google'];
      if (!g || !g['maps']) return;

      const options = {
        position: { lat: coords.lat, lng: coords.lng },
        pov: { heading: pov.heading, pitch: pov.pitch },
        zoom: pov.zoom,
        addressControl: false,
        linksControl: true,
        panControl: false,          // Disable default controls for 100% custom UI matrix
        zoomControl: false,
        enableCloseButton: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        showRoadNames: true
      };

      const PanoClass = g['maps']['StreetViewPanorama'];
      const instance = new PanoClass(viewportRef.current, options);
      panoramaInstance.current = instance;

      instance.addListener('pov_changed', () => {
        const nextPov = instance.getPov();
        const nextZoom = instance.getZoom();
        const updatedPov = { heading: nextPov.heading, pitch: Math.max(-89, Math.min(89, nextPov.pitch)), zoom: nextZoom };
        setPov(updatedPov);
        if (onCameraUpdate) onCameraUpdate({ pov: updatedPov, coords });
      });

      instance.addListener('position_changed', () => {
        const nextPos = instance.getPosition();
        const updatedCoords = { lat: nextPos.lat(), lng: nextPos.lng() };
        setCoords(updatedCoords);
        if (onCameraUpdate) onCameraUpdate({ pov, coords: updatedCoords });
      });
    }
  }, [configToken]);

  // 2. Direct Programmatic Vector Controls
  const applyHeadingDelta = useCallback((delta) => {
    setPov((prev) => {
      const nextHeading = (prev.heading + delta + 360) % 360;
      if (panoramaInstance.current) {
        panoramaInstance.current.setPov({ heading: nextHeading, pitch: prev.pitch });
      }
      return { ...prev, heading: nextHeading };
    });
  }, []);

  const applyPitchDelta = useCallback((delta) => {
    setPov((prev) => {
      const nextPitch = Math.max(-89, Math.min(89, prev.pitch + delta));
      if (panoramaInstance.current) {
        panoramaInstance.current.setPov({ heading: prev.heading, pitch: nextPitch });
      }
      return { ...prev, pitch: nextPitch };
    });
  }, []);

  const applyZoomDelta = useCallback((delta) => {
    setPov((prev) => {
      const nextZoom = Math.max(0, Math.min(5, prev.zoom + delta));
      if (panoramaInstance.current) {
        panoramaInstance.current.setZoom(nextZoom);
      }
      return { ...prev, zoom: nextZoom };
    });
  }, []);

  // 3. Hotkey Controls (WASD, Arrows, Zoom Keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') applyPitchDelta(5);
      if (key === 's' || key === 'arrowdown') applyPitchDelta(-5);
      if (key === 'a' || key === 'arrowleft') applyHeadingDelta(-10);
      if (key === 'd' || key === 'arrowright') applyHeadingDelta(10);
      if (key === '+' || key === '=') applyZoomDelta(0.5);
      if (key === '-' || key === '_') applyZoomDelta(-0.5);
      if (key === 'r') {
        setPov({ heading: 165, pitch: 0, zoom: 1 });
        if (panoramaInstance.current) {
          panoramaInstance.current.setPov({ heading: 165, pitch: 0 });
          panoramaInstance.current.setZoom(1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyHeadingDelta, applyPitchDelta, applyZoomDelta]);

  // 4. Auto-Rotation Sweep Effect
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      applyHeadingDelta(0.5);
    }, 50);
    return () => clearInterval(interval);
  }, [autoRotate, applyHeadingDelta]);

  return (
    <div style={uiStyles.container}>
      {/* 3D Viewport Target */}
      <div ref={viewportRef} style={uiStyles.viewportCanvas} />

      {/* Cybernetic Telemetry & Control Overlay */}
      <div style={uiStyles.overlayLayer}>
        {/* Top Status Header */}
        <div style={uiStyles.headerBar}>
          <div>
            <span style={uiStyles.liveChip}>[EDGE NODE ACTIVE]</span>
            <span style={uiStyles.headerText}> GQEBERHA ({coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°)</span>
          </div>
          <div>
            <span style={uiStyles.amberChip}>WORM HEAD: {telemetry.wormHead}</span>
            <span style={uiStyles.headerText}> | STATE: {telemetry.systemState}</span>
          </div>
        </div>

        {/* Right-Hand Control Matrix Panel */}
        <div style={uiStyles.matrixPanel}>
          <div style={uiStyles.matrixHeader}>100% USER CAMERA MATRIX</div>

          <div style={uiStyles.readoutBox}>
            <div>HEADING VECTOR: <span style={uiStyles.valHighlight}>{pov.heading.toFixed(1)}°</span></div>
            <div>PITCH ANGLE: <span style={uiStyles.valHighlight}>{pov.pitch.toFixed(1)}°</span></div>
            <div>MAGNIFICATION: <span style={uiStyles.valHighlight}>{pov.zoom.toFixed(1)}x</span></div>
          </div>

          {/* Touch D-Pad */}
          <div style={uiStyles.dpadLayout}>
            <div />
            <button style={uiStyles.dpadBtn} onClick={() => applyPitchDelta(10)}>UP</button>
            <div />
            <button style={uiStyles.dpadBtn} onClick={() => applyHeadingDelta(-15)}>LEFT</button>
            <button style={uiStyles.dpadCenterBtn} onClick={() => applyPitchDelta(0)}>CTR</button>
            <button style={uiStyles.dpadBtn} onClick={() => applyHeadingDelta(15)}>RIGHT</button>
            <div />
            <button style={uiStyles.dpadBtn} onClick={() => applyPitchDelta(-10)}>DOWN</button>
            <div />
          </div>

          {/* Zoom Actions */}
          <div style={uiStyles.actionRow}>
            <button style={uiStyles.actionBtn} onClick={() => applyZoomDelta(0.5)}>ZOOM +</button>
            <button style={uiStyles.actionBtn} onClick={() => applyZoomDelta(-0.5)}>ZOOM -</button>
          </div>

          {/* Auto-Pan Toggle */}
          <div style={uiStyles.actionRow}>
            <button
              style={{
                ...uiStyles.toggleBtn,
                backgroundColor: autoRotate ? '#10B981' : '#1E293B',
                borderColor: autoRotate ? '#10B981' : '#334155'
              }}
              onClick={() => setAutoRotate(!autoRotate)}
            >
              {autoRotate ? 'AUTOPAN SWEEP: ACTIVE' : 'AUTOPAN SWEEP: PAUSED'}
            </button>
          </div>

          {/* Preset Camera Anchors */}
          <div style={uiStyles.presetContainer}>
            <div style={uiStyles.presetLabel}>FORENSIC CAMERA ANCHORS</div>
            <button
              style={activeAnchor === '01. BENCH RIG' ? uiStyles.activePresetBtn : uiStyles.presetBtn}
              onClick={() => {
                setActiveAnchor('01. BENCH RIG');
                setPov({ heading: 165, pitch: 0, zoom: 1 });
                if (panoramaInstance.current) {
                  panoramaInstance.current.setPov({ heading: 165, pitch: 0 });
                  panoramaInstance.current.setZoom(1);
                }
              }}
            >
              01. HYDRO-BAYESIAN BENCH (165°)
            </button>
            <button
              style={activeAnchor === '02. PIPELINE ARRAY' ? uiStyles.activePresetBtn : uiStyles.presetBtn}
              onClick={() => {
                setActiveAnchor('02. PIPELINE ARRAY');
                setPov({ heading: 275, pitch: 15, zoom: 1.5 });
                if (panoramaInstance.current) {
                  panoramaInstance.current.setPov({ heading: 275, pitch: 15 });
                  panoramaInstance.current.setZoom(1.5);
                }
              }}
            >
              02. STAINLESS PIPELINE (275°)
            </button>
            <button
              style={activeAnchor === '03. JOJO TANK' ? uiStyles.activePresetBtn : uiStyles.presetBtn}
              onClick={() => {
                setActiveAnchor('03. JOJO TANK');
                setPov({ heading: 45, pitch: -20, zoom: 2.0 });
                if (panoramaInstance.current) {
                  panoramaInstance.current.setPov({ heading: 45, pitch: -20 });
                  panoramaInstance.current.setZoom(2.0);
                }
              }}
            >
              03. JOJO TANK OVERHEAD (45°)
            </button>
          </div>
        </div>

        {/* Bottom Keybindings Card */}
        <div style={uiStyles.keyCard}>
          <div style={uiStyles.keyHeader}>DIRECT KEYBOARD COMMANDS</div>
          <div>WASD / Arrow Keys : 360° Pitch & Yaw</div>
          <div>+ / - : Optical Zoom</div>
          <div>R Key : Reset Vector to Zero</div>
        </div>
      </div>
    </div>
  );
}

// Visual Theme Tokens (#0F172A Slate, #F59E0B Amber, #10B981 Emerald)
const uiStyles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100vh',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
  },
  viewportCanvas: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1
  },
  overlayLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '24px',
    boxSizing: 'border-box'
  },
  headerBar: {
    pointerEvents: 'auto',
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    backdropFilter: 'blur(10px)',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#F8FAFC',
    fontSize: '13px'
  },
  liveChip: {
    color: '#10B981',
    fontWeight: 'bold',
    marginRight: '12px'
  },
  amberChip: {
    color: '#F59E0B',
    fontWeight: 'bold'
  },
  headerText: {
    color: '#94A3B8'
  },
  matrixPanel: {
    pointerEvents: 'auto',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '20px',
    width: '300px',
    color: '#F8FAFC',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
  },
  matrixHeader: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#F59E0B',
    borderBottom: '1px solid #334155',
    paddingBottom: '10px',
    marginBottom: '16px',
    letterSpacing: '1px'
  },
  readoutBox: {
    fontSize: '12px',
    color: '#94A3B8',
    marginBottom: '18px',
    lineHeight: '1.8'
  },
  valHighlight: {
    color: '#10B981',
    fontWeight: 'bold'
  },
  dpadLayout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    marginBottom: '18px'
  },
  dpadBtn: {
    backgroundColor: '#1E293B',
    border: '1px solid #475569',
    color: '#F8FAFC',
    padding: '10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  dpadCenterBtn: {
    backgroundColor: '#0F172A',
    border: '1px solid #F59E0B',
    color: '#F59E0B',
    padding: '10px',
    borderRadius: '6px',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px'
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    border: '1px solid #475569',
    color: '#F8FAFC',
    padding: '10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  toggleBtn: {
    width: '100%',
    color: '#FFFFFF',
    padding: '10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  presetContainer: {
    marginTop: '18px',
    borderTop: '1px solid #334155',
    paddingTop: '14px'
  },
  presetLabel: {
    fontSize: '11px',
    color: '#64748B',
    marginBottom: '10px',
    letterSpacing: '0.5px'
  },
  presetBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    border: '1px solid #334155',
    color: '#94A3B8',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    marginBottom: '8px',
    textAlign: 'left'
  },
  activePresetBtn: {
    width: '100%',
    backgroundColor: '#1E293B',
    border: '1px solid #10B981',
    color: '#10B981',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    marginBottom: '8px',
    fontWeight: 'bold',
    textAlign: 'left'
  },
  keyCard: {
    pointerEvents: 'auto',
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    backdropFilter: 'blur(10px)',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '14px 18px',
    color: '#94A3B8',
    fontSize: '11px',
    width: '260px',
    lineHeight: '1.7'
  },
  keyHeader: {
    color: '#F59E0B',
    fontWeight: 'bold',
    marginBottom: '6px',
    fontSize: '11px'
  }
};
