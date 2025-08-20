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

// Set up OpenAI configuration for name and image generation
const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '..', 'frontend');
const outputsPath = path.join(__dirname, '..', 'outputs');

// Serve static directories
app.use(express.static(frontendPath));
app.use('/outputs', express.static(outputsPath));

// Endpoint to generate species and civilization names
app.post('/api/generate-names', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const chatPrompt = `You are the Loremaster's naming assistant. Use the animal ${animal}, the culture ${culture}, and the spice ${spice} to create a species and civilization name. Return as JSON: {"speciesName":"..","civilizationName":".."} without any explanation.`;
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
    } catch {
      const parts = text.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
      names = { speciesName: parts[0] || '', civilizationName: parts[1] || '' };
    }
    res.json(names);
  } catch (error) {
    console.error('Error generating names:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate names' });
  }
});

// Endpoint to generate an image via DALL-E
app.post('/api/generate-image', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const prompt = `An epic portrait of a bipedal anthropomorphic warrior ${animal} in clothing inspired by ${culture}, with hints of ${spice}. Realistic painting, fantasy style.`;
    const imageResponse = await openai.createImage({
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });
    const imageUrl = imageResponse.data.data[0].url;
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error generating image:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate image' });
  }
});

// Endpoint to generate the world
app.post('/api/generate-world', async (req, res) => {
  const { animal, culture, spice, speciesName, civilizationName } = req.body;
  try {
    const result = await generateWorld({ animal, culture, spice, speciesName, civilizationName });
    // Compute sanitized folder name consistent with worldGenerator
    const sanitizedName = `${speciesName}_${civilizationName}`.replace(/[^a-z0-9_-]/gi, '_');
    const sectionsArray = [];
    for (const key of Object.keys(result.sections)) {
      const imageFileName = result.images[key];
      const imageUrl = imageFileName ? `/outputs/${sanitizedName}/${imageFileName}` : null;
      sectionsArray.push({
        title: key,
        content: result.sections[key],
        imageUrl,
      });
    }
    const pdfUrl = `/outputs/${sanitizedName}/${sanitizedName}.pdf`;
    res.json({
      sections: sectionsArray,
      pdfUrl,
      imagesZipUrl: null,
      modelUrl: null,
    });
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
