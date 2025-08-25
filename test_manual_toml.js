// Test if we can manually construct TOML strings to get desired format

function buildInlineArray(items) {
  if (items.length === 0) return '[ ]';
  
  const parts = items.map(item => {
    if (typeof item === 'string') {
      return `"${item}"`;
    } else if (typeof item === 'object') {
      // Build inline object
      const props = Object.entries(item).map(([key, value]) => {
        if (Array.isArray(value)) {
          const arrayStr = '[' + value.map(v => `"${v}"`).join(', ') + ']';
          return `${key}=${arrayStr}`;
        } else if (typeof value === 'object' && value !== null) {
          // Nested object
          const nestedProps = Object.entries(value).map(([k, v]) => `${k}="${v}"`).join(', ');
          return `${key}={${nestedProps}}`;
        } else {
          return `${key}="${value}"`;
        }
      }).join(', ');
      return `{${props}}`;
    }
  });
  
  return '[\n  ' + parts.join(',\n  ') + '\n]';
}

// Test data
const stdioServers = [
  {name: "fetch", command: "uvx", args: ["mcp-server-fetch"]},
  {name: "filesystem", command: "npx", args: ["@modelcontextprotocol/server-filesystem", "/"], env: {DEBUG: "true"}}
];

const sseServers = [
  "http://example.com:8080/mcp",
  "http://localhost:8081/sse",
  {url: "https://api.example.com/mcp/sse", api_key: "your-api-key"}
];

console.log("stdio_servers =", buildInlineArray(stdioServers));
console.log("\nsse_servers =", buildInlineArray(sseServers));

// Full TOML
const fullToml = `[mcp]
stdio_servers = ${buildInlineArray(stdioServers)}
sse_servers = ${buildInlineArray(sseServers)}
shttp_servers = [ ]`;

console.log("\n=== Full TOML ===");
console.log(fullToml);

// Test if it parses correctly
const TOML = require('toml');
console.log("\n=== Parse test ===");
try {
  const parsed = TOML.parse(fullToml);
  console.log("Parsed successfully!");
  console.log("stdio_servers:", JSON.stringify(parsed.mcp.stdio_servers, null, 2));
  console.log("sse_servers:", JSON.stringify(parsed.mcp.sse_servers, null, 2));
} catch(e) {
  console.log("Parse error:", e.message);
}