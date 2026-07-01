import OpenAI from 'openai';

const moonshotClient = new OpenAI({ 
  baseURL: "https://integrate.api.nvidia.com/v1", 
  apiKey: "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" 
});

async function measureLatency() {
  console.log(`\nTesting moonshotai/kimi-k2.6 JSON mode...`);
  
  try {
    const response = await moonshotClient.chat.completions.create({
      model: "moonshotai/kimi-k2.6",
      messages: [{ role: "user", content: "Say 'Hello' in JSON format { \"msg\": \"Hello\" }." }],
      temperature: 0.1,
      max_tokens: 50,
      stream: false,
      response_format: { type: "json_object" }
    });
    
    console.log(`✅ Success:`, response.choices[0].message.content);
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }
}

measureLatency();
