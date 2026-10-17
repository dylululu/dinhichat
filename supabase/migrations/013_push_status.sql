-- 013_push_status: theo độ bền push — trạng thái lần gửi gần nhất cho người nhận
alter table public.profiles add column if not exists last_push_status text;
alter table public.profiles add column if not exists last_push_at timestamptz;

comment on column public.profiles.last_push_status is
  'Kết quả push gần nhất cho người này: ''ok'' hoặc mã lỗi HTTP (vd 410/429/500) hay ''timeout''.';
comment on column public.profiles.last_push_at is 'Thời điểm ghi trạng thái push gần nhất.';
