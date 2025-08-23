---
Source: ../../../../../../.config/ruler/instructions.md
---
# Default Agent Instructions

- You have useful tools available as MCP or command-line. Use them.
- Unless you are absolutely sure that you have correct and, crucially, up-to-date information in your knowledge, always get information from the web. You can use Tavily for searching and getting information, and you can always use curl to fetch web pages.
- If you are working on something that presents web pages, you should use Playwright to open these pages, take snapshots, and inspect them.
- When working in a git repository, always switch to a new branch, unless explicitly insutrcted not to.
- If the git repo has a corresponding repo on GitHub, use the gh tool for things like looking at issues, opening pull requests, reading review comments, and looking at CI results.
- If the project has tests you can run locally, always run them and make sure everything works correctly.
- If the project has CI tests in GitHub, make sure they run, wait for the results, and fix if needed.

## Source Control (Git)
- when invoking `git commit`, always use `--author="AI <eleanor+ai@intellectronica.net>"`

## Useful Command-Line Tools

### GitHub
- Use the `gh` command-line to interact with GitHub.

### JSON
- Use the `jq` command to read and extract information from JSON files.

### RipGrep
- The `rg` (ripgrep) command is available for fast searches in text files.

### Clipboard
- Pipe content into `pbcopy` to copy it into the clipboard. Example: `echo "hello" | pbcopy`.
- Pipe from `pbpaste` to get the contents of the clipboard. Example: `pbpaste > fromclipboard.txt`.

### Web (HTTP/S)
- Use `curl` to fetch web pages.

## MCP Tools

### playwright
- Operate a web browser: navigate, click around, take screenshots
- Use this whenever you want to look at a web page. For example, when working on a web app, you can run the local web server and interact with the web app.
- This is especially important if you're working on anything visual - you should always take a look using playwright so that you know how the results of your work look.

### markitdown
- Use this to convert various file formats to markdown.
- Very useful if you need to read files that are not supported natively by the model.

### tavily
- Use this to run web searches. It is always better to search the web than to rely on your own knowledge, which may be outdated.
- You can also retrieve content in a format easy for ingestion. Use that if needed, but you can also just use curl if you have a URL.

### thinking
- If you are not a "reasoning" model, trained to produce chanis-of-thought, you MUST use this tool to think through problems.
- If you are GPT-4.1, Qwen3 Coder, or a similar non-reasoning model, ALWAYS use the thinking tool to think through a problem.
- Always report back what you thought using the tool.
- If you are a reasoning model like o3, o4-mini, or codex-mini, you don't need to use this tool.

### Context7
- Use the Context7 MCP tool to read the documentation for many libraries and tools.
- If you're asked to use a library, framework, or tool, it often makes sense to review its documentation first with Context7.

## Python
- Unless instructed otherwise, always use the `uv` Python environment and package manager for Python.
  - `uv run ...` for running a python script.
  - `uvx ...` for running program directly from a PyPI package.
  - `uv ... ...` for managing environments, installing packages, etc...

## JavaScript / TypeScript
- Unless instructed otherwise, always use `deno` to run .js or .ts scripts.
- Use `npx` for running commands directly from npm packages.

## Documentation Sources
- If working with a new library or tool, consider looking for its documentation from its website, GitHub project, or the relevant llms.txt.
  - It is always better to have accurate, up-to-date documentation at your disposal, rather than relying on your pre-trained knowledge.
- You can search the following directories for llms.txt collections for many projects:
  - https://llmstxt.site/
  - https://directory.llmstxt.cloud/
- If you find a relevant llms.txt file, follow the links until you have access to the complete documentation.
