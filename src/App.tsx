import { useState, useEffect } from 'react';
import { Story } from './types/index.ts';
import { DEFAULT_STORIES } from './data/defaultStories.ts';
import { StoryLibrary } from './components/StoryLibrary.tsx';
import { StoryReader } from './components/StoryReader.tsx';
import { StoryCreator } from './components/StoryCreator.tsx';
import { StoryQuestGame } from './game/StoryQuestGame.tsx';

type AppView = 'library' | 'reader' | 'creator' | 'game';

export default function App() {
  const [stories, setStories] = useState<Story[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('storyspark_custom_stories');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return [...DEFAULT_STORIES, ...parsed];
        } catch {
          return DEFAULT_STORIES;
        }
      }
    }
    return DEFAULT_STORIES;
  });

  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('library');
  const [autostartGame, setAutostartGame] = useState(false);

  // Check URL parameters for autostart or game mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('mode') === 'game') {
        setCurrentView('game');
        setAutostartGame(true);
      }
    }
  }, []);

  // Sync state to body dataset when not in game
  useEffect(() => {
    if (currentView !== 'game') {
      document.body.dataset.state = currentView;
    }
  }, [currentView]);

  const handleSelectStory = (story: Story) => {
    setActiveStory(story);
    setCurrentView('reader');
  };

  const handleStoryCreated = (newStory: Story) => {
    const updated = [newStory, ...stories];
    setStories(updated);
    if (typeof window !== 'undefined') {
      const customs = updated.filter((s) => s.isCustom);
      localStorage.setItem('storyspark_custom_stories', JSON.stringify(customs));
    }
    setActiveStory(newStory);
    setCurrentView('reader');
  };

  const handleUpdateStoryPages = (updatedStory: Story) => {
    setActiveStory(updatedStory);
    setStories((prev) =>
      prev.map((s) => (s.id === updatedStory.id ? updatedStory : s))
    );
  };

  if (currentView === 'game') {
    return (
      <StoryQuestGame
        autostart={autostartGame}
        onReturnToStorybook={() => setCurrentView('library')}
      />
    );
  }

  if (currentView === 'creator') {
    return (
      <StoryCreator
        onStoryCreated={handleStoryCreated}
        onCancel={() => setCurrentView('library')}
      />
    );
  }

  if (currentView === 'reader' && activeStory) {
    return (
      <StoryReader
        story={activeStory}
        onBackToLibrary={() => setCurrentView('library')}
        onOpenGameQuest={() => setCurrentView('game')}
        onUpdateStoryPages={handleUpdateStoryPages}
      />
    );
  }

  return (
    <StoryLibrary
      stories={stories}
      onSelectStory={handleSelectStory}
      onCreateNewStory={() => setCurrentView('creator')}
      onOpenGameQuest={() => setCurrentView('game')}
    />
  );
}
