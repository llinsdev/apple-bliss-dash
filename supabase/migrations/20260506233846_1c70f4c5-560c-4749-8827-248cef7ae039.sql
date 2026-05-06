
-- search_path para set_commission_value
create or replace function public.set_commission_value()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.commission_value := round(new.sale_value * new.commission_percentage / 100, 2);
  return new;
end;
$$;

-- Revogar execute público das SECURITY DEFINER
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
-- has_role precisa ser chamável por authenticated (usada nas policies via auth.uid)
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
