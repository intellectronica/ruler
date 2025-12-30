---
"skiller": patch
---

Add `${VAR}` environment variable expansion in MCP server env config

You can now reference environment variables in your `skiller.toml` env values:

```toml
[mcp_servers.linear]
command = "npx"
args = ["-y", "github:obra/streamlinear"]
env = { LINEAR_API_KEY = "${LINEAR_API_KEY}" }
```

The `${VAR}` syntax is expanded from `process.env` at config load time. Undefined variables are replaced with empty strings.
