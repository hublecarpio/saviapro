-- Tabla para relacionar tutores con estudiantes
CREATE TABLE IF NOT EXISTS public.tutor_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tutor_id, student_id)
);

-- Habilitar RLS
ALTER TABLE public.tutor_students ENABLE ROW LEVEL SECURITY;

-- Los tutores pueden ver sus propios estudiantes
CREATE POLICY "Tutors can view their students"
  ON public.tutor_students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'tutor'
      AND tutor_id = auth.uid()
    )
  );

-- Los tutores pueden agregar estudiantes
CREATE POLICY "Tutors can add students"
  ON public.tutor_students
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'tutor'
      AND tutor_id = auth.uid()
    )
  );

-- Los tutores pueden eliminar sus estudiantes
CREATE POLICY "Tutors can delete their students"
  ON public.tutor_students
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'tutor'
      AND tutor_id = auth.uid()
    )
  );

-- Los estudiantes pueden ver su relación con tutores
CREATE POLICY "Students can view their tutors"
  ON public.tutor_students
  FOR SELECT
  USING (student_id = auth.uid());