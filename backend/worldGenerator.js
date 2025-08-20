import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Configuration, OpenAIApi } from 'openai';
import PDFDocument from 'pdfkit';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function fetchImage(prompt) {
  const response = await openai.createImage({
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'url',
  });
  return response.data.data[0].url;
}

async function downloadImage(url, filepath) {
  const response = await axios.get(url, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filepath);
    response.data.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

export async function generateWorld({ animal, culture, spice, speciesName, civilizationName }) {
  const prompts = [
    {
      key: 'foundations',
      template: `You are going to create a civilization of anthropomorphic ${animal} called the ${speciesName} inspired by the ${culture} and the civilization is called ${civilizationName}. Set in a fantasy setting with an earth-like environment but it's not earth. When creating this civilization, sample the earthly environments / biomes that the ${animal} natively lives in and imagine a fitting anthropomorphic civilization to live there that is driven by ${spice}. Accentuate and caricature the animal features and skills, the animal attributes are what make the species special. Never use the same descriptive word more than once per 300 words unless it's thematically necessary. When describing something, use a mix of sensory details and metaphors instead of repeating the same phrasing. Do not write conclusion paragraphs. Reference established ${speciesName} concepts when appropriate.

establish the foundational elements of the civilization, tying them to the ${culture} without directly referencing its real-world equivalent. - Incorporate the following seed information: ${civilizationName}, ${speciesName}, ${spice}, and ${culture}. - Identify five intriguing and distinctive qualities drawn from the ${culture}. - Transform these five qualities into corresponding elements exclusive to ${civilizationName}. - Only include the ${civilizationName} information avoid direct mention of the original ${culture}. - Present these elements under an interesting, thematic title and use Markdown headings or lists to structure your content. - Write in vivid prose—focus on showing details and atmosphere rather than explaining them. - Do not repeat phrasing or examples from previous responses. - Never reference Earthly cultures or animals. - Invent new, culturally relevant names (for people, places, artifacts, or events) in the native language of the ${speciesName}.`,
    },
    {
      key: 'physiology',
      template: `Introduce the anthropomorphic ${animal} species in a way that highlights their unique physical strengths, weaknesses, and attributes, comparing them to humans without referencing real-world animals. - Describe the physical appearance, attributes, and notable features of the anthropomorphic ${animal} species. - Emphasize physical advantages this species has over humans (e.g., heightened senses, specialized limbs, natural abilities, etc.). - Discuss specific traits and abilities, along with any consequences of these differences (think of it as an RPG stat line). - Consider the real physiology of the ${animal} for inspiration, but do not reference the actual animal. - Identify both strengths and weaknesses—no species is perfect. - Use an engaging, show-don’t-tell narrative, formatted in Markdown. - Avoid repetition from earlier descriptions or prompts. - Include unique names for important biological or cultural markers in the ${speciesName} language.`,
    },
    {
      key: 'pantheon',
      template: `Establish the major deities of the civilization, providing each with a thematic domain and personality. Avoid using direct words like “authority,” “harbor,” “purpose,” or “treachery/death,” but capture their essence. - Create a pantheon of at least four primary gods, each embodying a distinct domain. - One god should represent leadership or rulership. - One god should be associated with sanctuary or shelter. - One god should guide life’s meaning or destiny. - One god should embody the darker side or end of life (e.g., betrayal, finality, or endings). - Do not use the explicit words “authority,” “harbor,” “purpose,” or “treachery/death.” Instead, convey these themes creatively. - Write a poem or prayer that worshippers recite, reflecting their reverence for the pantheon. - Maintain vivid, mythic prose, using Markdown headings. - Avoid referencing any earthly religion or culture. - Name each deity, their domains, and any famous holy sites or relics in the native language of the ${speciesName}`,
    },
    {
      key: 'history',
      template: `The current year is 1000. Develop a concise but rich historical arc that shapes the civilization. Highlight pivotal moments that altered the species’ development. - List and summarize eight historical events, from oldest to most recent, that significantly influenced ${speciesName} and ${civilizationName}. Each event should include a date and a brief but dramatic summary. - Show how each event reshaped cultural values, social structure, or political power. - Use engaging prose and Markdown formatting, such as bullet points or subheadings. - Do not repeat previous descriptions or refer to real-world history. - Invent names for key figures and places in the ${speciesName} language`,
    },
    {
      key: 'traditions',
      template: `Show how the species’ beliefs, history, and physiology inform their spiritual and cultural practices. - Reflect on the pantheon, physiology, and historical events described so far. - Summarize six important traditions or rituals practiced by the ${speciesName} that reinforce the core beliefs and cultural values of ${civilizationName}. - Focus on showing the ceremonial elements and the community’s emotional experience. - Avoid repetition from previous responses. - Use creative, ceremonial names for each tradition in the ${speciesName} language. - Write in a compelling, show-don’t-tell style with Markdown structure.`,
    },
    {
      key: 'technologies',
      template: `Integrate technology that aligns with the species’ cultural background, environment, and physiology—avoiding direct modern or human references. - Introduce six original technologies pioneered by the ${speciesName}. - Each should relate to: - The native environment of the ${culture}. - The advantages and weaknesses of the ${speciesName} physiology. - The significance of ${spice} in daily life or advanced uses. - Place them in a fantasy setting without magic, relying on the ${speciesName} natural capabilities and resourcefulness. - Technologies should fit within a fantasy genre that does not use magic, but relies on the advantages of the animal aspects of the ${animal}. - Briefly explain how each invention changed or influenced the civilization’s development. - Avoid referencing human or real-world technology directly; instead, adapt or rename possible parallels. - Name the technologies using the ${speciesName} language, and incorporate the relevant historical context. - Use Markdown for organization and maintain engaging, creative prose.`,
    },
    {
      key: 'tactics',
      template: `Detail how the species’ physical traits shape their tactics, preferred weapons, and organizational strategy. - Describe the close-combat fighting style(s) favored by the ${speciesName}. - Detail their preferred weapons, inspired by their physiology (e.g., sharper senses, unusual limbs). - Outline squad-based tactics and strategic-level combat approaches, referencing the species’ unique advantages. - Include historical examples of famed battles or skirmishes from ${civilizationName}. - Use creative language for weapon and technique names in the ${speciesName} tongue. - Maintain a dramatic, narrative tone in Markdown format. - Avoid repeating previous information or referencing real-world combat styles.`,
    },
  ];

  const sections = {};
  for (const p of prompts) {
    const messages = [
      { role: 'system', content: 'You are a creative world-building assistant for fantasy species and civilizations.' },
      { role: 'user', content: p.template },
    ];
    const completion = await openai.createChatCompletion({
      model: 'gpt-4-turbo',
      messages,
      temperature: 0.8,
    });
    sections[p.key] = completion.data.choices[0].message.content.trim();
  }

  // Prepare output folder
  const sanitizedName = `${speciesName.replace(/\s+/g, '_')}_${civilizationName.replace(/\s+/g, '_')}`;
  const baseDir = path.join('outputs', sanitizedName);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const images = {};
  for (const p of prompts) {
    try {
      const prompt = `An epic portrait Bipedal anthropomorphic warrior ${animal} in ${culture}-inspired clothing with hints of ${spice}. Context: ${p.key}.`;
      const url = await fetchImage(prompt);
      const fileName = `${p.key}.png`;
      const imgPath = path.join(baseDir, fileName);
      await downloadImage(url, imgPath);
      images[p.key] = imgPath;
    } catch (e) {
      console.error('Error generating or downloading image for', p.key, e);
    }
  }

  const pdfPath = path.join(baseDir, `${sanitizedName}.pdf`);
  const doc = new PDFDocument({ autoFirstPage: false });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);
  for (const p of prompts) {
    doc.addPage();
    doc.fontSize(20).fillColor('blue').text(p.key.toUpperCase(), { underline: true });
    doc.moveDown();
    const img = images[p.key];
    if (img && fs.existsSync(img)) {
      doc.image(img, { fit: [500, 300], align: 'center' });
      doc.moveDown();
    }
    doc.fontSize(12).fillColor('black').text(sections[p.key], { align: 'left' });
  }
  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  return { sections, images, pdf: pdfPath };
}
