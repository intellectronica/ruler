const { stringify: stringifyIarna } = require('@iarna/toml');
const TOML = require('toml');

// Test different approaches to get inline arrays vs table arrays
const testData = {
  mcp: {
    stdio_servers: [
      {name: "test", command: "echo", args: ["hello"], env: {DEBUG: "true"}}
    ],
    sse_servers: [],
    shttp_servers: [
      {url: "http://example.com"}, 
      {url: "https://api.example.com", api_key: "key123"}
    ]
  }
};

console.log("=== @iarna/toml output ===");
console.log(stringifyIarna(testData));

console.log("\n=== toml library doesn't have stringify, only parse ===");
// Note: The 'toml' library is a parser, not a stringifier

// Test manual construction
console.log("\n=== Manual TOML construction ===");
const manualToml = `[mcp]
stdio_servers = [
  {name="test", command="echo", args=["hello"], env={DEBUG="true"}}
]
sse_servers = []
shttp_servers = [
  "http://example.com",
  {url="https://api.example.com", api_key="key123"}
]`;
console.log(manualToml);

console.log("\n=== Test manual TOML parsing ===");
try {
  const parsed = TOML.parse(manualToml);
  console.log("Parsed successfully:", JSON.stringify(parsed, null, 2));
} catch(e) {
  console.log("Parse error:", e.message);
}