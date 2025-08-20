import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { Configuration, OpenAIApi } from 'openai';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// Configure OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Serve static files from the frontend directory
const frontendPath = path.resolve('./frontend');
app.use(express.static(frontendPath));

/**
 * POST /api/generate-names
 * Takes animal, culture, spice and returns speciesName and civilizationName
 */
app.post('/api/generate-names', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const prompt = `You are the Loremaster's naming assistant. Use the animal ${animal}, the culture ${culture}, and the spice ${spice} to invent a fantasy species name and a civilization name. Return them as JSON with keys speciesName and civilizationName.`;
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
      // fallback: split by newline or comma
      const parts = text.split(/\n|,/).map((p) => p.trim()).filter(Boolean);
      names = { speciesName: parts[0] || '', civilizationName: parts[1] || '' };
    }
    res.json(names);
  } catch (error) {
    console.error('Error generating names:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate names' });
  }
});

/**
 * POST /api/generate-image
 * Generates an image for the species using OpenAI DALL·E.
 * Body must contain animal, culture, spice.
 */
app.post('/api/generate-image', async (req, res) => {
  const { animal, culture, spice } = req.body;
  try {
    const imagePrompt = `An epic portrait of a bipedal anthropomorphic warrior ${animal} in clothing inspired by ${culture}, with hints of ${spice}. Fantasy art, digital painting, high detail.`;
    const imageResponse = await openai.createImage({
      prompt: imagePrompt,
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

/**
 * POST /api/generate-world
 * Generates world-building sections based on provided inputs.
 * Body must contain animal, culture, spice, speciesName, civilizationName.
 */
app.post('/api/generate-world', async (req, res) => {
  const { animal, culture, spice, speciesName, civilizationName } = req.body;
  try {
    // Define an array of prompts for different sections of the world
    const prompts = [
      {
        key: 'foundations',
        template: `You are going to create a civilization of anthropomorphic ${animal} called the ${speciesName} inspired by the ${culture} and the civilization is called ${civilizationName}. Set in a fantasy setting with an earth-like environment but it's not earth. When creating this civilization, sample the earthly environments / biomes that the ${animal} natively lives in and imagine a fitting anthropomorphic civilization to live there that is driven by ${spice}. Accentuate and caricature the animal features and skills, the animal attributes are what make the species special. Never use the same descriptive word more than once per 300 words unless it's thematically necessary. When describing something, use a mix of sensory details and metaphors instead of repeating the same phrasing. Do not write conclusion paragraphs. Reference established ${speciesName} concepts when appropriate.

establish the foundational elements of the civilization, tying them to the ${culture} without directly referencing its real-world equivalent. - Incorporate the following seed information: ${civilizationName}, ${speciesName}, ${spice}, and ${culture}. - Identify five intriguing and distinctive qualities drawn from the ${culture}. - Transform these five qualities into corresponding elements exclusive to ${civilizationName}. - Only include the ${civilizationName} information avoid direct mention of the original ${culture}. - Present these elements under an interesting, thematic title and use Markdown headings or lists to structure your content. - Write in vivid prose—focus on showing details and atmosphere rather than explaining them. - Do not repeat phrasing or examples from previous responses. - Never reference Earthly cultures or animals. - Invent new, culturally relevant names (for people, places, artifacts, or events) in the native language of the ${speciesName}.`,
      },
      {
        key: 'physiology',
        template: `Introduce the anthropomorphic ${animal} species in a way that highlights their unique physical strengths, weaknesses, and attributes, comparing them to humans without referencing real-world animals. - Describe the physical appearance, attributes, and notable features of the anthropomorphic ${animal} species. - Emphasize physical advantages this species has over humans (e.g., heightened senses, specialized limbs, natural abililties, etc.). - Discuss specific traits and abilities, along with any consequences of these differences (think of it as an RPG stat line). - Consider the real physiology of the ${animal} for inspiration, but do not reference the actual animal. - Identify both strengths and weaknesses—no species is perfect. - Use an engaging, show-don’t-tell narrative, formatted in Markdown. - Avoid repetition from earlier descriptions or prompts. - Include unique names for important biological or cultural markers in the ${speciesName} language.`,
      },
      {
        key: 'pantheon',
        template: `Establish the major deities of the civilization, providing each with a thematic domain and personality. Avoid using direct words like \u201cauthority,\u201d \u201charbor,\u201d \u201cpurpose,\u201d or \u201ctreachery/death,\u201d but capture their essence. - Create a pantheon of at least four primary gods, each embodying a distinct domain. - One god should represent leadership or rulership. - One god should be associated with sanctuary or shelter. - One god should guide life’s meaning or destiny. - One god should embody the darker side or end of life (e.g., betrayal, finality, or endings). - Do not use the explicit words \u201cauthority,\u201d \u201charbor,\u201d \u201cpurpose,\u201d or \u201ctreachery/death.\u201d Instead, convey these themes creatively. - Write a poem or prayer that worshippers recite, reflecting their reverence for the pantheon. - Maintain vivid, mythic prose, using Markdown headings. - Avoid referencing any earthly religion or culture. - Name each deity, their domains, and any famous holy sites or relics in the native language of the ${speciesName}.`,
      },
      {
        key: 'history',
        template: `The current year is 1000. Develop a concise but rich historical arc that shapes the civilization. Highlight pivotal moments that altered the species’ development. - List and summarize eight historical events, from oldest to most recent, that significantly influenced ${speciesName} and ${civilizationName}. Each event should include a date and a brief but dramatic summary. - Show how each event reshaped cultural values, social structure, or political power. - Use engaging prose and Markdown formatting, such as bullet points or subheadings. - Do not repeat previous descriptions or refer to real-world history. - Invent names for key figures and places in the ${speciesName} language.`,
      },
    ];

    const sections = {};
    for (const p of prompts) {
      const chatMessages = [
        { role: 'system', content: 'You are a creative world-building assistant for fantasy species and civilizations. Respond in Markdown format.' },
        { role: 'user', content: p.template },
      ];
      const completion = await openai.createChatCompletion({
        model: 'gpt-4-turbo',
        messages: chatMessages,
        temperature: 0.8,
      });
      const content = completion.data.choices[0].message.content.trim();
      sections[p.key] = content;
    }

    // Optionally create a PDF
    const doc = new PDFDocument();
    const pdfChunks = [];
    doc.on('data', (chunk) => pdfChunks.push(chunk));
    doc.on('end', () => {});
    doc.fontSize(20).text(`${civilizationName} - An Illustrated Guide`, { align: 'center' });
    doc.moveDown();
    for (const p of prompts) {
      doc.fontSize(16).fillColor('blue').text(p.key.toUpperCase(), { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('black').text(sections[p.key], { align: 'left' });
      doc.addPage();
    }
    doc.end();
    const pdfBuffer = Buffer.concat(pdfChunks);
    // Save PDF to a file in outputs folder
    const outputsDir = path.resolve('./outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir);
    }
    const pdfPath = path.join(outputsDir, `${speciesName}_${civilizationName}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    res.json({ sections, pdfPath });
  } catch (error) {
    console.error('Error generating world:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to generate world' });
  }
});

// Fallback route to serve index.html for any unknown paths
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loremaster backend listening on port ${PORT}`);
});
