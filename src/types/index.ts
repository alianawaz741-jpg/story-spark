export interface StoryPage {
  id: string;
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
  illustrationUrl?: string; // Generated image data or AI art
  illustrationStyle?: 'watercolor' | 'cartoon' | '3d-render' | 'storybook';
  soundEffect?: string;
  interactiveObjects?: Array<{
    id: string;
    label: string;
    emoji: string;
    x: number; // % 0-100
    y: number; // % 0-100
    sound: string;
    animation: 'bounce' | 'spin' | 'pulse' | 'float';
  }>;
  nextChoices?: Array<{
    label: string;
    promptSnippet: string;
  }>;
}

export interface CharacterProfile {
  name: string;
  species: string;
  avatarEmoji: string;
  personality: string;
}

export interface Story {
  id: string;
  title: string;
  summary: string;
  ageGroup: '3-5' | '6-8' | '9-12';
  theme: string;
  coverEmoji: string;
  coverGradient: [string, string];
  character: CharacterProfile;
  pages: StoryPage[];
  isCustom?: boolean;
  createdAt: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  pitch: number;
  rate: number;
  genderOrPersona: string;
  emoji: string;
}

export interface ReadingSettings {
  voiceId: string;
  speed: number;
  pitch: number;
  autoTurnPage: boolean;
  soundEffectsEnabled: boolean;
  fontSize: 'normal' | 'large' | 'huge';
  karaokeHighlight: boolean;
  bedtimeMode: boolean; // warm tones
}
