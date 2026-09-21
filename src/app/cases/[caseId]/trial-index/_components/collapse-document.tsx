import { Fragment, type ReactNode } from "react";

export function inlineMarkup(value: string) {
  const tokens = value.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.length > 2 && token.startsWith("*") && token.endsWith("*")) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{token}</Fragment>;
  });
}

function linesWithBreaks(lines: string[]) {
  return lines.map((line, index) => <Fragment key={index}>{inlineMarkup(line)}{index < lines.length - 1 ? <br /> : null}</Fragment>);
}

function splitTableRow(line: string) {
  const delimiter = line.includes("\t") ? "\t" : "|";
  const cells = line.split(delimiter).map((cell) => cell.trim());
  if (delimiter === "|") {
    if (!cells[0]) cells.shift();
    if (!cells.at(-1)) cells.pop();
  }
  return cells;
}

function isDividerRow(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function DocumentTable({ lines }: { lines: string[] }) {
  const rows = lines.map(splitTableRow).filter((row) => !isDividerRow(row));
  const [header, ...body] = rows;
  if (!header) return null;

  return <div className="collapse-doc-table-scroll"><table className="collapse-doc-table">
    <thead><tr>{header.map((cell, index) => <th key={index}>{inlineMarkup(cell)}</th>)}</tr></thead>
    <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{inlineMarkup(cell)}</td>)}</tr>)}</tbody>
  </table></div>;
}

function labeledParagraph(lines: string[]) {
  const match = lines[0]?.match(/^(Claim|Supporting Evidence|Source|Confidence):\s*(.*)$/i);
  if (!match) return null;
  return <p className="collapse-doc-labeled"><b>{match[1]}</b><span>{inlineMarkup([match[2], ...lines.slice(1)].join(" "))}</span></p>;
}

export function CollapseDocument({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  const rendered: ReactNode[] = blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const tableLike = lines.length > 1 && (lines.every((line) => line.includes("\t")) || lines.every((line) => line.includes("|")));
    if (tableLike) return <DocumentTable lines={lines} key={index} />;

    const label = labeledParagraph(lines);
    if (label) return <Fragment key={index}>{label}</Fragment>;

    const bullet = lines[0]?.match(/^[-*]\s+(.*)$/);
    if (bullet) return <ul className="collapse-doc-list" key={index}><li>{linesWithBreaks([bullet[1], ...lines.slice(1)])}</li></ul>;

    const numbered = lines[0]?.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) return <div className="collapse-doc-numbered" key={index}><b>{numbered[1]}</b><p>{linesWithBreaks([numbered[2], ...lines.slice(1)])}</p></div>;

    const isRelationship = lines.some((line) => line.trim() === "→");
    if (isRelationship) return <p className="collapse-doc-relationship" key={index}>{linesWithBreaks(lines)}</p>;

    return <p key={index}>{linesWithBreaks(lines)}</p>;
  });

  return <div className="collapse-doc-content">{rendered}</div>;
}
