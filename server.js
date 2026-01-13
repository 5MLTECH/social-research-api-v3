require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a campaign strategist. Analyze the brand and campaign brief provided, then output a COMPACT research result in JSON format with these exact fields:

{
  "content_directions": [
    {
      "direction_title": "string",
      "rationale": "string",
      "examples": {
        "post": { "caption": "string", "visual_concept": "string" },
        "video": { "hook": "string", "script": "string", "visual_notes": "string" },
        "threads": { "first_thread": "string", "subsequent_threads": ["string", "string"] }
      }
    }
  ],
  "trends": [
    { "trend_name": "string", "relevance": "string" }
  ],
  "competitors": [
    { "name": "string", "approach": "string" }
  ]
}

CONSTRAINTS:
- Exactly 2 content directions
- Maximum 3 trends
- Maximum 3 competitors
- 1 post + 1 video + 1 threads example per direction

Output ONLY valid JSON, no markdown code blocks.`;

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.post('/api/research', async (req, res) => {
  try {
    const { brand_config, campaign_brief, prompt } = req.body;

    let finalBrandConfig = brand_config;
    let finalCampaignBrief = campaign_brief;

    if (prompt) {
      finalBrandConfig = { market: 'Hong Kong', industry: 'General' };
      finalCampaignBrief = { objective: prompt, target_audience: 'Hong Kong market' };
    }

    if (!finalBrandConfig || !finalCampaignBrief) {
      return res.status(400).json({
        error: 'Missing brand_config or campaign_brief in request body'
      });
    }

    const userMessage = `BRAND CONFIG:
${JSON.stringify(finalBrandConfig, null, 2)}
CAMPAIGN BRIEF:
${JSON.stringify(finalCampaignBrief, null, 2)}
Generate the campaign research result.`;

    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    // 假設你要攞第一段文字 content
    const text = message.content?.[0]?.text || '';

    res.json(JSON.parse(text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
