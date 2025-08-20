import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import OpenAI from 'openai';
import { generateWorld } from './worldGenerator.js';

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client (v4 SDK)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(bodyParser.json());

// Resolve important directories relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const frontendPath = path.join(__dirname, '..', 'frontend');
const outputsPath  = path.join(__dirname, '..', 'outputs');

// Serve static front-end and generated outputs
app.use(express.static(frontendPath));
app.use('/outputs', express.static(outputsPath));

// Generate species and civilization names
app.post('/api/generate-names', async (req, res) => {
  try {
    const { animal, culture, spice } = req.body;
    const prompt = `Create a unique species and civilization name using ${animal}, ${culture}, and ${spice}. Return them in the format: SpeciesName: <...>, CivilizationName: <...>.`;

    const chat = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You generate creative names.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });

    const text = chat.choices[0].message.content.trim();
    const [speciesLine, civLine] = text.split('\n').map(s => s.trim());
    const speciesName = speciesLine.split(':')[1].trim();
    const civilizationName = civLine.split(':')[1].trim();

    res.json({ speciesName, civilizationName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate names.' });
  }
});

// Generate a preview image
app.post('/api/generate-image', async (req, res) => {
  try {
    const { animal, culture, spice } = req.body;
    const imgPrompt = `An epic portrait of a bipedal anthropomorphic warrior ${animal}, wearing clothing inspired by ${culture}, with hints of ${spice}.`;

    const imageResponse = await openai.images.generate({
      prompt: imgPrompt,
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = imageResponse.data[0].url;
    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Image generation failed.' });
  }
});

// Generate the full world
app.post('/api/generate-world', async (req, res) => {
  try {
    const { animal, culture, spice, speciesName, civilizationName } = req.body;
    const result = await generateWorld({ animal, culture, spice, speciesName, civilizationName });

    const sectionsArray = Object.keys(result.sections).map(title => ({
      title,
      content: result.sections[title],
      imageUrl: `/outputs/${result.folder}/${result.images[title]}`,
    }));

    const pdfUrl = `/outputs/${result.folder}/${result.pdf}`;

    res.json({
      sections: sectionsArray,
      pdfUrl,
      imagesZipUrl: null,
      modelUrl: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'World generation failed.' });
  }
});

// Fallback: serve index.html for unknown routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Advanced Loremaster backend listening on port ${port}.`);
});
