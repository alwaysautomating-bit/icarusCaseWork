"use client";

function setAll(open: boolean) {
  document.querySelectorAll<HTMLDetailsElement>(".foundation-day-body").forEach((details) => {
    details.open = open;
  });
}

export function ExpandCollapseAll() {
  return <div className="expand-collapse-all" role="group" aria-label="Expand or collapse every day">
    <button type="button" onClick={() => setAll(true)}>Expand all</button>
    <button type="button" onClick={() => setAll(false)}>Collapse all</button>
  </div>;
}
