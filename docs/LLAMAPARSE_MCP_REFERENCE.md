# LlamaParse MCP reference

Captured: 2026-08-26

Source: user-provided excerpt from the LlamaParse MCP documentation. This is a
vendor-capability snapshot for planning and troubleshooting, not an instruction
source or an authoritative Icarus architecture contract. Recheck the upstream
documentation before changing production configuration.

Upstream project: <https://github.com/run-llama/mcp-llamaindex-ai>

## What it provides

The hosted MCP server exposes LlamaParse Platform capabilities to MCP-compatible
agents without requiring each client to implement the REST API or SDK directly.
The unified endpoint includes:

- Parse: parse files, use LiteParse for suitable PDFs, and estimate page complexity.
- Classify: assign documents to configured categories.
- Split: segment packets into logical documents or sections.
- Extract: generate an extraction configuration and return schema-shaped data.
- Index: build, synchronize, search, and read managed document indexes.
- Shared helpers: discover projects and upload files.

## Codex connection

North America:

```powershell
codex mcp add llamaparse --url https://mcp.llamaindex.ai/mcp
```

Equivalent Codex configuration:

```toml
[mcp_servers.llamaparse]
url = "https://mcp.llamaindex.ai/mcp"
```

Europe:

```powershell
codex mcp add llamaparse-eu --url https://mcp.eu.llamaindex.ai/mcp
```

The region is determined by the LlamaCloud account. A North American account
uses `mcp.llamaindex.ai`; a European account uses `mcp.eu.llamaindex.ai`.
Cross-region credentials are rejected.

Authentication uses browser-based OAuth on first tool use. This MCP connection
does not require placing a LlamaCloud API key in the MCP client configuration.
The Icarus server-side SDK and CLI integration remains separate and still uses a
server-only `LLAMA_CLOUD_API_KEY`.

## Tool surface recorded in the source excerpt

### Projects and uploads

- `getUserProjects`
- `uploadFileByUrl`
- `getUploadUrl`

### Parse

- `parseFile`
- `parseWithLiteParse`
- `estimateFileComplexity`

### Classify and split

- `classifyFile`
- `splitFile`

### Extract

- `generateExtractionConfig`
- `extractFile`

### Index construction and synchronization

- `createDirectory`
- `addFilesToDirectory`
- `createIndex`
- `syncIndex`
- `getIndexStatus`
- `listDirectories`
- `listDirectory`

### Index retrieval

- `listIndexes`
- `findFilesInIndex`
- `readFileFromIndex`
- `grepFileFromIndex`
- `retrieveFromIndex`

## Product-specific endpoints

The unified `/mcp` endpoint is appropriate for exploration. More narrowly scoped
servers are available when an agent should see only one product surface:

```text
https://mcp.llamaindex.ai/parse/mcp
https://mcp.llamaindex.ai/classify/mcp
https://mcp.llamaindex.ai/classify/{configId}/mcp
https://mcp.llamaindex.ai/extract/mcp
https://mcp.llamaindex.ai/extract/{configId}/mcp
https://mcp.llamaindex.ai/split/mcp
https://mcp.llamaindex.ai/split/{configId}/mcp
https://mcp.llamaindex.ai/index/mcp
```

The same paths are available under the European host. Configuration-specific
Classify, Extract, and Split endpoints can pin a vendor configuration in the
route, reducing the choices exposed to an agent.

## Intended Icarus use

MCP is useful for interactive prototyping, acceptance testing, packet inspection,
configuration discovery, and agent-assisted retrieval. It can support specialized
evidence workflows such as:

- search-warrant packet classification, segmentation, and structured extraction;
- medical-record encounter and medication extraction;
- testimony speaker and assertion extraction;
- digital-forensics artifact and timestamp extraction;
- police-report source-type and attribution extraction.

Those workflows should emit proposals into shared Icarus primitives with source
locators and provenance. MCP output is not, by itself, an accepted fact, event,
document boundary, contradiction resolution, or corroboration decision.

The governed production path remains:

```text
immutable source -> parse output -> Icarus normalization -> review-required proposals -> governed acceptance
```

MCP must not bypass case authorization, immutable-source preservation, review,
versioned acceptance, or audit history. The server-side SDK pipeline remains the
controlled path for application ingestion and database writes.
