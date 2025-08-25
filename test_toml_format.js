const { stringify } = require('@iarna/toml');

// Test different approaches to get inline arrays vs table arrays
const testData1 = {
  mcp: {
    stdio_servers: [
      {name: "test", command: "echo", args: ["hello"]}
    ]
  }
};

const testData2 = {
  mcp: {
    stdio_servers: [
      {name: "test", command: "echo", args: ["hello"]}
    ]
  }
};

console.log("=== Test 1 (default) ===");
console.log(stringify(testData1));

console.log("\n=== Test 2 (same) ===");
console.log(stringify(testData2));

// Test with options
console.log("\n=== Test 3 (with options) ===");
try {
  console.log(stringify(testData1, {}));
} catch(e) {
  console.log("Error:", e.message);
}