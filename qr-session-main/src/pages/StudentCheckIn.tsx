import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, CheckCircle2, MapPin, BookOpen, Lock } from "lucide-react";
import { toast } from "sonner";

type Step = "classes" | "camera" | "usn" | "done";

interface ClassItem {
  id: string;
  name: string;
  section: string;
  start_time: string;
  end_time: string;
  teacher_id: string;
}

const StudentCheckIn = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("classes");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [usn, setUsn] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Request location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocationError("Location access denied. Please enable location services.")
      );
    } else {
      setLocationError("Geolocation not supported.");
    }
  }, []);

  // Fetch today's classes with active sessions
  useEffect(() => {
    const fetchClasses = async () => {
      const today = new Date().getDay();
      const { data } = await supabase
        .from("classes")
        .select("*")
        .or(`day_of_week.eq.${today},is_all_day.eq.true`)
        .order("start_time");
      setClasses((data as ClassItem[]) || []);
    };
    fetchClasses();
  }, []);

  const isClassNow = (c: ClassItem & { is_all_day?: boolean }) => {
    if (c.is_all_day) return true;
    const now = new Date();
    const [sh, sm] = c.start_time.split(":").map(Number);
    const [eh, em] = c.end_time.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  };

  const formatClassTime = (t: string) => {
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    const ampm = hr >= 12 ? "PM" : "AM";
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`;
  };

  const selectClass = (cls: ClassItem) => {
    if (!isClassNow(cls)) {
      toast.error("You can only check in to classes happening right now.");
      return;
    }
    if (!location) {
      toast.error("Please enable location to check in.");
      return;
    }
    setSelectedClass(cls);
    startCamera();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 480 },
      });
      streamRef.current = stream;
      setStep("camera");
    } catch {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  };

  useEffect(() => {
    if (step === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 480, 480);
      setPhotoData(canvas.toDataURL("image/jpeg", 0.7));
    }
    stopCamera();
    setStep("usn");
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const submitCheckIn = async () => {
    if (!usn.trim() || !studentName.trim()) {
      toast.error("Please enter both your name and USN.");
      return;
    }
    if (!selectedClass) return;
    setLoading(true);

    // Find active session for this class
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("is_active", true)
      .eq("class_id", selectedClass.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      toast.error("No active session for this class. Ask your teacher to start one.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("checkins").insert({
      session_id: session.id,
      usn: usn.trim().toUpperCase(),
      student_name: studentName.trim(),
      photo_url: photoData,
      latitude: location?.lat,
      longitude: location?.lng,
    });

    setLoading(false);
    if (error) {
      toast.error("Check-in failed. Please try again.");
    } else {
      setStep("done");
      toast.success("Checked in successfully!");
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-md space-y-6 animate-fade-in">
        <button onClick={() => step === "classes" ? navigate("/") : setStep("classes")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="h-4 w-4" /> {step === "classes" ? "Home" : "Back"}
        </button>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">Student Check-In</h1>
          <p className="text-sm text-muted-foreground">Select your current class to check in</p>
        </div>

        {/* Location Status */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
          location ? "bg-success/10 text-success" : locationError ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
        }`}>
          <MapPin className="h-4 w-4" />
          {location ? "Location enabled" : locationError || "Requesting location..."}
        </div>

        {/* Class Selection */}
        {step === "classes" && (
          <div className="space-y-3">
            {classes.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <p className="text-muted-foreground text-sm">No classes scheduled today.</p>
              </div>
            ) : (
              classes.map((cls) => {
                const active = isClassNow(cls);
                return (
                  <button
                    key={cls.id}
                    onClick={() => selectClass(cls)}
                    disabled={!active || !location}
                    className={`w-full rounded-2xl border bg-card p-4 shadow-sm text-left transition-all ${
                      active ? "border-primary/40 hover:shadow-md hover:border-primary/60" : "border-border opacity-60"
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {active ? (
                          <BookOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <p className="font-heading font-semibold text-card-foreground">{cls.name}</p>
                      </div>
                      <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {cls.section}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatClassTime(cls.start_time)} — {formatClassTime(cls.end_time)}
                    </p>
                    {!active && (
                      <p className="text-xs text-muted-foreground mt-1 italic">Upcoming — check-in restricted</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Camera */}
        {step === "camera" && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-foreground/5">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-square w-full object-cover" />
              <div className="absolute inset-0 rounded-xl ring-4 ring-primary/20 pointer-events-none" />
            </div>
            <button
              onClick={capturePhoto}
              className="w-full rounded-xl bg-primary px-6 py-3.5 font-heading font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Camera className="h-5 w-5" /> Capture Selfie
            </button>
          </div>
        )}

        {/* USN Input */}
        {step === "usn" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            {photoData && (
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full ring-4 ring-primary/20">
                <img src={photoData} alt="Selfie" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">USN</label>
                <input
                  type="text"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  placeholder="1XX22CS001"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                />
              </div>
            </div>
            <button
              onClick={submitCheckIn}
              disabled={loading}
              className="w-full rounded-xl bg-primary px-6 py-3.5 font-heading font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Check-In"}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="font-heading font-semibold text-lg text-foreground">You're Checked In!</h2>
            <p className="text-muted-foreground text-sm">Your attendance has been recorded.</p>
            <button
              onClick={() => { setStep("classes"); setPhotoData(null); setUsn(""); setStudentName(""); setSelectedClass(null); }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Check in to another class
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCheckIn;
