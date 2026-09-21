"use client";

import { useFormStatus } from "react-dom";
import { uploadCourtPacketAction } from "@/app/cases/[caseId]/evidence/intake/actions";

function UploadStatus({ fileName }: { fileName: string }) {
  const { pending } = useFormStatus();
  if (!pending) return <button className="browse-btn" type="submit">Upload &amp; parse</button>;
  return <div className="parsing-card">
    <div className="fname">{fileName || "Court packet"}</div>
    <div className="pulse-row"><span className="pulse-dot" /><span className="status-text">Parsing packet — this can take a minute.</span></div>
    <div className="sub">Uploading, then invoking the LlamaParse pipeline and identifying internal document boundaries.</div>
  </div>;
}

export function UploadForm({ caseId, caseTitle }: { caseId: string; caseTitle: string }) {
  const action = uploadCourtPacketAction.bind(null, caseId);
  return <form action={action} className="dropzone">
    <div className="glyph">DRAG &amp; DROP</div>
    <h3>Choose a court packet</h3>
    <p>PDF only. The full packet is kept intact — internal documents are detected automatically.</p>
    <input type="file" name="packet" accept="application/pdf" required />
    <UploadStatus fileName="" />
    <div className="case-line">Will attach to: {caseTitle}</div>
  </form>;
}
