import { CollapseDocument, inlineMarkup } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";

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

function CardStack({ cards, kind, plain = false }: { cards: Card[]; kind: string; plain?: boolean }) {
  return <div className="day-cards">
    {cards.map((card, index) => <article className="day-card" key={index}>
      {plain ? null : <header><span>{kind} {index + 1}</span></header>}
      <div className="day-card-body">
        <h3>{inlineMarkup(card.title)}</h3>
        {card.bullets.length ? <ul>{card.bullets.map((bullet, i) => <li key={i}>{inlineMarkup(bullet)}</li>)}</ul> : null}
        {card.fields.length ? <dl>{card.fields.map((field, i) => <div key={i}><dt>{field.label}</dt><dd>{inlineMarkup(field.text)}</dd></div>)}</dl> : null}
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
      return <article key={index}>
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

function QuestionsCard({ content }: { content: string }) {
  const items = bulletItems(content);
  return <section className="day-questions">
    <h3>Open questions <small>{items.length}</small></h3>
    <ol>{items.map((item, index) => {
      const why = item.sub.map((text) => text.replace(/^why it matters:\s*/i, "")).join(" ");
      return <li key={index}>
        <b>{String(index + 1).padStart(2, "0")}</b>
        <div><p>{inlineMarkup(item.title)}</p>{why ? <em>{inlineMarkup(why)}</em> : null}</div>
      </li>;
    })}</ol>
  </section>;
}

export function SectionCards({ slug, content, dayNumber }: { slug: string; content: string; dayNumber: number }) {
  if (slug === "key-insights" && bulletItems(content).length) return <InsightList content={content} dayNumber={dayNumber} />;
  if (slug === "open-questions") {
    if (bulletItems(content).length) return <QuestionsCard content={content} />;
  } else {
    const parsed = slug === "evidence" ? { cards: evidenceCards(content), kind: "Claim" }
      : slug === "decisions" ? { cards: decisionCards(content), kind: "Decision" }
      : slug === "projects-discussed" ? { cards: projectCards(content), kind: "Project" }
      : null;
    if (parsed?.cards.length) return <CardStack cards={parsed.cards} kind={parsed.kind} plain={slug === "decisions"} />;
  }
  return <CollapseDocument content={content} />;
}
