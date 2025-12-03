
-- Permitir a tutores insertar starter_profiles de sus estudiantes
CREATE POLICY "Tutors can insert their students starter profiles"
ON public.starter_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tutor_students
    WHERE tutor_students.tutor_id = auth.uid()
    AND tutor_students.student_id = starter_profiles.user_id
  )
);
