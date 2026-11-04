const fs = require('fs');
const readline = require('readline');
async function printStep() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/User/.gemini/antigravity/brain/b26336e3-737d-4025-a574-e4602e4f93ba/.system_generated/logs/transcript_full.jsonl'),
    crlfDelay: Infinity
  });
  for await (const line of rl) {
    if (line.includes('"step_index": 4609') || line.includes('"step_index": 4610') || line.includes('"step_index": 4603') || line.includes('"step_index": 4604')) {
      const obj = JSON.parse(line);
      console.log('=== STEP', obj.step_index, '===');
      if (obj.tool_calls) console.log('Tool calls:', JSON.stringify(obj.tool_calls, null, 2));
      if (obj.content) console.log('Content:', obj.content.slice(0, 500));
    }
  }
}
printStep().catch(console.error);

