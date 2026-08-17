create or replace function public.publish_proceeding_package(p_package_version_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_package public.proceeding_package_versions%rowtype; v_proceeding public.proceedings%rowtype; v_json_segments integer;
begin
  select * into v_package from public.proceeding_package_versions where id=p_package_version_id for update;
  if not found or v_actor is null or not private.can_access_case(v_package.case_id) then raise exception 'Package not found or not authorized.' using errcode='42501'; end if;
  select * into v_proceeding from public.proceedings where id=v_package.proceeding_id for update;
  v_json_segments := jsonb_array_length(coalesce(v_package.package->'segments','[]'::jsonb));
  if v_proceeding.status not in ('complete','published') or v_proceeding.detected_segments<>v_proceeding.parsed_segments or v_proceeding.parsed_segments<>v_proceeding.committed_segments or v_json_segments<>v_proceeding.committed_segments then raise exception 'Package completeness validation failed.'; end if;
  update public.proceeding_package_versions set publication_status='superseded' where proceeding_id=v_proceeding.id and publication_status='published' and id<>p_package_version_id;
  update public.proceeding_package_versions set publication_status='published',published_by_user_id=v_actor,published_at=coalesce(published_at,now()) where id=p_package_version_id;
  update public.proceedings set status='published' where id=v_proceeding.id;
  return jsonb_build_object('package_version_id',p_package_version_id,'publication_status','published','segments',v_json_segments);
end; $$;

revoke all on function public.publish_proceeding_package(uuid) from public,anon;
grant execute on function public.publish_proceeding_package(uuid) to authenticated;
