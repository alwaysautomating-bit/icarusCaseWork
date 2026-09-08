import type { Metadata } from "next";
import { ResearchLanding } from "@/app/research-room/_components/research-landing";
import "@/app/research-room/research-room.css";

export const metadata: Metadata = { title: "Icarus Research Room", description: "The record ends. Questions don't. Enter Icarus Research Room." };

export default function ResearchRoomEntrance() {
  return <ResearchLanding/>;
}
