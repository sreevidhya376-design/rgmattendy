import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, AlertTriangle, MapPin } from "lucide-react";

interface StudentRecord {
  usn: string;
  student_name: string;
  total_sessions: number;
  attended: number;
  percentage: number;
  lastLocation: { lat: number; lng: number } | null;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { count: totalSessions } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true });

      const { data: checkins } = await supabase
        .from("checkins")
        .select("usn, student_name, session_id, latitude, longitude");

      if (!checkins || !totalSessions) {
        setLoading(false);
        return;
      }

      const map = new Map<string, { name: string; sessions: Set<string>; lat: number | null; lng: number | null }>();
      for (const c of checkins) {
        if (!map.has(c.usn)) {
          map.set(c.usn, { name: c.student_name, sessions: new Set(), lat: null, lng: null });
        }
        const entry = map.get(c.usn)!;
        entry.sessions.add(c.session_id);
        if (c.latitude && c.longitude) {
          entry.lat = c.latitude;
          entry.lng = c.longitude;
        }
      }

      const records: StudentRecord[] = Array.from(map.entries()).map(
        ([usn, { name, sessions, lat, lng }]) => ({
          usn,
          student_name: name,
          total_sessions: totalSessions,
          attended: sessions.size,
          percentage: Math.round((sessions.size / totalSessions) * 100),
          lastLocation: lat && lng ? { lat, lng } : null,
        })
      );

      records.sort((a, b) => a.usn.localeCompare(b.usn));
      setStudents(records);
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
        <button onClick={() => navigate("/teacher")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">Engagement Analytics</h1>
          <p className="text-sm text-muted-foreground">Student attendance overview</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No attendance data yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((s) => {
              const isLow = s.percentage < 75;
              return (
                <div
                  key={s.usn}
                  className={`rounded-2xl border bg-card p-4 shadow-sm transition-all ${
                    isLow ? "border-destructive/30 bg-destructive/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-heading font-semibold text-card-foreground">{s.student_name || s.usn}</p>
                      <p className="text-xs text-muted-foreground">{s.usn}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      <span className={`font-heading font-bold text-lg ${isLow ? "text-destructive" : "text-success"}`}>
                        {s.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${isLow ? "bg-destructive" : "bg-success"}`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{s.attended} / {s.total_sessions} sessions</p>
                    {s.lastLocation && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {s.lastLocation.lat.toFixed(4)}, {s.lastLocation.lng.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
