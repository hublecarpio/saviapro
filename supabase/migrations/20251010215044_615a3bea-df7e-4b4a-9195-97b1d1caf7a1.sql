-- Create profiles table for user information
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  created_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Users can view their own profile
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Trigger to automatically create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create messages table for chat history
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  created_at timestamp with time zone default now()
);

-- Create index for faster queries
create index messages_user_id_created_at_idx on public.messages(user_id, created_at desc);

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Users can view their own messages
create policy "Users can view their own messages"
  on public.messages
  for select
  using (auth.uid() = user_id);

-- Users can insert their own messages
create policy "Users can insert their own messages"
  on public.messages
  for insert
  with check (auth.uid() = user_id);

-- Enable realtime for messages table
alter publication supabase_realtime add table public.messages;