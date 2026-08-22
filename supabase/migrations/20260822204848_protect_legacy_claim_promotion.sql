-- Keep claims readable to case members while requiring controlled functions for mutation.
drop policy if exists claims_all on public.claims;
drop policy if exists claims_select on public.claims;
create policy claims_select on public.claims for select to authenticated
  using(private.can_access_case(case_id));

revoke all on public.claims from authenticated;
grant select on public.claims to authenticated;

-- This preserves the original claim-to-canonical-event workflow as a separately
-- governed legacy action. It is intentionally not called by Structure Review.
create function public.review_and_promote_claim(
  p_case_id uuid,
  p_claim_id uuid,
  p_rationale text,
  p_event_title text,
  p_precision text,
  p_event_time_end timestamptz default null,
  p_uncertainty_note text default ''
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid());
  v_claim public.claims%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_precision public.time_precision;
begin
  if v_actor is null or not private.can_access_case(p_case_id) then
    raise exception 'CLAIM_PROMOTION_NOT_AUTHORIZED' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_rationale,''))) < 5 then
    raise exception 'CLAIM_PROMOTION_RATIONALE_REQUIRED';
  end if;
  if length(btrim(coalesce(p_event_title,''))) < 5 then
    raise exception 'CLAIM_PROMOTION_TITLE_REQUIRED';
  end if;
  if length(coalesce(p_uncertainty_note,'')) > 1000 then
    raise exception 'CLAIM_PROMOTION_UNCERTAINTY_TOO_LONG';
  end if;
  if p_precision not in ('exact','approximate','interval','relative','unknown') then
    raise exception 'CLAIM_PROMOTION_PRECISION_INVALID';
  end if;
  v_precision := p_precision::public.time_precision;

  select * into v_claim
    from public.claims
    where id=p_claim_id and case_id=p_case_id
    for update;
  if not found then
    raise exception 'CLAIM_PROMOTION_TARGET_UNAVAILABLE' using errcode='42501';
  end if;
  if v_claim.status <> 'candidate' then
    raise exception 'CLAIM_ALREADY_REVIEWED';
  end if;

  update public.claims set status='accepted' where id=p_claim_id;
  insert into public.review_decisions(id,claim_id,reviewer_user_id,disposition,rationale)
  values(gen_random_uuid(),p_claim_id,v_actor,'accepted',btrim(p_rationale));
  insert into public.events(
    id,case_id,promoted_from_claim_id,title,event_time_start,event_time_end,
    time_precision,epistemic_state,uncertainty_note
  ) values (
    v_event_id,p_case_id,p_claim_id,btrim(p_event_title),v_claim.claimed_event_time,p_event_time_end,
    v_precision,'reviewed_observable',coalesce(p_uncertainty_note,'')
  );
  insert into public.audit_events(
    id,case_id,actor_user_id,action,subject_type,subject_id,details
  ) values (
    gen_random_uuid(),p_case_id,v_actor,'claim.accepted_and_event.promoted','event',v_event_id::text,
    jsonb_build_object('claimId',p_claim_id,'precision',p_precision)
  );

  return v_event_id;
end;
$$;

revoke all on function public.review_and_promote_claim(uuid,uuid,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.review_and_promote_claim(uuid,uuid,text,text,text,timestamptz,text) to authenticated;
