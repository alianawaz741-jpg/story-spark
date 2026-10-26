import React, { useState } from 'react';
import { Story } from '../types/index.ts';
import { soundManager } from '../utils/audioSynth.ts';
import { Sparkles, ArrowLeft, Wand2, Loader2 } from 'lucide-react';

interface StoryCreatorProps {
  onStoryCreated: (story: Story) => void;
  onCancel: () => void;
}

const HEROES = [
  { name: 'Ember', species: 'Baby Dragon', emoji: '🐲', desc: 'Sneezes sparkle bubbles' },
  { name: 'Luna', species: 'Astronaut Bunny', emoji: '🐰', desc: 'Explores outer space' },
  { name: 'Pip', species: 'Curious Fox', emoji: '🦊', desc: 'Loves nature puzzles' },
  { name: 'Barnaby', species: 'Gentle Bear', emoji: '🐻', desc: 'Master of honey picnics' },
  { name: 'Beep', species: 'Friendly Robot', emoji: '🤖', desc: 'Builds cozy gadgets' },
  { name: 'Twinkle', species: 'Starlight Unicorn', emoji: '🦄', desc: 'Paints twilight rainbows' },
];

const SETTINGS = [
  { id: 'forest', name: 'Whispering Forest', emoji: '🌲', prompt: 'an enchanted forest with singing trees and glowing moss' },
  { id: 'space', name: 'Cosmic Starfield', emoji: '🪐', prompt: 'Saturn rings and candy asteroids floating in colorful space' },
  { id: 'candy', name: 'Candy Cloud Kingdom', emoji: '🍬', prompt: 'fluffy marshmallow clouds and rainbow lollipop bridges' },
  { id: 'ocean', name: 'Coral Castle', emoji: '🌊', prompt: 'a sunlit shallow turquoise sea with playful sea turtles' },
  { id: 'crystal', name: 'Crystal Caves', emoji: '💎', prompt: 'glowing amethyst caves with gentle chiming stalactites' },
];

const THEMES = [
  { id: 'kindness', name: 'Kindness & Warmth', emoji: '💖' },
  { id: 'courage', name: 'Courage & Trying New Things', emoji: '🦁' },
  { id: 'curiosity', name: 'Curiosity & Science', emoji: '🔍' },
  { id: 'teamwork', name: 'Friendship & Teamwork', emoji: '🤝' },
  { id: 'bedtime', name: 'Calm Bedtime Dreams', emoji: '🌙' },
];

export const StoryCreator: React.FC<StoryCreatorProps> = ({ onStoryCreated, onCancel }) => {
  const [selectedHero, setSelectedHero] = useState(HEROES[0]);
  const [customHeroName, setCustomHeroName] = useState('');
  const [selectedSetting, setSelectedSetting] = useState(SETTINGS[0]);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [ageGroup, setAgeGroup] = useState<'3-5' | '6-8' | '9-12'>('6-8');
  const [customIdea, setCustomIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateStory = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    soundManager.playSound('sparkle');

    try {
      const heroData = {
        name: customHeroName.trim() || selectedHero.name,
        species: selectedHero.species,
        avatarEmoji: selectedHero.emoji,
      };

      const res = await fetch('/api/stories/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hero: heroData,
          setting: selectedSetting.prompt,
          theme: selectedTheme.name,
          ageGroup,
          topic: customIdea || `${heroData.name} in ${selectedSetting.name}`,
          pageCount: 4,
        }),
      });

      const data = await res.json();
      if (data.success && data.story) {
        soundManager.playSound('fanfare');
        onStoryCreated(data.story);
      } else {
        throw new Error(data.error || 'Failed to create story');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Could not weave your story. Please try again!');
      soundManager.playSound('bump');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100 text-stone-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100 text-amber-900 font-bold text-xs md:text-sm border border-amber-200 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-xl md:text-2xl font-extrabold text-amber-950 font-serif">
              Weave a New Story
            </h1>
          </div>
          <div className="w-16" />
        </div>

        {/* Wizard Form */}
        <div className="bg-white/90 backdrop-blur-md border-2 border-amber-200 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {/* Step 1: Pick Hero */}
          <div>
            <label className="block text-sm md:text-base font-extrabold text-amber-950 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                1
              </span>
              <span>Choose Your Hero Character</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {HEROES.map((hero) => {
                const isSelected = selectedHero.name === hero.name;
                return (
                  <button
                    key={hero.name}
                    type="button"
                    onClick={() => {
                      setSelectedHero(hero);
                      soundManager.playSound('boing');
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-300 shadow-md'
                        : 'bg-stone-50 border-stone-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="text-3xl mb-1">{hero.emoji}</div>
                    <div className="font-extrabold text-sm text-stone-900">{hero.name}</div>
                    <div className="text-xs text-stone-500 truncate">{hero.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Optional Custom Hero Name */}
            <div className="mt-3">
              <input
                type="text"
                placeholder={`Name your hero (default: ${selectedHero.name})`}
                value={customHeroName}
                onChange={(e) => setCustomHeroName(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-amber-300 bg-amber-50/50 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Step 2: Pick Setting */}
          <div>
            <label className="block text-sm md:text-base font-extrabold text-amber-950 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                2
              </span>
              <span>Pick a Magical World</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SETTINGS.map((setting) => {
                const isSelected = selectedSetting.id === setting.id;
                return (
                  <button
                    key={setting.id}
                    type="button"
                    onClick={() => {
                      setSelectedSetting(setting);
                      soundManager.playSound('chime');
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-300 shadow-md'
                        : 'bg-stone-50 border-stone-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="text-3xl mb-1">{setting.emoji}</div>
                    <div className="font-bold text-sm text-stone-900">{setting.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Pick Theme & Age */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-amber-950 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                  3
                </span>
                <span>Story Moral / Theme</span>
              </label>
              <select
                value={selectedTheme.id}
                onChange={(e) => {
                  const t = THEMES.find((x) => x.id === e.target.value) || THEMES[0];
                  setSelectedTheme(t);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white font-medium text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {THEMES.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.emoji} {theme.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-extrabold text-amber-950 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                  4
                </span>
                <span>Child’s Age Group</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['3-5', '6-8', '9-12'] as const).map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => setAgeGroup(age)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs md:text-sm text-center transition-all cursor-pointer ${
                      ageGroup === age
                        ? 'bg-amber-500 text-amber-950 border-amber-600 shadow-sm'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {age === '3-5' ? 'Toddler (3-5)' : age === '6-8' ? 'Explorer (6-8)' : 'Junior (9-12)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Custom Topic */}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              Any special idea or pet to include? (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Finding a lost glowing key, baking rainbow muffins..."
              value={customIdea}
              onChange={(e) => setCustomIdea(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-red-800 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleCreateStory}
            disabled={isGenerating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 font-extrabold text-base md:text-lg flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-98 cursor-pointer disabled:opacity-50 ring-4 ring-amber-300/40"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Weaving Story & Illustrations...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Create Storybook!</span>
                <Sparkles className="w-4 h-4 text-amber-950" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
