import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK on server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Story Generation Endpoint using gemini-3.8-flash
 */
app.post('/api/stories/generate', async (req: Request, res: Response) => {
  const { topic, hero, setting, theme, ageGroup, pageCount = 4 } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `Write an enchanting, heartwarming, child-friendly story for age group ${ageGroup || '6-8'}.
Topic/Idea: "${topic || 'A magical adventure'}"
Hero Character: ${hero?.name ? `${hero.name} the ${hero.species}` : 'A lovable curious animal hero'}
Setting: ${setting || 'a whimsical magical realm'}
Moral/Theme: ${theme || 'Friendship and discovery'}
Total Pages: exactly ${pageCount} pages.

For each page:
1. Provide gentle, rhythmically pleasing, engaging text suitable for reading aloud (35-65 words per page).
2. Provide a vivid, detailed illustration prompt describing the visual scene, characters, colors, and lighting.
3. Provide a list of 2-3 interactive objects in the scene with labels and emojis.
4. Provide a sound effect keyword (e.g., sparkle, chime, boing, woosh, bubblePop, fanfare).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an acclaimed children book author and master storyteller. Your stories are playful, wholesome, educational, and vivid.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Catchy, delightful story title' },
            summary: { type: Type.STRING, description: '1-sentence exciting hook' },
            coverEmoji: { type: Type.STRING, description: 'Single emoji representing the book' },
            character: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                species: { type: Type.STRING },
                avatarEmoji: { type: Type.STRING },
                personality: { type: Type.STRING },
              },
              required: ['name', 'species', 'avatarEmoji'],
            },
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER },
                  text: { type: Type.STRING, description: 'Story text for this page' },
                  illustrationPrompt: { type: Type.STRING, description: 'Art prompt for page illustration' },
                  soundEffect: { type: Type.STRING, description: 'Sound cue e.g. sparkle, chime, boing, fanfare' },
                  interactiveObjects: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        emoji: { type: Type.STRING },
                        x: { type: Type.NUMBER, description: 'Percentage 10 to 90' },
                        y: { type: Type.NUMBER, description: 'Percentage 10 to 90' },
                        sound: { type: Type.STRING },
                        animation: { type: Type.STRING, description: 'bounce, pulse, float, or spin' },
                      },
                      required: ['id', 'label', 'emoji', 'x', 'y', 'sound', 'animation'],
                    },
                  },
                },
                required: ['pageNumber', 'text', 'illustrationPrompt', 'interactiveObjects'],
              },
            },
          },
          required: ['title', 'summary', 'character', 'pages'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    // Ensure unique IDs
    const storyId = 'custom-' + Date.now();
    const formattedStory = {
      id: storyId,
      title: parsed.title || 'The Wonder Tale',
      summary: parsed.summary || 'A magical adventure crafted just for you.',
      ageGroup: ageGroup || '6-8',
      theme: theme || 'Wonder',
      coverEmoji: parsed.coverEmoji || '✨',
      coverGradient: ['#3b82f6', '#8b5cf6'],
      character: parsed.character || {
        name: hero?.name || 'Sunny',
        species: hero?.species || 'Star Pup',
        avatarEmoji: '🐾',
        personality: 'Brave and bright',
      },
      createdAt: Date.now(),
      isCustom: true,
      pages: (parsed.pages || []).map((p: any, idx: number) => ({
        id: `${storyId}-p${idx + 1}`,
        pageNumber: idx + 1,
        text: p.text,
        illustrationPrompt: p.illustrationPrompt,
        soundEffect: p.soundEffect || 'chime',
        interactiveObjects: p.interactiveObjects || [],
      })),
    };

    return res.json({ success: true, story: formattedStory });
  } catch (err: any) {
    console.error('Error in /api/stories/generate:', err);
    // Graceful fallback story so app never breaks if API key is unconfigured or rate limited
    const fallbackStory = {
      id: 'custom-' + Date.now(),
      title: topic ? `The Tale of ${topic}` : 'The Magic Star Journey',
      summary: 'A whimsical adventure with friends, joy, and discoveries.',
      ageGroup: ageGroup || '6-8',
      theme: theme || 'Adventure',
      coverEmoji: '🌟',
      coverGradient: ['#ec4899', '#8b5cf6'],
      character: {
        name: hero?.name || 'Pip',
        species: hero?.species || 'Curious Fox',
        avatarEmoji: '🦊',
        personality: 'Gentle, curious, and fast',
      },
      createdAt: Date.now(),
      isCustom: true,
      pages: [
        {
          id: 'fb-p1',
          pageNumber: 1,
          text: `Once upon a sunny morning in ${setting || 'a bright meadow'}, ${hero?.name || 'Pip'} spotted a sparkling footprint shimmering with stardust upon the emerald grass.`,
          illustrationPrompt: `Cute ${hero?.species || 'fox'} finding glowing golden footprints on a lush meadow with wildflowers under blue sky`,
          soundEffect: 'sparkle',
          interactiveObjects: [
            { id: 'f1', label: 'Magic Footprint', emoji: '✨', x: 40, y: 70, sound: 'sparkle', animation: 'pulse' },
            { id: 'f2', label: 'Little Fox', emoji: '🦊', x: 25, y: 55, sound: 'boing', animation: 'bounce' },
          ],
        },
        {
          id: 'fb-p2',
          pageNumber: 2,
          text: `Following the glowing trail past rainbow mushrooms, ${hero?.name || 'Pip'} discovered a friendly silver fairy singing a cheerful lullaby to waking butterflies.`,
          illustrationPrompt: `Small shining fairy with glowing wings singing near giant pastel mushrooms surrounded by dancing butterflies`,
          soundEffect: 'chime',
          interactiveObjects: [
            { id: 'f3', label: 'Silver Fairy', emoji: '🧚', x: 65, y: 35, sound: 'chime', animation: 'float' },
            { id: 'f4', label: 'Butterfly', emoji: '🦋', x: 30, y: 25, sound: 'sparkle', animation: 'bounce' },
          ],
        },
        {
          id: 'fb-p3',
          pageNumber: 3,
          text: `"Welcome to our secret kingdom!" smiled the fairy. Together, they held paws and shared a warm song that made flowers bloom in dazzling neon colors all around!`,
          illustrationPrompt: `Whimsical celebration of glowing blooms and sparkling fireworks under a pastel twilight sky with happy friends`,
          soundEffect: 'fanfare',
          interactiveObjects: [
            { id: 'f5', label: 'Glowing Flower', emoji: '🌺', x: 50, y: 75, sound: 'warmChime', animation: 'pulse' },
            { id: 'f6', label: 'Celebration Spark', emoji: '🎆', x: 75, y: 20, sound: 'fanfare', animation: 'float' },
          ],
        },
      ],
    };

    return res.json({ success: true, story: fallbackStory, note: 'Used fallback story generator' });
  }
});

/**
 * Generate Next Page / Branching Choice Endpoint
 */
app.post('/api/stories/continue', async (req: Request, res: Response) => {
  const { storyTitle, previousPages, choiceSnippet } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY missing');
    }

    const lastPage = previousPages?.[previousPages.length - 1];
    const prompt = `Story so far:
Title: ${storyTitle}
Previous text: "${lastPage?.text || ''}"
The child chose: "${choiceSnippet}".

Write the NEXT page of this story (page ${ (previousPages?.length || 1) + 1 }).
Text should be 35-55 words, joyful, child-friendly.
Also provide:
- illustrationPrompt
- 2 interactive objects with emojis and positions
- soundEffect`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            illustrationPrompt: { type: Type.STRING },
            soundEffect: { type: Type.STRING },
            interactiveObjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  emoji: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  sound: { type: Type.STRING },
                  animation: { type: Type.STRING },
                },
                required: ['id', 'label', 'emoji', 'x', 'y', 'sound', 'animation'],
              },
            },
          },
          required: ['text', 'illustrationPrompt', 'interactiveObjects'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const newPage = {
      id: `p-${Date.now()}`,
      pageNumber: (previousPages?.length || 1) + 1,
      text: parsed.text || `And so the adventure took a wondrous turn towards ${choiceSnippet}!`,
      illustrationPrompt: parsed.illustrationPrompt || `Illustration of ${choiceSnippet}`,
      soundEffect: parsed.soundEffect || 'sparkle',
      interactiveObjects: parsed.interactiveObjects || [],
    };

    return res.json({ success: true, page: newPage });
  } catch (err: any) {
    console.error('Error in /api/stories/continue:', err);
    const newPage = {
      id: `p-${Date.now()}`,
      pageNumber: (previousPages?.length || 1) + 1,
      text: `With a joyful cheer, they followed the path of ${choiceSnippet}, discovering sweet berry treats and friendly birds along the way!`,
      illustrationPrompt: `Vibrant scene of friends journeying towards ${choiceSnippet}`,
      soundEffect: 'fanfare',
      interactiveObjects: [
        { id: 'gen-1', label: 'Magic Path', emoji: '✨', x: 50, y: 60, sound: 'sparkle', animation: 'pulse' },
      ],
    };
    return res.json({ success: true, page: newPage });
  }
});

/**
 * Image Generation Endpoint using gemini-3.1-flash-lite-image or SVG descriptor
 */
app.post('/api/generate-image', async (req: Request, res: Response) => {
  const { prompt, style = 'storybook' } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY missing');
    }

    const enhancedPrompt = `A warm, charming children's storybook illustration in ${style} art style. ${prompt}. High quality, vibrant gentle colors, expressive characters, no text, no watermarks, whimsical lighting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: enhancedPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: '4:3',
        },
      },
    });

    let imageUrl: string | null = null;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (imageUrl) {
      return res.json({ success: true, imageUrl });
    }
    throw new Error('No image returned from Gemini');
  } catch (err: any) {
    // Return gracefully with status flag so the client renders dynamic rich SVG/Canvas illustration
    return res.json({
      success: false,
      error: err.message || 'Image generation unavailable',
      fallback: true,
    });
  }
});

/**
 * Server-side TTS endpoint using gemini-3.8-flash-lite-tts
 */
app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, voiceName = 'Kore' } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ success: false, error: 'GEMINI_API_KEY missing' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: 'Gentle, expressive, warm storyteller for children with clear pauses',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({ success: true, audioData: `data:audio/wav;base64,${base64Audio}` });
    }
    return res.status(500).json({ success: false, error: 'No audio returned' });
  } catch (err: any) {
    console.error('Error in /api/tts:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`StorySpark server listening on http://localhost:${PORT}`);
  });
}

startServer();
