import { documentTypes, type CourtPacketDocumentType } from "@/lib/court-packet";

export const documentTypeValues = documentTypes;

export function documentTypeLabel(type: CourtPacketDocumentType | string) {
  const words = type.replaceAll("_", " ").split(" ");
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
