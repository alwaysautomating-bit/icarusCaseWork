import type { Metadata } from "next";
import { RequestAccess } from "@/app/research-room/_components/research-landing";
import "@/app/research-room/research-room.css";
export const metadata: Metadata = { title: "Request Research Room Access" };
export default function Page() { return <RequestAccess/>; }
