import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, LogIn, UserPlus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const REGISTRATION_CODE = "RGMEM00";

const TeacherLogin = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [regCode, setRegCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!employeeId.trim() || !password.trim()) {
      toast.error("Please enter both Employee ID and Password.");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from("teachers")
      .select("id, employee_id, name, password")
      .eq("employee_id", employeeId.trim().toUpperCase())
      .maybeSingle();

    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Try again.");
      return;
    }
    if (!data) {
      toast.error("Employee ID not found. Please register first.");
      return;
    }
    if (data.password !== password) {
      toast.error("Incorrect password.");
      return;
    }

    sessionStorage.setItem("teacher", JSON.stringify({ id: data.id, name: data.name, employeeId: data.employee_id }));
    toast.success(`Welcome, ${data.name}!`);
    navigate("/teacher");
  };

  const handleRegister = async () => {
    if (!name.trim() || !employeeId.trim() || !password.trim() || !regCode.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (regCode.trim() !== REGISTRATION_CODE) {
      toast.error("Invalid registration code.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);

    const { data: existing } = await supabase
      .from("teachers")
      .select("id")
      .eq("employee_id", employeeId.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      toast.error("Employee ID already registered. Please login.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("teachers").insert({
      employee_id: employeeId.trim().toUpperCase(),
      name: name.trim(),
      password: password,
    });

    setLoading(false);
    if (error) {
      toast.error("Registration failed. Try again.");
    } else {
      toast.success("Registered successfully! Please login.");
      setMode("login");
      setName("");
      setRegCode("");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <BookOpen className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {mode === "login" ? "Teacher Login" : "Teacher Registration"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Enter your credentials to continue" : "Register with your employee code"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Registration Code</label>
                <input
                  type="text"
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  placeholder="Enter employee code"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP001"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
            className="w-full rounded-xl bg-primary px-6 py-3.5 font-heading font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Register"}
          </button>
        </div>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); }}
          className="w-full text-center text-sm text-primary hover:underline font-medium"
        >
          {mode === "login" ? "Don't have an account? Register" : "Already registered? Sign In"}
        </button>

        <button onClick={() => navigate("/")} className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </button>
      </div>
    </div>
  );
};

export default TeacherLogin;
