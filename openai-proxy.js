const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = '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' // Your secret key

app.post('/openai', async (req, res) => {
  const { prompt, max_tokens = 400 } = req.body;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens,
      temperature: 0.8
    })
  });
  const data = await response.json();
  res.json(data);
});

app.listen(3001, () => console.log('OpenAI proxy running on port 3001'));
