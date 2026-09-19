import type { ReactNode } from "react";

export type FileCardItem = { label: string; meta?: string; href: string; external?: boolean; download?: boolean };

export function FilesCard({ title, count, items, footer }: { title: string; count?: ReactNode; items: FileCardItem[]; footer?: ReactNode }) {
  return <section className="side-card">
    <div className="head"><span>{title}</span>{count !== undefined ? <span className="count">{count}</span> : null}</div>
    <div className="body">
      {items.map((item) => <div className="file-row" key={item.href + item.label}>
        <a href={item.href} {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})} {...(item.download ? { download: "" } : {})}>{item.label}{item.external ? " ↗" : ""}</a>
        {item.meta ? <span className="meta">{item.meta}</span> : null}
      </div>)}
    </div>
    {footer ? <div className="side-card-footer">{footer}</div> : null}
  </section>;
}
