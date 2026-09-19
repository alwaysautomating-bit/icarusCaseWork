import Link from "next/link";
import { Fragment } from "react";
import { courtRecordHref, witnessHref } from "@/lib/case-routes";

const WITNESS_QUERIES: Record<string, string> = {
  Trial: "Patrick Clancy",
  Josephine: "Josephine",
  Hall: "Hall",
  Hussey: "Hussey",
  Dougherty: "Dougherty",
  Cahill: "Cahill",
  Stratton: "Stratton",
  Dwyer: "Dwyer",
  Nudd: "Nudd",
  Nette: "Nette",
  Costanzo: "Costanzo",
  Heath: "Heath",
};

export function witnessQuery(name: string) {
  const first = name.split(";")[0]!.trim();
  if (WITNESS_QUERIES[first]) return WITNESS_QUERIES[first]!;
  const tokens = first.replace(/[^A-Za-z .'-]/g, "").split(/\s+/).filter(Boolean);
  const surname = tokens.at(-1) ?? first;
  return surname === "Clancy" ? tokens.join(" ") : surname;
}

export function CiteList({ caseId, items }: { caseId: string; items: string[] }) {
  return <>{items.map((item, index) => {
    const query = WITNESS_QUERIES[item.split(" ")[0]!];
    return <Fragment key={`${item}-${index}`}>
      {index > 0 ? " · " : null}
      {query ? <Link className="cite-link" href={witnessHref(caseId, { witness: query })} title={`Open ${query}'s testimony`}>{item}</Link> : item}
    </Fragment>;
  })}</>;
}

export function WitnessLink({ caseId, name, children }: { caseId: string; name: string; children?: React.ReactNode }) {
  return <Link className="cite-link witness" href={witnessHref(caseId, { witness: witnessQuery(name) })} title={`Open ${witnessQuery(name)}'s testimony`}>{children ?? name}</Link>;
}

export function SearchTestimonyLink({ caseId, query }: { caseId: string; query: string }) {
  const cleaned = query.replace(/['’]s(?![a-z])/gi, "").replace(/[“”"'’]/g, "").slice(0, 160);
  return <Link className="search-testimony-link" href={courtRecordHref(caseId, { query: cleaned })}>Search testimony database →</Link>;
}
