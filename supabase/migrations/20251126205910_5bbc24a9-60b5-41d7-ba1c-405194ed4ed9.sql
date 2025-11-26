-- Create table for mind maps
CREATE TABLE public.mind_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  tema TEXT NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;

-- Users can view their own mind maps
CREATE POLICY "Users can view their own mind maps"
ON public.mind_maps
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own mind maps
CREATE POLICY "Users can create their own mind maps"
ON public.mind_maps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own mind maps
CREATE POLICY "Users can delete their own mind maps"
ON public.mind_maps
FOR DELETE
USING (auth.uid() = user_id);