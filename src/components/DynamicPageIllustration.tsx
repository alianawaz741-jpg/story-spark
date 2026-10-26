import React, { useState } from 'react';
import { StoryPage } from '../types/index.ts';
import { generateSceneVisuals } from '../utils/storyEngine.ts';
import { soundManager } from '../utils/audioSynth.ts';
import { Sparkles, Palette, Loader2, RefreshCw } from 'lucide-react';

interface DynamicPageIllustrationProps {
  page: StoryPage;
  storyTitle: string;
  onUpdateIllustration?: (pageNumber: number, imageUrl: string) => void;
}

export const DynamicPageIllustration: React.FC<DynamicPageIllustrationProps> = ({
  page,
  storyTitle,
  onUpdateIllustration,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [artStyle, setArtStyle] = useState<'storybook' | 'watercolor' | '3d-render'>('storybook');
  const [customPrompt, setCustomPrompt] = useState(page.illustrationPrompt);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const sceneVisuals = generateSceneVisuals(page.illustrationPrompt, page.text);
  const hotspots = page.interactiveObjects && page.interactiveObjects.length > 0
    ? page.interactiveObjects
    : sceneVisuals.interactiveHotspots.map(h => ({ ...h, animation: 'bounce' as const }));

  const handleHotspotClick = (h: { id: string; sound: string; label: string }) => {
    setActiveHotspot(h.id);
    soundManager.playSound(h.sound || 'sparkle');
    setTimeout(() => setActiveHotspot(null), 800);
  };

  const handleGenerateArt = async () => {
    setIsGenerating(true);
    soundManager.playSound('sparkle');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: customPrompt || page.illustrationPrompt,
          style: artStyle,
        }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl && onUpdateIllustration) {
        onUpdateIllustration(page.pageNumber, data.imageUrl);
        soundManager.playSound('fanfare');
      } else {
        // Fallback: visual style toggle
        soundManager.playSound('chime');
      }
    } catch {
      soundManager.playSound('chime');
    } finally {
      setIsGenerating(false);
      setShowStylePicker(false);
    }
  };

  return (
    <div className="relative w-full h-[320px] md:h-[420px] rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-200/80 bg-slate-900 select-none group">
      {/* Background Graphic: Either AI Image or Procedural Scenic Canvas */}
      {page.illustrationUrl ? (
        <div className="relative w-full h-full">
          <img
            src={page.illustrationUrl}
            alt={page.illustrationPrompt}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
        </div>
      ) : (
        <div
          className="relative w-full h-full flex flex-col justify-between overflow-hidden"
          style={{
            background: `linear-gradient(to bottom, ${sceneVisuals.skyGradient[0]}, ${sceneVisuals.skyGradient[1]})`,
          }}
        >
          {/* Animated Sky / Stars / Atmosphere */}
          {sceneVisuals.starsOrParticles && (
            <div className="absolute inset-0 pointer-events-none opacity-80">
              {[...Array(18)].map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-white rounded-full animate-pulse"
                  style={{
                    width: `${(i % 3) + 2}px`,
                    height: `${(i % 3) + 2}px`,
                    top: `${(i * 19) % 75}%`,
                    left: `${(i * 37) % 95}%`,
                    animationDelay: `${(i * 0.4) % 2.5}s`,
                    animationDuration: `${1.5 + (i % 2)}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Sun / Moon or Cosmic Body */}
          <div className="absolute top-6 right-10 pointer-events-none">
            {sceneVisuals.themeStyle === 'night' ? (
              <div className="w-16 h-16 rounded-full bg-amber-100 shadow-[0_0_35px_rgba(254,243,199,0.7)] flex items-center justify-center text-3xl">
                🌙
              </div>
            ) : sceneVisuals.themeStyle === 'cosmic' ? (
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-300 shadow-[0_0_40px_rgba(168,85,247,0.6)] flex items-center justify-center text-4xl">
                🪐
              </div>
            ) : sceneVisuals.themeStyle === 'sunset' ? (
              <div className="w-20 h-20 rounded-full bg-gradient-to-b from-amber-200 to-orange-400 shadow-[0_0_45px_rgba(251,146,60,0.8)]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-yellow-300 shadow-[0_0_30px_rgba(253,224,71,0.8)] flex items-center justify-center text-3xl">
                ☀️
              </div>
            )}
          </div>

          {/* Mountain / Hills Silhouette Backdrop */}
          <div className="absolute bottom-16 inset-x-0 h-32 pointer-events-none opacity-40">
            <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-emerald-950">
              <path d="M0,80 Q120,20 250,70 T500,40 L500,150 L0,150 Z" />
            </svg>
          </div>

          {/* Foreground Rolling Hills */}
          <div
            className="absolute bottom-0 inset-x-0 h-24 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center top, ${sceneVisuals.groundColor}, #022c22)`,
              borderRadius: '60% 60% 0 0 / 25px 25px 0 0',
            }}
          />

          {/* Central Illustrated Hero representation */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center transform -translate-y-4">
              <div className="text-7xl md:text-8xl filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] animate-bounce" style={{ animationDuration: '3s' }}>
                {page.pageNumber === 1 ? '🐲' : page.pageNumber === 2 ? '🦉' : page.pageNumber === 3 ? '🦔' : '✨'}
              </div>
              <div className="mt-3 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-xs text-white/90 text-xs md:text-sm font-medium border border-white/20 inline-block shadow-lg">
                Page {page.pageNumber} • {storyTitle}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Touch Hotspots for Kids */}
      <div className="absolute inset-0 pointer-events-none">
        {hotspots.map((h) => {
          const isActive = activeHotspot === h.id;
          return (
            <button
              key={h.id}
              onClick={() => handleHotspotClick(h)}
              title={h.label}
              className={`absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 p-2 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-125 focus:outline-hidden ${
                isActive ? 'scale-150 rotate-12 bg-amber-400/80 shadow-2xl ring-4 ring-white' : 'hover:bg-white/20'
              }`}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
              aria-label={`Interactive ${h.label}`}
            >
              <span className="text-3xl md:text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] block">
                {h.emoji}
              </span>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/75 text-amber-200 text-[11px] font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {h.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Art Generation Controls (Top Bar) */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
        <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 shadow-md">
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span>Illustration for Page {page.pageNumber}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStylePicker(!showStylePicker)}
            className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer"
            title="Generate custom AI illustration for this page"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{page.illustrationUrl ? 'New Art' : 'Paint with AI'}</span>
          </button>
        </div>
      </div>

      {/* Style & Prompt Tuning Popover */}
      {showStylePicker && (
        <div className="absolute top-14 right-3 z-30 w-72 bg-amber-950/95 border-2 border-amber-400/80 rounded-2xl p-3.5 shadow-2xl text-white text-xs">
          <div className="flex items-center justify-between font-bold text-amber-300 mb-2">
            <span>✨ Magic Art Studio</span>
            <button
              onClick={() => setShowStylePicker(false)}
              className="text-white/60 hover:text-white text-base leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <label className="block text-[11px] text-amber-200/80 mb-1">Illustration Style</label>
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {(['storybook', 'watercolor', '3d-render'] as const).map((style) => (
              <button
                key={style}
                onClick={() => setArtStyle(style)}
                className={`py-1 px-1.5 rounded-lg text-center font-medium capitalize border cursor-pointer ${
                  artStyle === style
                    ? 'bg-amber-400 text-amber-950 border-amber-300 font-bold'
                    : 'bg-black/30 border-white/10 text-white/80 hover:bg-white/10'
                }`}
              >
                {style === '3d-render' ? '3D Cute' : style}
              </button>
            ))}
          </div>

          <label className="block text-[11px] text-amber-200/80 mb-1">Scene Description</label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full bg-black/40 border border-amber-300/40 rounded-lg p-2 text-white text-xs mb-2.5 focus:ring-1 focus:ring-amber-400 focus:outline-hidden"
            placeholder="e.g. Glowing twilight forest with baby dragon"
          />

          <button
            onClick={handleGenerateArt}
            disabled={isGenerating}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Weaving Painting...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generate Illustration</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Interactive Helper Pill on Bottom Left */}
      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-xs text-amber-200 text-[10px] font-medium pointer-events-none">
        👆 Tap characters & items to play sounds!
      </div>
    </div>
  );
};
