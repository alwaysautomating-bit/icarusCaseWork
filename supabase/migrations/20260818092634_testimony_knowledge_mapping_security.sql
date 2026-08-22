-- Supabase projects can carry broad default privileges for newly created
-- public tables. Knowledge mapping is write-only through its atomic RPC.
revoke all on public.knowledge_extraction_runs,public.case_ledger_heads,public.case_ledger,public.witness_blocks,public.witness_block_segments,public.testimony_units,public.testimony_unit_segments,public.knowledge_items,public.knowledge_item_segments,public.knowledge_item_versions,public.claim_source_segments,public.entity_mentions,public.event_candidates,public.temporal_bands,public.temporal_assertions,public.knowledge_relationships,public.knowledge_flags,public.provenance_activities,public.provenance_relations from authenticated;

grant select on public.knowledge_extraction_runs,public.case_ledger,public.witness_blocks,public.witness_block_segments,public.testimony_units,public.testimony_unit_segments,public.knowledge_items,public.knowledge_item_segments,public.knowledge_item_versions,public.claim_source_segments,public.entity_mentions,public.event_candidates,public.temporal_bands,public.temporal_assertions,public.knowledge_relationships,public.knowledge_flags,public.provenance_activities,public.provenance_relations to authenticated;

revoke all on function private.append_case_ledger(uuid,text,uuid,text,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.commit_testimony_knowledge_map(jsonb) from public,anon;
grant execute on function public.commit_testimony_knowledge_map(jsonb) to authenticated;
