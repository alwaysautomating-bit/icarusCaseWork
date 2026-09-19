# LlamaParse Court-Packet Quick Start

Use this note when you have a large evidence or court packet and cannot remember the workflow.

## The short version

Do **not** manually split the packet first.

Keep the downloaded PDF intact as the original evidence artifact. The Icarus court-packet parser can:

- preserve the original packet and calculate its SHA-256 hash;
- run LlamaParse OCR and layout recovery;
- retain every page in its original order;
- propose document divisions such as warrants, affidavits, returns, inventories, and exhibits;
- create exact packet-page locators; and
- flag proposed divisions for human review.

The parser does **not** automatically turn extracted language into accepted facts. Document boundaries and extracted material remain review candidates until a person approves them.

## Easiest way to use it

In Codex, attach or identify the PDF and say:

> Use the LlamaParse court-packet agent on this PDF for the Icarus case. Preserve the original, propose document boundaries, and keep all results review-only.

Also provide the case UUID if it is known. The UUID is the long identifier in an open case URL:

```text
/cases/CASE-UUID/...
```

## One-time setup

The TypeScript package is already installed in this repository. A live parse still requires a LlamaCloud API key.

Add the key locally to `.env.local`:

```dotenv
LLAMA_CLOUD_API_KEY=your_key_here
```

Important:

- Never paste the key into a case note, source file, screenshot, or chat message.
- Never prefix it with `NEXT_PUBLIC_`.
- Do not commit `.env.local` to Git.

The parser defaults to the `agentic` tier because court packets commonly contain scanned forms, handwriting, mixed layouts, and exhibits.

## Run it from PowerShell

From `C:\Projects\IcarusCasework`:

```powershell
pnpm court-packet:parse "C:\path\to\evidence-packet.pdf" `
  --case-id "CASE-UUID" `
  --out ".data\court-packets\evidence-packet-review.json"
```

Expected completion output includes:

```text
<output-file path>
<number> pages preserved
<number> review candidates
```

The generated JSON is a review bundle. It is not an approved evidence record by itself.

## What happens to the packet

```text
Immutable original PDF
  -> page-by-page OCR and layout recovery
  -> proposed document boundaries
  -> review bundle with page provenance
  -> human acceptance, correction, rejection, or deferral
```

Example:

```text
Evidence packet
  - Search warrant: packet pages 1-4
  - Affidavit: packet pages 5-23
  - Warrant return: packet pages 24-26
  - Exhibit: packet pages 27-31
```

The packet remains one original artifact. The internal documents are children linked to their exact packet page ranges, not separate replacement files.

## Where the packet should appear in Icarus

The intended interface uses one underlying packet record in two contexts:

1. **Evidence page** — the full packet, page viewer, processing status, detected documents, provenance, and review controls.
2. **Accounts right panel** — a contextual **Source files** card linking to the packet or the relevant document/page range.

A source link should open the same evidence viewer at the supporting page, for example:

```text
Evidence packet / Affidavit / packet pages 41-43
```

Current status: the parser and review-bundle model exist, but the upload button, packet review workspace, and Accounts-panel file card still need to be connected to them.

## When downloading another packet

Prefer the original downloadable PDF from the court or document portal.

- Keep the original filename.
- Record the source page or portal and download date.
- Avoid screenshots or **Print to PDF** unless the portal provides no original download.
- Do not rearrange, delete, or renumber pages before ingestion.
- If the portal only provides an online viewer, save the URL and ask Codex to help determine the safest download method.

## Useful project files

- Parser command: `scripts/court-packet.ts`
- LlamaParse client: `src/lib/llamaparse.ts`
- Packet and segmentation model: `src/lib/court-packet.ts`
- Parser package: `llamaparse-agent/icarus-court-packet-parser-v0.1.0/`
- Detailed milestone guide: `Icarus-Casework-Court-Packet-Agent-Milestone-Guide.md`
- Integration contract: `llamaparse-agent/icarus-court-packet-parser-v0.1.0/docs/contract.md`

## If something fails

Check these first:

1. The PDF path is correct and the file opens normally.
2. `LLAMA_CLOUD_API_KEY` is present in `.env.local`.
3. The case ID is a valid UUID.
4. The output folder is writable.
5. Run the deterministic parser tests:

```powershell
pnpm exec vitest run src/lib/court-packet.test.ts
```

If the live service fails, preserve the original PDF and any returned job ID. Retrying should not create a second accepted evidence source for the same packet.
