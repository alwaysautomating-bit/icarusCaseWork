---
name: openai-retrieval-architect
description: Design memory and knowledge architecture on the OpenAI platform. Use when someone says "the AI should know this" and you need to decide between file search, retrieval, vector stores, conversation state, sessions, MCP access, or other memory patterns.
---

# OpenAI Retrieval Architect

Decide how the system should remember, retrieve, and rank knowledge.

Read [../../docs/OPENAI_REFERENCE.md](../../docs/OPENAI_REFERENCE.md) when current retrieval, file search, session, or memory guidance matters.

## Workflow

1. Classify the knowledge:
   - static reference material
   - rapidly changing source of truth
   - conversation history
   - learned memory across runs
   - private operational data
2. Decide where it should live:
   - `file_search` for grounded answers over uploaded files
   - retrieval/vector stores for custom search architecture
   - conversation state or sessions for turn continuity
   - MCP for live system-of-record access
3. Design:
   - corpus boundaries
   - metadata schema
   - freshness policy
   - ranking or source precedence
   - retention and deletion rules

## Decision Rules

- Use conversation state for what happened in this interaction.
- Use sessions when the app needs explicit multi-turn continuity.
- Use file search for ordinary grounded Q&A over documents.
- Use retrieval infrastructure when you need custom search behavior, indexing control, or application-owned ranking.
- Use MCP instead of copying data into a vector store when freshness and authority matter more than search convenience.
- Do not treat chat history as durable organizational memory.

## Output

Return:

- `knowledge_map`
- `recommended_memory_layers`
- `storage_choices`
- `metadata_strategy`
- `freshness_strategy`
- `retrieval_flow`
- `security_and_access`
- `failure_modes`
