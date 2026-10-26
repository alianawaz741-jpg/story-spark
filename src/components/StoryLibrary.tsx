import React, { useState } from 'react';
import { Story } from '../types/index.ts';
import { soundManager } from '../utils/audioSynth.ts';
import { BookOpen, Sparkles, Wand2, Gamepad2, Volume2, Search, Filter } from 'lucide-react';

interface StoryLibraryProps {
  stories: Story[];
  onSelectStory: (story: Story) => void;
  onCreateNewStory: () => void;
  onOpenGameQuest: () => void;
}

export const StoryLibrary: React.FC<StoryLibraryProps> = ({
  stories,
  onSelectStory,
  onCreateNewStory,
  onOpenGameQuest,
}) => {
  const [filterAge, setFilterAge] = useState<'all' | '3-5' | '6-8' | '9-12'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStories = stories.filter((story) => {
    const matchesAge = filterAge === 'all' || story.ageGroup === filterAge;
    const matchesSearch =
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.character.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAge && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/40 to-amber-100 text-stone-900 pb-16">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-amber-950 px-4 py-8 md:py-12 shadow-md">
        {/* Decorative Floating Emojis */}
        <div className="absolute top-2 left-6 text-4xl opacity-40 animate-pulse pointer-events-none">✨</div>
        <div className="absolute bottom-2 right-8 text-5xl opacity-35 pointer-events-none">🐉</div>
        <div className="absolute top-4 right-1/4 text-3xl opacity-40 pointer-events-none">⭐</div>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/15 text-amber-950 font-bold text-xs uppercase tracking-wider backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Magical Read-Aloud Books & Quest</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight font-serif drop-shadow-xs">
              StorySpark Bookshelf
            </h1>
            <p className="text-amber-950/90 text-sm md:text-base font-medium max-w-lg">
              Listen to stories read aloud with karaoke word highlighting, tap whimsical illustrations, or weave brand new fairy tales!
            </p>
          </div>

          {/* Quick Action Cards */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                soundManager.playSound('sparkle');
                onCreateNewStory();
              }}
              className="px-5 py-3.5 rounded-2xl bg-white hover:bg-amber-50 text-amber-950 font-extrabold text-sm md:text-base flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer ring-4 ring-white/50"
            >
              <Wand2 className="w-5 h-5 text-amber-600" />
              <span>Weave New Story</span>
            </button>

            <button
              onClick={() => {
                soundManager.playSound('fanfare');
                onOpenGameQuest();
              }}
              className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm md:text-base flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer ring-4 ring-purple-300/40"
            >
              <Gamepad2 className="w-5 h-5" />
              <span>Play Story Quest</span>
            </button>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-amber-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Age Filters */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-stone-500 flex items-center gap-1 pl-1 pr-2">
              <Filter className="w-3.5 h-3.5" />
              <span>Age:</span>
            </span>
            {(
              [
                { id: 'all', label: 'All Ages' },
                { id: '3-5', label: 'Toddlers (3-5)' },
                { id: '6-8', label: 'Explorers (6-8)' },
                { id: '9-12', label: 'Juniors (9-12)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterAge(tab.id);
                  soundManager.playSound('boing');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                  filterAge === tab.id
                    ? 'bg-amber-500 text-amber-950 shadow-xs'
                    : 'text-stone-600 hover:bg-amber-100/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search stories, heroes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Story Grid */}
      <main className="max-w-5xl mx-auto px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-extrabold text-amber-950 font-serif flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <span>Storybook Collection ({filteredStories.length})</span>
          </h2>
        </div>

        {filteredStories.length === 0 ? (
          <div className="text-center py-16 bg-white/60 rounded-3xl border border-amber-200">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="font-bold text-stone-700 text-base">No stories match your search</h3>
            <p className="text-stone-500 text-xs mt-1">Try switching the age filter or write a custom tale!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map((story) => (
              <div
                key={story.id}
                onClick={() => {
                  soundManager.playSound('pageFlip');
                  onSelectStory(story);
                }}
                className="group bg-white rounded-3xl border-2 border-amber-200/80 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between"
              >
                {/* Book Cover Header Banner */}
                <div
                  className="h-44 p-4 relative flex flex-col justify-between overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${story.coverGradient[0]}, ${story.coverGradient[1]})`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-xs text-white text-[11px] font-bold border border-white/20">
                      Age {story.ageGroup}
                    </span>
                    {story.isCustom && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase shadow-xs">
                        AI Weaved ✨
                      </span>
                    )}
                  </div>

                  {/* Big Hero Icon Center */}
                  <div className="flex items-center justify-center">
                    <span className="text-6xl filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)] transform group-hover:scale-115 transition-transform duration-300">
                      {story.coverEmoji}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-white/80 text-[11px] font-medium">
                      {story.pages.length} illustrated pages
                    </span>
                  </div>
                </div>

                {/* Book Details Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-base md:text-lg group-hover:text-amber-600 transition-colors line-clamp-1 font-serif">
                      {story.title}
                    </h3>
                    <p className="text-stone-600 text-xs line-clamp-2 mt-1 leading-relaxed">
                      {story.summary}
                    </p>
                  </div>

                  {/* Character & Theme tag */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <div className="flex items-center gap-1.5">
                      <span>{story.character.avatarEmoji}</span>
                      <span className="font-semibold text-stone-700">{story.character.name}</span>
                    </div>
                    <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                      {story.theme}
                    </span>
                  </div>

                  {/* Read Aloud CTA Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundManager.playSound('pageFlip');
                      onSelectStory(story);
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Read Aloud</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
