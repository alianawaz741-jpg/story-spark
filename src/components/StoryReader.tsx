import React, { useState, useEffect, useRef } from 'react';
import { Story, StoryPage, ReadingSettings } from '../types/index.ts';
import { DynamicPageIllustration } from './DynamicPageIllustration.tsx';
import { tokenizeStoryText, findActiveWordIndex } from '../utils/storyEngine.ts';
import { soundManager } from '../utils/audioSynth.ts';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Sparkles,
  BookOpen,
  ArrowRight,
  Sliders,
  Check,
} from 'lucide-react';

interface StoryReaderProps {
  story: Story;
  onBackToLibrary: () => void;
  onOpenGameQuest?: () => void;
  onUpdateStoryPages?: (updatedStory: Story) => void;
}

export const StoryReader: React.FC<StoryReaderProps> = ({
  story,
  onBackToLibrary,
  onOpenGameQuest,
  onUpdateStoryPages,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [isExpandingStory, setIsExpandingStory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [settings, setSettings] = useState<ReadingSettings>({
    voiceId: 'friendly',
    speed: 1.0,
    pitch: 1.1,
    autoTurnPage: true,
    soundEffectsEnabled: true,
    fontSize: 'large',
    karaokeHighlight: true,
    bedtimeMode: false,
  });

  const currentPage: StoryPage = story.pages[currentPageIndex] || story.pages[0];
  const wordTokens = tokenizeStoryText(currentPage.text);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Play page sound effect on page change
  useEffect(() => {
    if (currentPage?.soundEffect && settings.soundEffectsEnabled) {
      soundManager.playSound(currentPage.soundEffect);
    }
  }, [currentPageIndex]);

  // Handle Speech Synthesis
  const stopNarration = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setActiveWordIndex(-1);
  };

  const startNarration = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    stopNarration();

    const utterance = new SpeechSynthesisUtterance(currentPage.text);
    utteranceRef.current = utterance;

    utterance.rate = settings.speed;
    utterance.pitch = settings.pitch;

    // Pick a high-quality, friendly voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Victoria')) &&
        v.lang.startsWith('en')
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    // Word boundary tracking for karaoke highlighting
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const wordIdx = findActiveWordIndex(wordTokens, e.charIndex);
        setActiveWordIndex(wordIdx);
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setActiveWordIndex(-1);

      // Auto turn page if enabled
      if (settings.autoTurnPage && currentPageIndex < story.pages.length - 1) {
        setTimeout(() => {
          goToNextPage();
        }, 1200);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setActiveWordIndex(-1);
    };

    setIsPlaying(true);
    soundManager.playSound('pageFlip');
    window.speechSynthesis.speak(utterance);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopNarration();
    } else {
      startNarration();
    }
  };

  const replayPage = () => {
    stopNarration();
    setTimeout(() => {
      startNarration();
    }, 150);
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      stopNarration();
      soundManager.playSound('pageFlip');
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPageIndex < story.pages.length - 1) {
      stopNarration();
      soundManager.playSound('pageFlip');
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopNarration();
    };
  }, [currentPageIndex, isPlaying, story.pages.length]);

  // Click single word to hear it pronounced
  const handleWordClick = (wordText: string, idx: number) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      stopNarration();
      setActiveWordIndex(idx);
      const singleWordUtterance = new SpeechSynthesisUtterance(wordText);
      singleWordUtterance.rate = 0.85;
      singleWordUtterance.pitch = settings.pitch;
      singleWordUtterance.onend = () => setActiveWordIndex(-1);
      window.speechSynthesis.speak(singleWordUtterance);
    }
  };

  // Update illustration for a page
  const handleUpdateIllustration = (pageNumber: number, imageUrl: string) => {
    if (!onUpdateStoryPages) return;
    const updatedPages = story.pages.map((p) =>
      p.pageNumber === pageNumber ? { ...p, illustrationUrl: imageUrl } : p
    );
    onUpdateStoryPages({
      ...story,
      pages: updatedPages,
    });
  };

  // Story branching choice
  const handleChoosePath = async (choiceSnippet: string) => {
    setIsExpandingStory(true);
    soundManager.playSound('sparkle');
    try {
      const res = await fetch('/api/stories/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyTitle: story.title,
          previousPages: story.pages,
          choiceSnippet,
        }),
      });
      const data = await res.json();
      if (data.success && data.page && onUpdateStoryPages) {
        const nextStory = {
          ...story,
          pages: [...story.pages, data.page],
        };
        onUpdateStoryPages(nextStory);
        setCurrentPageIndex(nextStory.pages.length - 1);
        soundManager.playSound('fanfare');
      }
    } catch {
      soundManager.playSound('bell');
    } finally {
      setIsExpandingStory(false);
    }
  };

  const isBedtime = settings.bedtimeMode;
  const isLastPage = currentPageIndex === story.pages.length - 1;

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-500 ${
        isBedtime
          ? 'bg-gradient-to-b from-slate-950 via-amber-950/30 to-slate-950 text-amber-100'
          : 'bg-gradient-to-b from-amber-50 via-orange-50/50 to-amber-100 text-stone-900'
      }`}
    >
      {/* Top Navigation Header */}
      <header
        className={`w-full border-b backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-20 ${
          isBedtime
            ? 'bg-slate-900/90 border-amber-900/40 text-amber-200'
            : 'bg-white/90 border-amber-200 text-amber-950 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs md:text-sm shadow-xs transition-transform active:scale-95 cursor-pointer"
            aria-label="Back to Bookshelf"
          >
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span>Bookshelf</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xl">{story.coverEmoji}</span>
            <h1 className="font-bold text-sm md:text-base truncate max-w-xs md:max-w-md">
              {story.title}
            </h1>
          </div>
        </div>

        {/* Page progress indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-xs md:text-sm tabular-nums px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
            <span>Page</span>
            <span className="text-amber-600 dark:text-amber-400 font-extrabold">
              {currentPageIndex + 1}
            </span>
            <span>of {story.pages.length}</span>
          </div>

          {/* Bedtime Warm Mode Toggle */}
          <button
            onClick={() => setSettings((s) => ({ ...s, bedtimeMode: !s.bedtimeMode }))}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isBedtime
                ? 'bg-amber-400 text-amber-950 shadow-md ring-2 ring-amber-300'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            }`}
            title={isBedtime ? 'Bedtime warm light ON' : 'Turn on Bedtime Mode'}
            aria-label="Toggle Bedtime Mode"
          >
            {isBedtime ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              const nextMuted = !soundManager.getMuted();
              soundManager.setMuted(nextMuted);
              setSettings((s) => ({ ...s, soundEffectsEnabled: !nextMuted }));
            }}
            className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors cursor-pointer"
            title={settings.soundEffectsEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            aria-label="Toggle Sound Effects"
          >
            {settings.soundEffectsEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-red-500" />
            )}
          </button>

          {/* Reading Voice & Speed Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors cursor-pointer"
            title="Reading Settings"
            aria-label="Reading Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Launch Story Quest Game */}
          {onOpenGameQuest && (
            <button
              onClick={onOpenGameQuest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs md:text-sm shadow-md active:scale-95 transition-all cursor-pointer"
              title="Play Story Quest game"
            >
              <span>🎮</span>
              <span className="hidden sm:inline">Play Quest</span>
            </button>
          )}
        </div>
      </header>

      {/* Settings Modal / Drawer */}
      {showSettings && (
        <div className="max-w-xl mx-auto w-full px-4 pt-3 pb-1 z-10">
          <div
            className={`p-4 rounded-2xl border shadow-xl flex flex-wrap gap-4 items-center justify-between text-xs md:text-sm ${
              isBedtime
                ? 'bg-slate-900 border-amber-900/60 text-amber-100'
                : 'bg-white border-amber-200 text-amber-950'
            }`}
          >
            {/* Speed */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Speed:</span>
              {[0.8, 1.0, 1.2].map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSettings((s) => ({ ...s, speed: sp }))}
                  className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                    settings.speed === sp
                      ? 'bg-amber-500 text-amber-950'
                      : 'bg-black/10 dark:bg-white/10 hover:bg-amber-200/50'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Text Size:</span>
              {(['normal', 'large', 'huge'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setSettings((s) => ({ ...s, fontSize: size }))}
                  className={`px-2 py-1 rounded-lg font-bold capitalize cursor-pointer ${
                    settings.fontSize === size
                      ? 'bg-amber-500 text-amber-950'
                      : 'bg-black/10 dark:bg-white/10 hover:bg-amber-200/50'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Auto Turn Page */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.autoTurnPage}
                onChange={(e) => setSettings((s) => ({ ...s, autoTurnPage: e.target.checked }))}
                className="w-4 h-4 rounded-sm text-amber-600 focus:ring-amber-500"
              />
              <span className="font-medium">Auto-turn page</span>
            </label>
          </div>
        </div>
      )}

      {/* Main Storybook Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 md:py-6 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* Left Column: Visual Illustration with Interactive Hotspots & AI Generation */}
          <div className="w-full flex flex-col items-center">
            <DynamicPageIllustration
              page={currentPage}
              storyTitle={story.title}
              onUpdateIllustration={handleUpdateIllustration}
            />
          </div>

          {/* Right Column: Story Text with Real-Time Karaoke Highlighting */}
          <div className="w-full flex flex-col justify-center">
            <div
              className={`p-6 md:p-8 rounded-3xl border-2 shadow-xl transition-all relative ${
                isBedtime
                  ? 'bg-slate-900/80 border-amber-900/50 text-amber-100 shadow-amber-950/20'
                  : 'bg-white border-amber-200 text-stone-900 shadow-amber-100/50'
              }`}
            >
              {/* Character Speaker Tag */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{story.character.avatarEmoji}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {story.character.name}’s Tale
                </span>
                <span className="text-xs text-stone-400">• Click words to hear them</span>
              </div>

              {/* Story text with word-by-word karaoke highlight */}
              <div
                className={`leading-relaxed tracking-wide font-serif ${
                  settings.fontSize === 'huge'
                    ? 'text-2xl md:text-3xl lg:text-4xl'
                    : settings.fontSize === 'large'
                    ? 'text-xl md:text-2xl lg:text-3xl'
                    : 'text-lg md:text-xl lg:text-2xl'
                }`}
              >
                {wordTokens.map((token, idx) => {
                  const isCurrentWord = activeWordIndex === idx;
                  return (
                    <span
                      key={idx}
                      onClick={() => handleWordClick(token.cleanWord, idx)}
                      className={`inline-block mr-2 my-1 px-1.5 py-0.5 rounded-lg transition-all duration-200 cursor-pointer ${
                        isCurrentWord
                          ? 'bg-amber-300 text-amber-950 font-bold scale-110 shadow-md ring-2 ring-amber-400'
                          : 'hover:bg-amber-100/60 dark:hover:bg-amber-900/40'
                      }`}
                    >
                      {token.word}
                    </span>
                  );
                })}
              </div>

              {/* Page Progress Dots */}
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-amber-200/40 dark:border-amber-900/30">
                {story.pages.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      stopNarration();
                      soundManager.playSound('pageFlip');
                      setCurrentPageIndex(idx);
                    }}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      currentPageIndex === idx
                        ? 'w-8 bg-amber-500 shadow-sm'
                        : 'w-2.5 bg-amber-200 dark:bg-amber-900/50 hover:bg-amber-300'
                    }`}
                    aria-label={`Go to page ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Interactive Story Branching Options (if on last page or page choices exist) */}
            {currentPage.nextChoices && currentPage.nextChoices.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                <p className="text-xs md:text-sm font-bold text-amber-700 dark:text-amber-300 mb-2.5 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>What should {story.character.name} do next?</span>
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {currentPage.nextChoices.map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => handleChoosePath(choice.promptSnippet)}
                      disabled={isExpandingStory}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs md:text-sm shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>{choice.label}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLastPage && (!currentPage.nextChoices || currentPage.nextChoices.length === 0) && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>The End! You finished the whole story! 🎉</span>
                </p>
                <div className="flex items-center justify-center gap-3 mt-2.5">
                  <button
                    onClick={() => {
                      setCurrentPageIndex(0);
                      replayPage();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-500 cursor-pointer"
                  >
                    Read Again
                  </button>
                  {onOpenGameQuest && (
                    <button
                      onClick={onOpenGameQuest}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-sm hover:bg-purple-500 cursor-pointer flex items-center gap-1"
                    >
                      <span>🎮 Play Story Quest</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Audio Player Controls Bar */}
      <footer
        className={`w-full border-t px-4 py-3 sticky bottom-0 z-20 backdrop-blur-md ${
          isBedtime
            ? 'bg-slate-900/90 border-amber-900/40 text-amber-100'
            : 'bg-white/95 border-amber-200 text-stone-900 shadow-lg'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Previous Page Button */}
          <button
            onClick={goToPrevPage}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-2xl font-bold text-xs md:text-sm border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-amber-500/10 border-amber-300/40 hover:bg-amber-500/20 active:scale-95 text-amber-900 dark:text-amber-200"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Center: Main Play/Pause & Replay Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={replayPage}
              className="p-3 rounded-2xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-200 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Replay this page aloud"
              aria-label="Replay page"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlayPause}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 font-extrabold text-base md:text-lg flex items-center gap-2.5 shadow-xl transition-all active:scale-95 cursor-pointer ring-4 ring-amber-300/50"
              aria-label={isPlaying ? 'Pause Story Narration' : 'Read Story Aloud'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-6 h-6 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                  <span>Read to Me</span>
                </>
              )}
            </button>
          </div>

          {/* Next Page Button */}
          <button
            onClick={goToNextPage}
            disabled={currentPageIndex === story.pages.length - 1}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-2xl font-bold text-xs md:text-sm border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-amber-500/10 border-amber-300/40 hover:bg-amber-500/20 active:scale-95 text-amber-900 dark:text-amber-200"
            aria-label="Next Page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
