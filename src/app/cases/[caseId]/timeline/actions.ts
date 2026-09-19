"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { timelineHref } from "@/lib/case-routes";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();
const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const precisionSchema = z.enum(["exact","exact_date","approximate","interval","relative_only","sequence_only","unknown"]);

function value(formData: FormData,key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function noticeHref(caseId: string,slug: string,kind: "message" | "error",message: string,extra: Record<string,string> = {}) {
  const params = new URLSearchParams({ timeline:slug,[kind]:message.slice(0,240),...extra });
  return `${timelineHref(caseId)}?${params.toString()}`;
}

async function requireContributor(caseId: string,slug: string) {
  const actor = await requireCaseActor();
  const currentCase = await getAccessibleCase(actor.id,caseId);
  if (!currentCase || currentCase.membershipRole === "viewer") redirect(noticeHref(caseId,slug,"error","This case is read-only for your account."));
  return actor;
}

function temporalHint(formData: FormData,precision: z.infer<typeof precisionSchema>) {
  const label = value(formData,"timeLabel");
  const date = value(formData,"date");
  const time = value(formData,"time");
  const endDate = value(formData,"endDate");
  return {
    precision,
    ...(label ? { label } : {}),
    ...(date ? precision === "interval" ? { startDate:date } : { date } : {}),
    ...(time ? { time } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

export async function addTimelineNoteAction(rawCaseId: string,rawTimelineId: string,rawSlug: string,formData: FormData) {
  const parsed = z.object({
    caseId:idSchema,timelineId:idSchema,slug:slugSchema,description:z.string().trim().min(2).max(500),precision:precisionSchema,
    timeLabel:z.string().trim().max(120),date:z.string().trim().max(10),time:z.string().trim().max(8),endDate:z.string().trim().max(10),
    sourceHint:z.string().trim().max(500),section:z.string().trim().max(100),category:z.string().trim().max(100),note:z.string().trim().max(2000),
  }).safeParse({ caseId:rawCaseId,timelineId:rawTimelineId,slug:rawSlug,description:value(formData,"description"),precision:value(formData,"precision"),timeLabel:value(formData,"timeLabel"),date:value(formData,"date"),time:value(formData,"time"),endDate:value(formData,"endDate"),sourceHint:value(formData,"sourceHint"),section:value(formData,"section"),category:value(formData,"category"),note:value(formData,"note") });
  if (!parsed.success) redirect(noticeHref(rawCaseId,rawSlug,"error","Add a short neutral headline and a valid temporal description.",{add:"1"}));
  const actor = await requireContributor(parsed.data.caseId,parsed.data.slug);
  const supabase = await createClient();
  const { error } = await supabase.from("timeline_placement_notes").insert({
    case_id:parsed.data.caseId,timeline_id:parsed.data.timelineId,description:parsed.data.description,
    temporal_hint_json:temporalHint(formData,parsed.data.precision),source_hint:parsed.data.sourceHint,section:parsed.data.section,
    category:parsed.data.category,note:parsed.data.note,created_by_user_id:actor.id,
  });
  if (error) redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"error",error.message,{add:"1"}));
  revalidatePath(timelineHref(parsed.data.caseId));
  redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"message","Needs Source note added."));
}

export async function updateTimelineNoteAction(rawCaseId: string,rawTimelineId: string,rawSlug: string,rawNoteId: string,formData: FormData) {
  const parsed = z.object({caseId:idSchema,timelineId:idSchema,slug:slugSchema,noteId:idSchema,description:z.string().trim().min(2).max(500),precision:precisionSchema,sourceHint:z.string().trim().max(500),section:z.string().trim().max(100),category:z.string().trim().max(100),note:z.string().trim().max(2000)}).safeParse({caseId:rawCaseId,timelineId:rawTimelineId,slug:rawSlug,noteId:rawNoteId,description:value(formData,"description"),precision:value(formData,"precision"),sourceHint:value(formData,"sourceHint"),section:value(formData,"section"),category:value(formData,"category"),note:value(formData,"note")});
  if (!parsed.success) redirect(noticeHref(rawCaseId,rawSlug,"error","The placement note could not be updated.",{edit:rawNoteId}));
  await requireContributor(parsed.data.caseId,parsed.data.slug);
  const supabase = await createClient();
  const { data,error } = await supabase.from("timeline_placement_notes").update({description:parsed.data.description,temporal_hint_json:temporalHint(formData,parsed.data.precision),source_hint:parsed.data.sourceHint,section:parsed.data.section,category:parsed.data.category,note:parsed.data.note,updated_at:new Date().toISOString()}).eq("case_id",parsed.data.caseId).eq("timeline_id",parsed.data.timelineId).eq("id",parsed.data.noteId).eq("status","needs_source").select("id").maybeSingle();
  if (error || !data) redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"error",error?.message ?? "That note is no longer available.",{edit:parsed.data.noteId}));
  revalidatePath(timelineHref(parsed.data.caseId));
  redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"message","Placement note updated."));
}

export async function dismissTimelineNoteAction(rawCaseId: string,rawTimelineId: string,rawSlug: string,rawNoteId: string) {
  const parsed = z.object({caseId:idSchema,timelineId:idSchema,slug:slugSchema,noteId:idSchema}).safeParse({caseId:rawCaseId,timelineId:rawTimelineId,slug:rawSlug,noteId:rawNoteId});
  if (!parsed.success) redirect(timelineHref(rawCaseId));
  await requireContributor(parsed.data.caseId,parsed.data.slug);
  const supabase = await createClient();
  const { data,error } = await supabase.from("timeline_placement_notes").update({status:"dismissed",updated_at:new Date().toISOString()}).eq("case_id",parsed.data.caseId).eq("timeline_id",parsed.data.timelineId).eq("id",parsed.data.noteId).eq("status","needs_source").select("id").maybeSingle();
  if (error || !data) redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"error",error?.message ?? "That note is no longer available."));
  revalidatePath(timelineHref(parsed.data.caseId));
  redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"message","Placement note dismissed. Its audit trail remains recoverable."));
}

export async function addTimelineEventAction(rawCaseId: string,rawTimelineId: string,rawSlug: string,formData: FormData) {
  const parsed = z.object({caseId:idSchema,timelineId:idSchema,slug:slugSchema,eventRef:z.string().regex(/^(event|candidate):[0-9a-f-]{36}$/i),section:z.string().trim().max(100),category:z.string().trim().max(100)}).safeParse({caseId:rawCaseId,timelineId:rawTimelineId,slug:rawSlug,eventRef:value(formData,"eventRef"),section:value(formData,"section"),category:value(formData,"category")});
  if (!parsed.success) redirect(noticeHref(rawCaseId,rawSlug,"error","Choose an existing source-linked event.",{add:"1"}));
  const actor = await requireContributor(parsed.data.caseId,parsed.data.slug);
  const [kind,eventId] = parsed.data.eventRef.split(":") as ["event" | "candidate",string];
  const supabase = await createClient();
  const { error } = await supabase.from("core_timeline_event_memberships").insert({case_id:parsed.data.caseId,timeline_id:parsed.data.timelineId,event_id:kind === "event" ? eventId : null,event_candidate_id:kind === "candidate" ? eventId : null,section:parsed.data.section,category:parsed.data.category,created_by_user_id:actor.id});
  if (error) redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"error",error.code === "23505" ? "That event is already on this timeline." : error.message,{add:"1"}));
  revalidatePath(timelineHref(parsed.data.caseId));
  redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"message",kind === "event" ? "Known anchor added to this projection." : "Working event added to this projection."));
}

export async function removeTimelineEventAction(rawCaseId: string,rawTimelineId: string,rawSlug: string,rawMembershipId: string) {
  const parsed = z.object({caseId:idSchema,timelineId:idSchema,slug:slugSchema,membershipId:idSchema}).safeParse({caseId:rawCaseId,timelineId:rawTimelineId,slug:rawSlug,membershipId:rawMembershipId});
  if (!parsed.success) redirect(timelineHref(rawCaseId));
  await requireContributor(parsed.data.caseId,parsed.data.slug);
  const supabase = await createClient();
  const { data,error } = await supabase.from("core_timeline_event_memberships").delete().eq("case_id",parsed.data.caseId).eq("timeline_id",parsed.data.timelineId).eq("id",parsed.data.membershipId).select("id").maybeSingle();
  if (error || !data) redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"error",error?.message ?? "That event is no longer on this timeline."));
  revalidatePath(timelineHref(parsed.data.caseId));
  redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"message","Event removed from this projection. The underlying event was not deleted."));
}

export async function updateCoreTimelineAction(rawCaseId: string,rawTimelineId: string,rawSlug: string,formData: FormData) {
  const parsed = z.object({caseId:idSchema,timelineId:idSchema,slug:slugSchema,title:z.string().trim().min(1).max(120),subtitle:z.string().trim().max(240),description:z.string().trim().max(1200)}).safeParse({caseId:rawCaseId,timelineId:rawTimelineId,slug:rawSlug,title:value(formData,"title"),subtitle:value(formData,"subtitle"),description:value(formData,"description")});
  if (!parsed.success) redirect(noticeHref(rawCaseId,rawSlug,"error","Timeline details could not be updated."));
  await requireContributor(parsed.data.caseId,parsed.data.slug);
  const supabase = await createClient();
  const { data,error } = await supabase.from("core_timelines").update({title:parsed.data.title,subtitle:parsed.data.subtitle,description:parsed.data.description,updated_at:new Date().toISOString()}).eq("case_id",parsed.data.caseId).eq("id",parsed.data.timelineId).select("id").maybeSingle();
  if (error || !data) redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"error",error?.message ?? "That timeline is no longer available."));
  revalidatePath(timelineHref(parsed.data.caseId));
  redirect(noticeHref(parsed.data.caseId,parsed.data.slug,"message","Timeline details updated."));
}
