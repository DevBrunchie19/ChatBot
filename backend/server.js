const express = require('express');
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // serve frontend

const documentsDir = path.join(__dirname, 'data');
let fuse = null;

async function loadDocuments() {
  const entries = [];
  for (const file of fs.readdirSync(documentsDir)) {
    const ext = path.extname(file).toLowerCase();
    const full = path.join(documentsDir, file);
    let text = '';
    try {
      if (ext === '.txt') text = fs.readFileSync(full, 'utf-8');
      else if (ext === '.pdf') {
        const data = fs.readFileSync(full);
        const pdf = await pdfParse(data);
        text = pdf.text;
      } else if (ext === '.docx') {
        const ml = await mammoth.extractRawText({ path: full });
        text = ml.value;
      }
      entries.push({ content: text });
    } catch (e) {
      console.error(`Failed to load ${file}:`, e.message);
    }
  }
  fuse = new Fuse(entries, {
    keys: ['content'],
    threshold: 0.4,
  });
  console.log(`Loaded ${entries.length} documents.`);
}

loadDocuments();

app.post('/ask', (req, res) => {
  const q = (req.body.question || '').toLowerCase();
  if (!q) return res.status(400).json({ error: 'No question' });
  const hits = fuse.search(q).slice(0, 3);
  const result = hits.length
    ? hits.map(r => excerpt(r.item.content, q))
    : ["🤔 I couldn't find anything relevant."];
  res.json({ answer: result });
});

function excerpt(text, q, len = 200) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, len).trim() + '...';
  const start = Math.max(0, i - len / 2);
  return '...' + text.slice(start, start + len).trim() + '...';
}

app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));
