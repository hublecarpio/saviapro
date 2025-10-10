-- Create conversations table
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS on conversations
alter table public.conversations enable row level security;

-- Users can view their own conversations
create policy "Users can view their own conversations"
  on public.conversations
  for select
  using (auth.uid() = user_id);

-- Users can insert their own conversations
create policy "Users can insert their own conversations"
  on public.conversations
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own conversations
create policy "Users can update their own conversations"
  on public.conversations
  for update
  using (auth.uid() = user_id);

-- Users can delete their own conversations
create policy "Users can delete their own conversations"
  on public.conversations
  for delete
  using (auth.uid() = user_id);

-- Add conversation_id to messages table
alter table public.messages add column conversation_id uuid references public.conversations(id) on delete cascade;

-- Create index for faster queries
create index messages_conversation_id_created_at_idx on public.messages(conversation_id, created_at desc);

-- Update messages to require conversation_id (after migration)
-- Note: Existing messages will need to be assigned to conversations or deleted

-- Function to update conversation timestamp
create or replace function public.update_conversation_timestamp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

-- Trigger to update conversation timestamp when message is added
create trigger update_conversation_timestamp_on_message
  after insert on public.messages
  for each row execute procedure public.update_conversation_timestamp();

-- Enable realtime for conversations
alter publication supabase_realtime add table public.conversations;