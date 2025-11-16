import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Briefcase, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    todayVisits: 0,
    todayRevenue: 0,
    activeServices: 0,
    totalEmployees: 0,
  });
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setUserRole(profile?.role ?? null);

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch visits count
      const visitsQuery = supabase
        .from("visits")
        .select("*", { count: "exact" })
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString());

      if (profile?.role !== "admin") {
        visitsQuery.eq("created_by", user.id);
      }

      const { count: visitsCount, data: visitsData } = await visitsQuery;

      // Calculate today's revenue
      const revenue = visitsData?.reduce((sum, visit) => sum + Number(visit.final_amount || 0), 0) || 0;

      // Fetch active services count (admin only)
      let servicesCount = 0;
      if (profile?.role === "admin") {
        const { count } = await supabase
          .from("services")
          .select("*", { count: "exact" })
          .eq("active", true);
        servicesCount = count || 0;
      }

      // Fetch employees count (admin only)
      let employeesCount = 0;
      if (profile?.role === "admin") {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact" })
          .eq("active", true);
        employeesCount = count || 0;
      }

      setStats({
        todayVisits: visitsCount || 0,
        todayRevenue: revenue,
        activeServices: servicesCount,
        totalEmployees: employeesCount,
      });
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Today's Visits",
      value: stats.todayVisits,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Today's Revenue",
      value: `$${stats.todayRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-success",
    },
    ...(userRole === "admin" ? [
      {
        title: "Active Services",
        value: stats.activeServices,
        icon: Briefcase,
        color: "text-accent",
      },
      {
        title: "Total Employees",
        value: stats.totalEmployees,
        icon: TrendingUp,
        color: "text-primary",
      },
    ] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {userRole === "admin" ? "Admin Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {userRole === "admin" 
            ? "Overview of your salon's performance"
            : "Track your daily performance"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use the navigation menu to access different features of the salon management system.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
