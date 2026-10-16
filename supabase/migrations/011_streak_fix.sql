-- 011_streak_fix.sql: sửa lỗi "column reference d is ambiguous"
-- (biến plpgsql d trùng tên cột d) bằng cách đổi tên biến thành v_day.

create or replace function public.get_streak()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  other_id uuid;
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  kept_days date[] := '{}';
  v_today_me boolean := false;
  v_today_other boolean := false;
  v_last_both date := null;
  v_current int := 0;
  v_best int := 0;
  anchor date := null;
  v_day date;
  v_week jsonb := '[]';
begin
  if me is null then
    return jsonb_build_object(
      'current', 0, 'best', 0,
      'today_me', false, 'today_other', false,
      'last_both_date', null, 'week', '[]'::jsonb
    );
  end if;

  select p.id into other_id
  from public.profiles p
  where p.id <> me
  limit 1;

  if other_id is null then
    return jsonb_build_object(
      'current', 0, 'best', 0,
      'today_me', false, 'today_other', false,
      'last_both_date', null, 'week', '[]'::jsonb
    );
  end if;

  -- Ngày giữ lửa: cả hai cùng có ít nhất 1 tin trong ngày (giờ VN)
  with days as (
    select (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
           bool_or(m.sender_id = me) as has_me,
           bool_or(m.sender_id = other_id) as has_other
    from public.messages m
    where m.sender_id in (me, other_id)
    group by 1
  ),
  kept as (
    select d from days where has_me and has_other
  )
  select
    coalesce((select array_agg(b.d order by b.d desc) from kept b), '{}'),
    coalesce((select max(b.d) from kept b), null),
    coalesce((select d.has_me from days d where d.d = today), false),
    coalesce((select d.has_other from days d where d.d = today), false),
    coalesce((
      select max(cnt) from (
        select count(*) as cnt
        from (
          select b.d, b.d - row_number() over (order by b.d)::int as grp
          from kept b
        ) g
        group by g.grp
      ) t
    ), 0),
    coalesce((
      select jsonb_agg(jsonb_build_object('date', s.d, 'kept', s.d = any (select b.d from kept b)) order by s.d)
      from (select (today - gs)::date as d from generate_series(0, 6) gs) s
    ), '[]'::jsonb)
  into kept_days, v_last_both, v_today_me, v_today_other, v_best, v_week;

  -- Chuỗi hiện tại: kết thúc hôm nay (đủ) hoặc hôm qua (chờ); bỏ lỡ hôm qua -> 0
  if today = any (kept_days) then
    anchor := today;
  elsif (today - 1) = any (kept_days) then
    anchor := today - 1;
  else
    anchor := null;
  end if;

  if anchor is not null then
    v_day := anchor;
    loop
      exit when not (v_day = any (kept_days));
      v_current := v_current + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  return jsonb_build_object(
    'current', v_current,
    'best', v_best,
    'today_me', v_today_me,
    'today_other', v_today_other,
    'last_both_date', v_last_both,
    'week', v_week
  );
end;
$$;

grant execute on function public.get_streak() to authenticated;
