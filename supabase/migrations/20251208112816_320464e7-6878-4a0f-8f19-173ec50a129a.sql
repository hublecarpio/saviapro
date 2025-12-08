-- Crear tabla para resultados de quiz (respuestas del usuario a las fichas)
CREATE TABLE public.quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  ficha_id UUID NOT NULL,
  selected_option INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para reportes del tutor
CREATE TABLE public.tutor_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  tutor_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id),
  topic TEXT NOT NULL,
  progress_summary TEXT,
  difficulties TEXT,
  recommendations TEXT,
  emotional_state TEXT,
  daily_observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_reports ENABLE ROW LEVEL SECURITY;

-- Policies para quiz_results
CREATE POLICY "Users can view their own quiz results"
ON public.quiz_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results"
ON public.quiz_results FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policies para tutor_reports (tutores pueden ver reportes de sus estudiantes)
CREATE POLICY "Tutors can view reports of their students"
ON public.tutor_reports FOR SELECT
USING (
  tutor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tutor_students
    WHERE tutor_students.tutor_id = auth.uid()
    AND tutor_students.student_id = tutor_reports.student_id
  )
);

CREATE POLICY "Tutors can insert reports for their students"
ON public.tutor_reports FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tutor_students
    WHERE tutor_students.tutor_id = auth.uid()
    AND tutor_students.student_id = tutor_reports.student_id
  )
);

CREATE POLICY "System can insert reports"
ON public.tutor_reports FOR INSERT
WITH CHECK (true);

-- Index para performance
CREATE INDEX idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX idx_quiz_results_conversation_id ON public.quiz_results(conversation_id);
CREATE INDEX idx_tutor_reports_student_id ON public.tutor_reports(student_id);
CREATE INDEX idx_tutor_reports_tutor_id ON public.tutor_reports(tutor_id);
CREATE INDEX idx_tutor_reports_created_at ON public.tutor_reports(created_at DESC);