import type { StructureReviewVersion } from "@/lib/structure-review";

function changedFields(version: StructureReviewVersion) {
  const keys = new Set([...Object.keys(version.beforeState), ...Object.keys(version.afterState)]);
  return [...keys].filter((key) => JSON.stringify(version.beforeState[key]) !== JSON.stringify(version.afterState[key]));
}

function display(value: unknown) {
  if (value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function ReviewHistory({ versions }: { versions: StructureReviewVersion[] }) {
  return <section className="structure-review-history"><header><span>IMMUTABLE REVIEW HISTORY</span><strong>{versions.length}</strong></header>
    {versions.length === 0 ? <p>No human review version has been recorded for this candidate.</p> : versions.map((version) => {
      const changes = changedFields(version);
      return <article key={version.id}><header><strong>v{version.version} · {version.action}</strong><time dateTime={version.reviewedAt}>{new Date(version.reviewedAt).toLocaleString()}</time></header><p>{version.note || "No optional note recorded."}</p><code>{version.reviewedByUserId}</code>
        {changes.length ? <dl>{changes.map((field) => <div key={field}><dt>{field.replaceAll("_", " ")}</dt><dd><del>{display(version.beforeState[field])}</del><ins>{display(version.afterState[field])}</ins></dd></div>)}</dl> : <small>No candidate field changed; status and audit state were versioned.</small>}
      </article>;
    })}
  </section>;
}
