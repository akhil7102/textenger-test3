-- Create user_settings table for user preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  notification_sound_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_sound_volume DECIMAL(3,2) NOT NULL DEFAULT 0.7 CHECK (notification_sound_volume >= 0.0 AND notification_sound_volume <= 1.0),
  theme_preference TEXT DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Add attachment fields to direct_messages table
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Add attachment fields to room_messages table
ALTER TABLE public.room_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Add icon_url to rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Create indexes for attachments
CREATE INDEX IF NOT EXISTS idx_direct_messages_attachments ON public.direct_messages(attachment_url) WHERE attachment_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_room_messages_attachments ON public.room_messages(attachment_url) WHERE attachment_url IS NOT NULL;

-- Enable realtime for user_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;

-- Set replica identity for realtime
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
