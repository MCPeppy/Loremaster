import fs from 'fs';
import path from 'path';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Initialize the OpenAI client using the new v4 SDK
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate an image via DALLÉ-3.
 * @param {string} prompt
 * @returns {Promise<string>} URL of the generated image
 */
async function fetchImage(prompt) {
  const response = await openai.images.generate({
    prompt,
    n: 1,
    size: '1024x1024',
  });
  return response.data[0].url;
}

/**
 * Download an image from a URL and write it to disk.
 * @param {string} url
 * @param {string} filepath
 */
async function downloadImage(url, filepath) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(filepath, res.data);
}

/**
 * Main entry: build a world based on animal, culture, spice and names.
 * Creates Markdown content, images and a PDF. Returns summary information.
 */
export async function generateWorld({ animal, culture, spice, speciesName, civilizationName }) {
  // Prepare sanitized names for folder paths
  const sanitizedSpecies = speciesName.replace(/\s+/g, '_').toLowerCase();
  const sanitizedCiv = civilizationName.replace(/\s+/g, '_').toLowerCase();
  const folderName = `${sanitizedSpecies}_${sanitizedCiv}`;

  // Resolve paths relative to this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputsDir = path.join(__dirname, '..', 'outputs', folderName);
  fs.mkdirSync(outputsDir, { recursive: true });

  // Compose prompts for each section of the world; adapt tags with user input
  const prompts = [
    {
      title: 'Foundations',
      prompt: `You are going to create a civilization of anthropomorphic ${animal} called the ${speciesName} inspired by the ${culture} and the civilization is called ${civilizationName}. Set in a fantasy setting with an earth-like environment but it's not earth. When creating this civilization, sample the earthly environments / biomes that the ${animal} natively lives in and imagine a fitting anthropomorphic civilization to live there that is driven by ${spice}. Accentuate and caricature the animal features and skills, the animal attributes are what make the species special. Never use the same descriptive word more than once per 300 words unless it's thematically necessary. When describing something, use a mix of sensory details and metaphors instead of repeating the same phrasing. Do not write conclusion paragraphs. Reference established ${speciesName} concepts when appropriate.

establish the foundational elements of the civilization, tying them to the ${culture} without directly referencing its real-world equivalent. - Incorporate the following seed information: ${civilizationName}, ${speciesName}, ${spice}, and ${culture}. - Identify five intriguing and distinctive qualities drawn from the ${culture}. - Transform these five qualities into corresponding elements exclusive to ${civilizationName}. - Only include the ${civilizationName} information avoid direct mention of the original ${culture}. - Present these elements under an interesting, thematic title and use Markdown headings or lists to structure your content. - Write in vivid prose—focus on showing details and atmosphere rather than explaining them. - Do not repeat phrasing or examples from previous responses. - Never reference Earthly cultures or animals. - Invent new, culturally relevant names (for people, places, artifacts, or events) in the native language of the ${speciesName}.`
    },
    {
      title: 'Physiology',
      prompt: `Introduce the anthropomorphic ${animal} species in a way that highlights their unique physical strengths, weaknesses, and attributes, comparing them to humans without referencing real-world animals. - Describe the physical appearance, attributes, and notable features of the anthropomorphic ${animal} species. - Emphasize physical advantages this species has over humans (e.g., heightened senses, specialized limbs, natural abilities, etc.). - Discuss specific traits and abilities, along with any consequences of these differences (think of it as an RPG stat line). - Consider the real physiology of the ${animal} for inspiration, but do not reference the actual animal. - Identify both strengths and weaknesses—no species is perfect. - Use an engaging, show-don’t-tell narrative, formatted in Markdown. - Avoid repetition from earlier descriptions or prompts. - Include unique names for important biological or cultural markers in the ${speciesName} language.`
    },
    {
      title: 'Pantheon',
      prompt: `Establish the major deities of the civilization, providing each with a thematic domain and personality. Avoid using direct words like “authority,” “harbor,” “purpose,” or “treachery/death,” but capture their essence. - Create a pantheon of at least four primary gods, each embodying a distinct domain. - One god should represent leadership or rulership. - One god should be associated with sanctuary or shelter. - One god should guide life’s meaning or destiny. - One god should embody the darker side or end of life (e.g., betrayal, finality, or endings). - Do not use the explicit words “authority,” “harbor,” “purpose,” or “treachery/death.” Instead, convey these themes creatively. - Write a poem or prayer that worshippers recite, reflecting their reverence for the pantheon. - Maintain vivid, mythic prose, using Markdown headings. - Avoid referencing any earthly religion or culture. - Name each deity, their domains, and any famous holy sites or relics in the native language of the ${speciesName}.`
    },
    {
      title: 'History',
      prompt: `The current year is 1000. Develop a concise but rich historical arc that shapes the civilization. Highlight pivotal moments that altered the species’ development. - List and summarize eight historical events, from oldest to most recent, that significantly influenced ${speciesName} and ${civilizationName}. Each event should include a date and a brief but dramatic summary. - Show how each event reshaped cultural values, social structure, or political power. - Use engaging prose and Markdown formatting, such as bullet points or subheadings. - Do not repeat previous descriptions or refer to real-world history. - Invent names for key figures and places in the ${speciesName} language.`
    }
  ];

  const sections = {};
  const images = {};

  // Generate text for each section via ChatGPT
  for (const { title, prompt } of prompts) {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are a world-building assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });
    sections[title] = chat.choices[0].message.content.trim();
  }

  // Generate and download images for each section
  for (const { title } of prompts) {
    const imgPrompt = `An epic portrait of a bipedal anthropomorphic warrior ${animal}, wearing clothing inspired by ${culture}, with hints of ${spice}.`;
    const imageUrl = await fetchImage(imgPrompt);
    const filename = `${title.toLowerCase().replace(/\s+/g, '_')}.png`;
    const filepath = path.join(outputsDir, filename);
    await downloadImage(imageUrl, filepath);
    images[title] = filename;
  }

  // Create a PDF that compiles all sections and images
  const pdfFilename = `${folderName}.pdf`;
  const pdfPath = path.join(outputsDir, pdfFilename);
  const doc = new PDFDocument({ margin: 50 });

  doc.pipe(fs.createWriteStream(pdfPath));
  doc.fontSize(24).text(`${speciesName} of ${civilizationName}`, { align: 'center' }).moveDown();

  for (const { title } of prompts) {
    doc.addPage().fontSize(20).text(title, { underline: true }).moveDown();
    doc.image(path.join(outputsDir, images[title]), { width: 400, align: 'center' }).moveDown();
    doc.fontSize(12).text(sections[title]).moveDown();
  }

  doc.end();

  return {
    sections,
    images,
    pdf: pdfFilename,
    folder: folderName,
  };
}
