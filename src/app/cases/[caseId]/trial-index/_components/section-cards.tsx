import { CollapseDocument, inlineMarkup } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";
import { EvidenceWorkspace } from "@/app/cases/[caseId]/trial-index/_components/evidence-workspace";
import { courtRecordHref, witnessHref } from "@/lib/case-routes";

type Field = { label: string; text: string };
type Card = { title: string; fields: Field[]; bullets: string[] };

const stripBold = (value: string) => value.replace(/^\*\*(.*)\*\*$/, "$1");
const lines = (content: string) => content.replaceAll("\r\n", "\n").split("\n");

function bulletItems(content: string) {
  const items: Array<{ title: string; sub: string[] }> = [];
  for (const raw of lines(content)) {
    if (!raw.trim() || raw.trim() === "---") continue;
    const top = /^[*-]\s+(.*)$/.exec(raw);
    const sub = /^\s+[*-]\s+(.*)$/.exec(raw);
    const last = items.at(-1);
    if (top) items.push({ title: top[1].trim(), sub: [] });
    else if (sub && last) last.sub.push(sub[1].trim());
    else if (last) {
      if (last.sub.length) last.sub[last.sub.length - 1] += ` ${raw.trim()}`;
      else last.title += ` ${raw.trim()}`;
    }
  }
  return items;
}

function evidenceCards(content: string): Card[] {
  const cards: Card[] = [];
  let card: Card | null = null;
  let skipping = false;
  for (const raw of lines(content)) {
    const line = raw.trim();
    const match = /^(Claim|Supporting Evidence|Source|Confidence):\s*(.*)$/i.exec(line);
    if (match) {
      const key = match[1].toLowerCase();
      skipping = key === "confidence";
      if (key === "claim") { card = { title: match[2], fields: [], bullets: [] }; cards.push(card); }
      else if (card && !skipping) card.fields.push({ label: match[1], text: match[2] });
    } else if (line && line !== "---" && card && !skipping) {
      const last = card.fields.at(-1);
      if (last) last.text += ` ${line}`; else card.title += ` ${line}`;
    }
  }
  return cards;
}

function decisionCards(content: string): Card[] {
  const rows = lines(content).filter((line) => line.trim().startsWith("|")).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const body = rows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
  const [header, ...data] = body;
  if (!header) return [];
  return data.filter((row) => row[0]).map((row) => ({ title: row[0], bullets: [], fields: row.slice(1).flatMap((text, index) => text && !/^confidence$/i.test(header[index + 1] ?? "") ? [{ label: header[index + 1] ?? "", text }] : []) }));
}

function projectCards(content: string): Card[] {
  const cards: Card[] = [];
  let card: Card | null = null;
  for (const raw of lines(content)) {
    const line = raw.trim();
    if (!line || line === "---") continue;
    const match = /^([A-Za-z][A-Za-z ]{1,24}):\s*(.*)$/.exec(line);
    if (match && match[1].toLowerCase() === "project") { card = { title: match[2], fields: [], bullets: [] }; cards.push(card); }
    else if (match && card) card.fields.push({ label: match[1], text: match[2] });
    else if (card) { const last = card.fields.at(-1); if (last) last.text += ` ${line}`; }
  }
  return cards;
}

// Decisions: the decision and its reasoning take the main area; any other field the day supplies moves to a context column.
const isReasoning = (field: Field) => /reason|rationale|because/i.test(field.label);

function DecisionRegister({ cards }: { cards: Card[] }) {
  const split = (card: Card) => {
    const reasoning = card.fields.filter(isReasoning);
    return { reasoning, context: card.fields.filter((field) => !isReasoning(field)) };
  };
  const hasContext = cards.some((card) => split(card).context.length > 0);
  return <div className={`ti-register ti-decisions${hasContext ? " has-context" : ""}`} role="table" aria-label="Decision register">
    <div className="ti-register-head" role="row"><span role="columnheader">Decision</span><span role="columnheader">Reasoning</span>{hasContext ? <span role="columnheader">Context</span> : null}</div>
    {cards.map((card, index) => {
      const { reasoning, context } = split(card);
      return <article className="ti-register-row" role="row" key={index}>
        <div role="cell"><span className="ti-ref">{String(index + 1).padStart(2, "0")}</span><h3>{inlineMarkup(card.title)}</h3></div>
        <div role="cell">{reasoning.map((field, i) => <p key={i}>{inlineMarkup(field.text)}</p>)}</div>
        {hasContext ? <dl role="cell">{context.map((field, i) => <div key={i}><dt>{field.label}</dt><dd>{inlineMarkup(field.text)}</dd></div>)}</dl> : null}
      </article>;
    })}
  </div>;
}

// Builders: existing project fields, paired horizontally in a fixed reading order. Nothing is added.
const PROJECT_ORDER = ["purpose", "current status", "key decisions", "dependencies", "risks", "next actions"];

function ProjectPanels({ cards }: { cards: Card[] }) {
  const rank = (field: Field) => { const at = PROJECT_ORDER.indexOf(field.label.toLowerCase()); return at === -1 ? PROJECT_ORDER.length : at; };
  return <div className="ti-projects">
    {cards.map((card, index) => <article className="day-card ti-project" key={index}>
      <header><span>Project {index + 1}</span></header>
      <div className="day-card-body">
        <h3>{inlineMarkup(card.title)}</h3>
        <dl>{[...card.fields].sort((a, b) => rank(a) - rank(b)).map((field, i) => <div key={i}><dt>{field.label}</dt><dd>{inlineMarkup(field.text)}</dd></div>)}</dl>
      </div>
    </article>)}
  </div>;
}

function InsightList({ content, dayNumber }: { content: string; dayNumber: number }) {
  const items = bulletItems(content);
  return <div className="day-insights">
    {items.map((item, index) => {
      const split = /^\*\*(.+?)\*\*\s*(.*)$/.exec(item.title);
      const headline = split ? split[1] : stripBold(item.title);
      const body = split?.[2] ?? "";
      const summary = body || item.sub.slice(0, 2).join(" ");
      const more = body ? item.sub : item.sub.slice(2);
      return <article key={index} className={index === 0 ? "featured" : undefined}>
        <span className="day-insight-ref">§{dayNumber}.{index + 1}</span>
        <div>
          <h3>{inlineMarkup(headline)}</h3>
          {summary ? <p>{inlineMarkup(summary)}</p> : null}
          {more.length ? <details><summary>{more.length} more {more.length === 1 ? "point" : "points"}</summary><ul>{more.map((text, i) => <li key={i}>{inlineMarkup(text)}</li>)}</ul></details> : null}
        </div>
      </article>;
    })}
  </div>;
}

// Questions: the why-it-matters column only appears when the day supplies one.
function QuestionsCard({ content }: { content: string }) {
  const items = bulletItems(content).map((item) => ({ text: item.title, why: item.sub.map((text) => text.replace(/^why it matters:\s*/i, "")).join(" ") }));
  const hasWhy = items.some((item) => item.why);
  return <section className={`ti-register ti-questions${hasWhy ? " has-why" : ""}`} role="table" aria-label="Open questions">
    <div className="ti-register-head" role="row"><span role="columnheader">#</span><span role="columnheader">Question</span>{hasWhy ? <span role="columnheader">Why it matters</span> : null}</div>
    {items.map((item, index) => <article className="ti-register-row" role="row" key={index}>
      <b role="cell" className="ti-ref">{String(index + 1).padStart(2, "0")}</b>
      <p role="cell">{inlineMarkup(item.text)}</p>
      {hasWhy ? <em role="cell">{item.why ? inlineMarkup(item.why) : null}</em> : null}
    </article>)}
  </section>;
}

export function SectionCards({ slug, content, dayNumber, caseId }: { slug: string; content: string; dayNumber: number; caseId: string }) {
  if (slug === "key-insights" && bulletItems(content).length) return <InsightList content={content} dayNumber={dayNumber} />;
  if (slug === "open-questions") {
    if (bulletItems(content).length) return <QuestionsCard content={content} />;
  } else if (slug === "evidence") {
    const claims = evidenceCards(content);
    if (claims.length) return <EvidenceWorkspace claims={claims.map((card) => ({ title: card.title, fields: card.fields, searchHref: courtRecordHref(caseId, { query: stripBold(card.title).replace(/[*`]/g, "").slice(0, 160) }) }))} dayNumber={dayNumber} dayHref={witnessHref(caseId, { day: dayNumber })} />;
  } else if (slug === "decisions") {
    const cards = decisionCards(content);
    if (cards.length) return <DecisionRegister cards={cards} />;
  } else if (slug === "projects-discussed") {
    const cards = projectCards(content);
    if (cards.length) return <ProjectPanels cards={cards} />;
  }
  return <CollapseDocument content={content} />;
}
