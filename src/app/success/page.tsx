import type { Metadata } from "next";
import { AccessSuccess } from "@/app/research-room/_components/research-landing";
import "@/app/research-room/research-room.css";
export const metadata: Metadata = { title: "Access Request Received" };
export default function Page() { return <AccessSuccess/>; }
