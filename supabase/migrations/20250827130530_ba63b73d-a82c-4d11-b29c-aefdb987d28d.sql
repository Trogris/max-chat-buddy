-- Add preferred_model column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN preferred_model text DEFAULT 'gpt-4.1-2025-04-14';