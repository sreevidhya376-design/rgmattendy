import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, QrCode, BarChart3, Users, BookOpen, LogOut, UserPlus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Teacher {
  id: string;
  name: string;
  employeeId: string;
}

interface ClassItem {
  id: string;
  name: string;
  section: string;
  start_time: string;
  end_time: string;
  strength: number;
  day_of_week: number;
  is_all_day: boolean;
}

interface SessionForClass {
  class_id: string;
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessionsToday, setSessionsToday] = useState<SessionForClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);
  const [qrRefresh, setQrRefresh] = useState(16);
  const [isActive, setIsActive] = useState(false);
  const [checkinCount, setCheckinCount] = useState(0);

  // Manage students
  const [showManageStudents, setShowManageStudents] = useState(false);
  const [manageClassId, setManageClassId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<{ id: string; usn: string; student_name: string }[]>([]);
  const [newUsn, setNewUsn] = useState("");
  const [newStudentName, setNewStudentName] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("teacher");
    if (!stored) {
      navigate("/teacher/login");
      return;
    }
    setTeacher(JSON.parse(stored));
  }, [navigate]);

  // Fetch today's classes
  useEffect(() => {
    if (!teacher) return;
    const today = new Date().getDay();

    const fetchClasses = async () => {
      const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", teacher.id)
        .or(`day_of_week.eq.${today},is_all_day.eq.true`)
        .order("start_time");
      setClasses((data as ClassItem[]) || []);
    };

    const fetchSessionsToday = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("teacher_id", teacher.id)
        .gte("started_at", todayStart.toISOString());
      setSessionsToday((data as SessionForClass[]) || []);
    };

    fetchClasses();
    fetchSessionsToday();
  }, [teacher]);

  const isClassNow = (c: ClassItem) => {
    if (c.is_all_day) return true;
    const now = new Date();
    const [sh, sm] = c.start_time.split(":").map(Number);
    const [eh, em] = c.end_time.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  };

  const hasSessionToday = (classId: string) =>
    sessionsToday.some((s) => s.class_id === classId);

  const startSession = async (cls: ClassItem) => {
    if (!teacher) return;
    const code = crypto.randomUUID();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ qr_code: code, teacher_name: teacher.name, class_id: cls.id, teacher_id: teacher.id })
      .select()
      .single();

    if (!error && data) {
      setSelectedClass(cls);
      setSessionId(data.id);
      setQrValue(data.id + "|" + code);
      setIsActive(true);
      setTimeLeft(600);
      setQrRefresh(16);
      setSessionsToday((prev) => [...prev, { class_id: cls.id }]);
    }
  };

  const endSession = async () => {
    if (sessionId) {
      await supabase.from("sessions").update({ is_active: false }).eq("id", sessionId);
    }
    setIsActive(false);
    setSessionId(null);
    setQrValue("");
    setSelectedClass(null);
  };

  const refreshQR = useCallback(async () => {
    if (!sessionId) return;
    const newCode = crypto.randomUUID();
    await supabase.from("sessions").update({ qr_code: newCode }).eq("id", sessionId);
    setQrValue(sessionId + "|" + newCode);
    setQrRefresh(16);
  }, [sessionId]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { endSession(); return 0; }
        return prev - 1;
      });
      setQrRefresh((prev) => {
        if (prev <= 1) { refreshQR(); return 16; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, refreshQR]);

  // Poll checkin count
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from("checkins")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      setCheckinCount(count || 0);
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const formatClassTime = (t: string) => {
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    const ampm = hr >= 12 ? "PM" : "AM";
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`;
  };

  const logout = () => {
    sessionStorage.removeItem("teacher");
    navigate("/");
  };

  // Manage students
  const openManageStudents = async (classId: string) => {
    setManageClassId(classId);
    setShowManageStudents(true);
    const { data } = await supabase.from("class_students").select("*").eq("class_id", classId);
    setClassStudents(data || []);
  };

  const addStudent = async () => {
    if (!newUsn.trim() || !manageClassId) return;
    const { error } = await supabase.from("class_students").insert({
      class_id: manageClassId,
      usn: newUsn.trim().toUpperCase(),
      student_name: newStudentName.trim(),
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "USN already added." : "Failed to add student.");
    } else {
      toast.success("Student added.");
      setNewUsn("");
      setNewStudentName("");
      const { data } = await supabase.from("class_students").select("*").eq("class_id", manageClassId);
      setClassStudents(data || []);
    }
  };

  const removeStudent = async (id: string) => {
    await supabase.from("class_students").delete().eq("id", id);
    setClassStudents((prev) => prev.filter((s) => s.id !== id));
  };

  if (!teacher) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-md space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/analytics")} className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
              <BarChart3 className="h-4 w-4" /> Analytics
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">Hi, {teacher.name}</h1>
          <p className="text-sm text-muted-foreground">Today's Schedule</p>
        </div>

        {/* Active Session */}
        {isActive && selectedClass && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-accent p-3 text-center">
              <p className="text-sm font-heading font-semibold text-primary">
                {selectedClass.name} — {selectedClass.section}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm space-y-4">
              <div className="inline-block rounded-xl bg-background p-4 shadow-inner">
                <QRCodeSVG value={qrValue} size={200} level="H" />
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> QR refreshes in {qrRefresh}s
              </div>
            </div>

            {/* Strength Progress */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-heading font-semibold text-foreground">Check-in Progress</p>
                <span className="text-sm font-heading font-bold text-primary">
                  {checkinCount}/{selectedClass.strength}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min((checkinCount / selectedClass.strength) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedClass.strength - checkinCount > 0
                  ? `${selectedClass.strength - checkinCount} students remaining`
                  : "All students checked in!"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
                <p className="text-2xl font-heading font-bold text-foreground">{formatTime(timeLeft)}</p>
                <p className="text-xs text-muted-foreground mt-1">Time Left</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
                <p className="text-2xl font-heading font-bold text-primary">{checkinCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Checked In</p>
              </div>
            </div>

            <button
              onClick={endSession}
              className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-3 font-heading font-semibold text-destructive transition-all hover:bg-destructive/20 active:scale-[0.98]"
            >
              End Session
            </button>
          </div>
        )}

        {/* Class List */}
        {!isActive && (
          <div className="space-y-3">
            {classes.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <p className="text-muted-foreground text-sm">No classes scheduled for today.</p>
              </div>
            ) : (
              classes.map((cls) => {
                const active = isClassNow(cls);
                const done = hasSessionToday(cls.id);
                return (
                  <div key={cls.id} className={`rounded-2xl border bg-card p-4 shadow-sm transition-all ${active ? "border-primary/40" : "border-border"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="font-heading font-semibold text-card-foreground">{cls.name}</p>
                      </div>
                      <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {cls.section}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {formatClassTime(cls.start_time)} — {formatClassTime(cls.end_time)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Users className="h-3 w-3" /> {cls.strength} students
                    </div>
                    <div className="flex gap-2">
                      {done ? (
                        <span className="flex-1 text-center rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
                          Session Completed ✓
                        </span>
                      ) : active ? (
                        <button
                          onClick={() => startSession(cls)}
                          className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-heading font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] text-sm"
                        >
                          Start Session
                        </button>
                      ) : (
                        <span className="flex-1 text-center rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
                          Not Active Yet
                        </span>
                      )}
                      <button
                        onClick={() => openManageStudents(cls.id)}
                        className="rounded-xl bg-secondary px-3 py-2.5 text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Manage Students Modal */}
        {showManageStudents && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm px-4 pb-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-heading font-semibold text-foreground">Manage Students</h2>
                <button onClick={() => setShowManageStudents(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div className="flex gap-2">
                  <input
                    value={newUsn}
                    onChange={(e) => setNewUsn(e.target.value)}
                    placeholder="USN"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                  />
                  <input
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button onClick={addStudent} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm font-medium hover:opacity-90">
                    Add
                  </button>
                </div>
                {classStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No students added yet.</p>
                ) : (
                  classStudents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.student_name || s.usn}</p>
                        <p className="text-xs text-muted-foreground">{s.usn}</p>
                      </div>
                      <button onClick={() => removeStudent(s.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
