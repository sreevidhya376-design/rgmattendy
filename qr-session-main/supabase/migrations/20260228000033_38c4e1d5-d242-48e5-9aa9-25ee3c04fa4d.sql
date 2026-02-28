
-- Teachers table
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read teachers" ON public.teachers FOR SELECT USING (true);

-- Classes table
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  section text NOT NULL,
  day_of_week int NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  strength int NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read classes" ON public.classes FOR SELECT USING (true);

-- Class students (teacher adds students to classes)
CREATE TABLE public.class_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  usn text NOT NULL,
  student_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, usn)
);

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read class_students" ON public.class_students FOR SELECT USING (true);
CREATE POLICY "Anyone can insert class_students" ON public.class_students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update class_students" ON public.class_students FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete class_students" ON public.class_students FOR DELETE USING (true);

-- Add class_id and teacher_id to sessions
ALTER TABLE public.sessions ADD COLUMN class_id uuid REFERENCES public.classes(id);
ALTER TABLE public.sessions ADD COLUMN teacher_id uuid REFERENCES public.teachers(id);

-- Add location fields to checkins
ALTER TABLE public.checkins ADD COLUMN latitude double precision;
ALTER TABLE public.checkins ADD COLUMN longitude double precision;

-- Insert demo teachers
INSERT INTO public.teachers (employee_id, name, password) VALUES
  ('EMP001', 'Dr. Priya Sharma', 'teacher123'),
  ('EMP002', 'Prof. Rajesh Kumar', 'teacher123');

-- Insert demo classes for EMP001 across the week
INSERT INTO public.classes (teacher_id, name, section, day_of_week, start_time, end_time, strength)
SELECT t.id, c.name, c.section, c.dow, c.st::time, c.et::time, c.str
FROM public.teachers t
CROSS JOIN (VALUES
  ('Data Structures', 'A1', 1, '09:00', '10:00', 60),
  ('Algorithms', 'A2', 1, '10:00', '11:00', 45),
  ('Database Systems', 'B1', 2, '09:00', '10:00', 55),
  ('Data Structures', 'A1', 2, '11:00', '12:00', 60),
  ('Operating Systems', 'A1', 3, '09:00', '10:00', 60),
  ('Algorithms', 'A2', 3, '14:00', '15:00', 45),
  ('Computer Networks', 'B2', 4, '09:00', '10:00', 50),
  ('Database Systems', 'B1', 4, '11:00', '12:00', 55),
  ('Software Engineering', 'A1', 5, '09:00', '10:00', 60),
  ('Data Structures', 'A1', 5, '11:00', '12:00', 60),
  ('Operating Systems', 'A1', 5, '14:00', '15:00', 60),
  ('Data Structures', 'A1', 6, '09:00', '10:00', 60),
  ('Algorithms', 'A2', 6, '10:00', '11:00', 45),
  ('Data Structures', 'A1', 0, '10:00', '11:00', 60)
) AS c(name, section, dow, st, et, str)
WHERE t.employee_id = 'EMP001';

-- Insert demo classes for EMP002
INSERT INTO public.classes (teacher_id, name, section, day_of_week, start_time, end_time, strength)
SELECT t.id, c.name, c.section, c.dow, c.st::time, c.et::time, c.str
FROM public.teachers t
CROSS JOIN (VALUES
  ('Machine Learning', 'C1', 1, '11:00', '12:00', 40),
  ('AI Fundamentals', 'C2', 2, '10:00', '11:00', 50),
  ('Machine Learning', 'C1', 3, '11:00', '12:00', 40),
  ('AI Fundamentals', 'C2', 4, '14:00', '15:00', 50),
  ('Machine Learning', 'C1', 5, '10:00', '11:00', 40)
) AS c(name, section, dow, st, et, str)
WHERE t.employee_id = 'EMP002';
