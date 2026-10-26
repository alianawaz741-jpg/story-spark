export interface WordToken {
  word: string;
  cleanWord: string;
  charStart: number;
  charEnd: number;
}

export interface SceneVisualComposition {
  skyGradient: [string, string];
  groundColor: string;
  ambientLight: string;
  starsOrParticles: boolean;
  cloudsOrDust: boolean;
  themeStyle: 'day' | 'sunset' | 'night' | 'cosmic' | 'magical';
  interactiveHotspots: Array<{
    id: string;
    label: string;
    emoji: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    sound: string;
  }>;
}

/**
 * Tokenizes text into words with exact character offset boundaries for speech highlight.
 */
export function tokenizeStoryText(text: string): WordToken[] {
  if (!text) return [];
  const tokens: WordToken[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawWord = match[0];
    const cleanWord = rawWord.replace(/[^\w\s'-]/g, '');
    tokens.push({
      word: rawWord,
      cleanWord,
      charStart: match.index,
      charEnd: match.index + rawWord.length,
    });
  }

  return tokens;
}

/**
 * Finds the index of the word currently being read based on speech synthesis character index.
 */
export function findActiveWordIndex(tokens: WordToken[], charIndex: number): number {
  if (!tokens || tokens.length === 0 || charIndex < 0) return -1;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Check if character index falls within the token or just before/adjacent
    if (charIndex >= t.charStart && charIndex <= t.charEnd) {
      return i;
    }
    // If charIndex is between tokens (e.g. on whitespace), associate with the next token
    if (charIndex < t.charStart) {
      return i;
    }
  }

  return tokens.length - 1;
}

/**
 * Estimates reading time in seconds for a given word count and age level.
 */
export function estimateReadingTimeSeconds(
  wordCount: number,
  ageGroup: '3-5' | '6-8' | '9-12' = '6-8'
): number {
  const wpmMap = {
    '3-5': 70,
    '6-8': 100,
    '9-12': 130,
  };
  const wpm = wpmMap[ageGroup] || 100;
  return Math.ceil((wordCount / wpm) * 60);
}

/**
 * Generates visual scene composition configuration from page keywords and prompts.
 */
export function generateSceneVisuals(
  prompt: string,
  pageText: string
): SceneVisualComposition {
  const combined = (prompt + ' ' + pageText).toLowerCase();

  // Night / Bedtime (check bedtime and sleep first)
  if (combined.includes('bedtime') || combined.includes('sleep') || combined.includes('tucked in') || combined.includes('lullaby') || (combined.includes('night') && !combined.includes('spaceship'))) {
    return {
      skyGradient: ['#0f172a', '#1e293b'],
      groundColor: '#090d16',
      ambientLight: '#60a5fa',
      starsOrParticles: true,
      cloudsOrDust: true,
      themeStyle: 'night',
      interactiveHotspots: [
        { id: 'moon-1', label: 'Silver Moon', emoji: '🌙', x: 75, y: 20, sound: 'lullaby' },
        { id: 'owl-1', label: 'Friendly Owl', emoji: '🦉', x: 20, y: 45, sound: 'hoot' },
      ],
    };
  }

  // Cosmic / Space
  if (combined.includes('space') || combined.includes('galaxy') || combined.includes('cosmic') || combined.includes('planet') || combined.includes('nebula') || combined.includes('astronaut')) {
    return {
      skyGradient: ['#0b0d1e', '#231557'],
      groundColor: '#1d1738',
      ambientLight: '#8a7fff',
      starsOrParticles: true,
      cloudsOrDust: false,
      themeStyle: 'cosmic',
      interactiveHotspots: [
        { id: 'star-1', label: 'Twinkling Star', emoji: '✨', x: 25, y: 20, sound: 'chime' },
        { id: 'planet-1', label: 'Mystery Planet', emoji: '🪐', x: 80, y: 30, sound: 'spaceHum' },
        { id: 'comet-1', label: 'Friendly Comet', emoji: '☄️', x: 50, y: 15, sound: 'woosh' },
      ],
    };
  }

  // Magical / Enchanted Forest
  if (combined.includes('forest') || combined.includes('dragon') || combined.includes('fairy') || combined.includes('magic') || combined.includes('tree')) {
    return {
      skyGradient: ['#134e4a', '#065f46'],
      groundColor: '#064e3b',
      ambientLight: '#34d399',
      starsOrParticles: true,
      cloudsOrDust: true,
      themeStyle: 'magical',
      interactiveHotspots: [
        { id: 'mushroom-1', label: 'Singing Mushroom', emoji: '🍄', x: 20, y: 75, sound: 'boing' },
        { id: 'butterfly-1', label: 'Fairy Butterfly', emoji: '🦋', x: 65, y: 35, sound: 'sparkle' },
        { id: 'flower-1', label: 'Glowing Blossom', emoji: '🌸', x: 80, y: 80, sound: 'chime' },
      ],
    };
  }

  // Bright Daytime (Default)
  return {
    skyGradient: ['#60a5fa', '#bae6fd'],
    groundColor: '#22c55e',
    ambientLight: '#fef08a',
    starsOrParticles: false,
    cloudsOrDust: true,
    themeStyle: 'day',
    interactiveHotspots: [
      { id: 'bird-1', label: 'Singing Robin', emoji: '🐦', x: 30, y: 25, sound: 'chirp' },
      { id: 'cloud-1', label: 'Fluffy Cloud', emoji: '☁️', x: 75, y: 18, sound: 'woosh' },
      { id: 'flower-1', label: 'Dancing Daisy', emoji: '🌼', x: 50, y: 82, sound: 'boing' },
    ],
  };
}
