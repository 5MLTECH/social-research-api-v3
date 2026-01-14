require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
const PORT = 8080;

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
  console.log("=== /api/research REQUEST RECEIVED ===");

  try {
    const { brand_config, campaign_brief, prompt } = req.body;

    console.log("Incoming Request Body:", JSON.stringify(req.body, null, 2));

    // Determine which config to use
    const finalBrandConfig = prompt
      ? { market: "Hong Kong", industry: "General" }
      : brand_config;

    const finalCampaignBrief = prompt
      ? { objective: prompt, target_audience: "Hong Kong market" }
      : campaign_brief;

    console.log("Using finalBrandConfig:", finalBrandConfig);
    console.log("Using finalCampaignBrief:", finalCampaignBrief);

    if (!finalBrandConfig || !finalCampaignBrief) {
      console.warn("Missing required configurations.");
      return res.status(400).json({ error: "Missing brand_config or campaign_brief" });
    }

    const userMessage = `BRAND CONFIG:
${JSON.stringify(finalBrandConfig, null, 2)}

CAMPAIGN BRIEF:
${JSON.stringify(finalCampaignBrief, null, 2)}

Generate the campaign research result strictly following the JSON schema.`;

    console.log("Constructed User Message:\n", userMessage);

    // Track request duration
    console.time("Claude API Duration");

    const claudeRes = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userMessage }
          ]
        }
      ]
    });

    console.timeEnd("Claude API Duration");

    console.log("Claude Response Object:", JSON.stringify(claudeRes, null, 2));

    const raw = claudeRes?.content?.[0]?.text || "";

    console.log("RAW CLAUDE TEXT RESPONSE:", raw);

    // Sanitize incoming text
    const clean = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    console.log("SANITIZED RESPONSE TEXT:", clean);

    let parsed;

    try {
      parsed = JSON.parse(clean);
      console.log("JSON Parsing Successful.");
    } catch (e) {
      console.error("JSON Parsing Error:", e);
      console.error("Failed JSON:", clean);

      return res.status(502).json({
        error: "Model returned invalid JSON",
        raw: clean
      });
    }

    console.log("=== SUCCESSFULLY RETURNING PARSED JSON ===");
    res.json(parsed);

  } catch (error) {
    console.error("Unhandled Error in /api/research:", error);

    res.status(500).json({
      error: "Internal server error",
      details: error?.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Social Research API is running");
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
