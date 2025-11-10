-- Permitir que tutores vean perfiles de sus estudiantes
CREATE POLICY "Tutors can view their students profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_students
      WHERE tutor_students.tutor_id = auth.uid()
      AND tutor_students.student_id = profiles.id
    )
  );

-- Permitir que tutores vean los starter_profiles de sus estudiantes
CREATE POLICY "Tutors can view their students starter profiles"
  ON public.starter_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_students
      WHERE tutor_students.tutor_id = auth.uid()
      AND tutor_students.student_id = starter_profiles.user_id
    )
  );

-- Permitir que tutores actualicen los starter_profiles de sus estudiantes
CREATE POLICY "Tutors can update their students starter profiles"
  ON public.starter_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_students
      WHERE tutor_students.tutor_id = auth.uid()
      AND tutor_students.student_id = starter_profiles.user_id
    )
  );