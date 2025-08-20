import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Configuration, OpenAIApi } from 'openai';
import { generateWorld } from './worldGenerator.js';

// Load environment variables
dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// Set up OpenAI configuration for image and naming endpoints
const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

// Resolve frontend path relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Endpoint to generate species and civilization names
app.post('/api/generate-names', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const chatPrompt = `You are the Loremaster's naming assistant. Use the animal ${animal}, the culture ${culture}, and the spice ${spice} to invent a fantasy species name and a civilization name. Return them as JSON with keys speciesName and civilizationName.`;
    const response = await openai.createChatCompletion({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are a creative naming assistant for fantasy species and civilizations.' },
        { role: 'user', content: chatPrompt },
      ],
      temperature: 0.8,
    });
    const text = response.data.choices[0].message.content.trim();
    let names;
    try {
      names = JSON.parse(text);
    } catch (e) {
      const parts = text.split(/\n|,/).map((p) => p.trim()).filter(Boolean);
      names = { speciesName: parts[0] || '', civilizationName: parts[1] || '' };
    }
    res.json(names);
  } catch (error) {
    console.error('Error generating names:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate names' });
  }
});

// Endpoint to generate an image using DALL·E
app.post('/api/generate-image', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const prompt = `An epic portrait Bipedal anthropomorphic warrior ${animal} in ${culture}-inspired clothing with hints of ${spice}.`;
    const imgResponse = await openai.createImage({
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });
    const imageUrl = imgResponse.data.data[0].url;
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error generating image:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate image' });
  }
});

// Endpoint to generate a complete world
app.post('/api/generate-world', async (req, res) => {
  const { animal, culture, spice, speciesName, civilizationName } = req.body;
  try {
    const result = await generateWorld({ animal, culture, spice, speciesName, civilizationName });
    res.json(result);
  } catch (error) {
    console.error('Error generating world:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate world' });
  }
});

// Fallback route to serve the front-end
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Advanced Loremaster backend listening on port ${PORT}`);
});
