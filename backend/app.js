import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Generate names endpoint
app.post('/api/generate-names', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const prompt = `You are Loremaster's naming assistant. Use the animal ${animal}, the culture ${culture}, and the spice ${spice} to come up with a unique species name and a unique civilization name suitable for a fantasy RPG. Respond with a JSON object containing "speciesName" and "civilizationName".`;
    const chatResponse = await openai.createChatCompletion({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are a creative naming assistant for fantasy species and civilizations.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });
    const text = chatResponse.data.choices[0].message.content.trim();
    let names;
    try {
      names = JSON.parse(text);
    } catch (e) {
      const lines = text.split('\n').filter(Boolean);
      names = { speciesName: lines[0] || '', civilizationName: lines[1] || '' };
    }
    res.json(names);
  } catch (error) {
    console.error('Error generating names:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate names' });
  }
});

// Placeholder for world generation endpoint
app.post('/api/generate-world', async (req, res) => {
  const { animal, culture, spice, speciesName, civilizationName } = req.body;
  // TODO: implement full world generation with multiple prompts
  res.json({ message: 'World generation is not yet implemented.' });
});

// Placeholder for image generation endpoint
app.post('/api/generate-image', async (req, res) => {
  const { animal, culture, spice, speciesName } = req.body;
  // TODO: call Meshy API or another service to create image
  res.json({ imageUrl: null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loremaster backend listening on port ${PORT}`);
});
