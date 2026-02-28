
CREATE POLICY "Anyone can insert teachers"
ON public.teachers
FOR INSERT
WITH CHECK (true);
