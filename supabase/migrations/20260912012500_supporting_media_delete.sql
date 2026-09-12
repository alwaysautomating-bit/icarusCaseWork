create policy supporting_media_items_delete
  on public.supporting_media_items
  for delete to authenticated
  using (private.can_contribute_case(case_id));

grant delete on table public.supporting_media_items to authenticated;
