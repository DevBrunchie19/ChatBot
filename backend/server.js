const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const Fuse = require('fuse.js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const documentsDir = path.join(__dirname, 'data');
let knowledgeBase = [];
let fuse = null;

// Load and parse documents (txt, pdf, docx)
async function loadDocuments() {
  const files = fs.readdirSync(documentsDir);
  const entries = [];

  for (const file of files) {
    const fullPath = path.join(documentsDir, file);
    const ext = path.extname(file).toLowerCase();

    let content = '';
    try {
      if (ext === '.txt') {
        content = fs.readFileSync(fullPath, 'utf-8');
      } else if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(fullPath);
        const pdf = await pdfParse(dataBuffer);
        content = pdf.text;
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: fullPath });
        content = result.value;
      }
    } catch (err) {
      console.error(`⚠️ Could not load ${file}:`, err.message);
    }

    if (content) entries.push({ content });
  }

  knowledgeBase = entries;

  fuse = new Fuse(knowledgeBase, {
    keys: ['content'],
    includeScore: true,
    threshold: 0.4, // adjust for fuzziness
  });

  console.log(`✅ Loaded ${entries.length} documents`);
}

loadDocuments();

app.post('/ask', (req, res) => {
  const question = req.body.question?.toLowerCase() || '';
  if (!question) return res.status(400).json({ error: 'No question provided' });

  const results = fuse.search(question);
  if (!results.length) {
    return res.json({ answer: ["🤔 I couldn't find anything relevant."] });
  }

  const topMatches = results.slice(0, 3).map(r => getExcerpt(r.item.content, question));
  res.json({ answer: topMatches });
});

function getExcerpt(text, term, len = 200) {
  const index = text.toLowerCase().indexOf(term);
  if (index === -1) return text.slice(0, len).trim() + '...';
  const start = Math.max(0, index - len / 2);
  const end = Math.min(text.length, index + len / 2);
  return '...' + text.slice(start, end).trim() + '...';
}

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
