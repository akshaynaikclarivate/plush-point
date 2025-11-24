import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "employee";
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setLoading(false);
          return;
        }

        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role with error handling
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          
          if (profileError) {
            console.error("Profile fetch error:", profileError);
            // Fallback to user_metadata role if profile fetch fails
            const metadataRole = session.user.user_metadata?.role;
            setUserRole(metadataRole ?? "employee");
          } else {
            setUserRole(profile?.role ?? "employee");
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          
          if (profileError) {
            console.error("Profile fetch error on auth change:", profileError);
            const metadataRole = session.user.user_metadata?.role;
            setUserRole(metadataRole ?? "employee");
          } else {
            setUserRole(profile?.role ?? "employee");
          }
        } else {
          setUserRole(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth state change error:", error);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
