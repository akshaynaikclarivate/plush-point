import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Star } from "lucide-react";

interface DashboardStats {
  todayRevenue: number;
  todayVisits: number;
  avgTicketSize: number;
  monthRevenue: number;
  monthVisits: number;
  bestService: string;
  bestEmployee: string;
  growthRate: number;
}

export const OverviewDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    todayVisits: 0,
    avgTicketSize: 0,
    monthRevenue: 0,
    monthVisits: 0,
    bestService: "-",
    bestEmployee: "-",
    growthRate: 0,
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Today's stats
    const { data: todayVisits } = await supabase
      .from("visits")
      .select("final_amount")
      .gte("created_at", todayStart.toISOString());

    // This month's stats
    const { data: monthVisits } = await supabase
      .from("visits")
      .select("final_amount")
      .gte("created_at", monthStart.toISOString());

    // Last month's stats for growth calculation
    const { data: lastMonthVisits } = await supabase
      .from("visits")
      .select("final_amount")
      .gte("created_at", lastMonthStart.toISOString())
      .lte("created_at", lastMonthEnd.toISOString());

    // Best service today
    const { data: serviceStats } = await supabase
      .from("visit_services")
      .select(`
        service_price,
        visit:visits!inner(created_at),
        service:services(name)
      `)
      .gte("visit.created_at", todayStart.toISOString());

    // Best employee today
    const { data: employeeStats } = await supabase
      .from("visit_services")
      .select(`
        service_price,
        visit:visits!inner(created_at),
        employee:profiles!visit_services_employee_id_fkey(full_name)
      `)
      .gte("visit.created_at", todayStart.toISOString());

    const todayRev = todayVisits?.reduce((sum, v) => sum + Number(v.final_amount), 0) || 0;
    const monthRev = monthVisits?.reduce((sum, v) => sum + Number(v.final_amount), 0) || 0;
    const lastMonthRev = lastMonthVisits?.reduce((sum, v) => sum + Number(v.final_amount), 0) || 0;
    const growth = lastMonthRev > 0 ? ((monthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

    // Calculate best service
    const serviceTotals: Record<string, number> = {};
    serviceStats?.forEach((vs: any) => {
      const name = vs.service?.name || "Unknown";
      serviceTotals[name] = (serviceTotals[name] || 0) + Number(vs.service_price);
    });
    const bestSvc = Object.entries(serviceTotals).sort(([, a], [, b]) => b - a)[0]?.[0] || "-";

    // Calculate best employee
    const employeeTotals: Record<string, number> = {};
    employeeStats?.forEach((vs: any) => {
      const name = vs.employee?.full_name || "Unknown";
      employeeTotals[name] = (employeeTotals[name] || 0) + Number(vs.service_price);
    });
    const bestEmp = Object.entries(employeeTotals).sort(([, a], [, b]) => b - a)[0]?.[0] || "-";

    setStats({
      todayRevenue: todayRev,
      todayVisits: todayVisits?.length || 0,
      avgTicketSize: todayVisits?.length ? todayRev / todayVisits.length : 0,
      monthRevenue: monthRev,
      monthVisits: monthVisits?.length || 0,
      bestService: bestSvc,
      bestEmployee: bestEmp,
      growthRate: growth,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Overview Dashboard</h2>
        <p className="text-muted-foreground">Key performance metrics at a glance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.todayRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{stats.todayVisits} visits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Ticket</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgTicketSize.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per visit today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthRevenue.toFixed(2)}</div>
            <p className={`text-xs ${stats.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.growthRate >= 0 ? '+' : ''}{stats.growthRate.toFixed(1)}% vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Month Visits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthVisits}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Best Service Today</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.bestService}</div>
            <p className="text-xs text-muted-foreground">Highest revenue generator</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Best Employee Today</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.bestEmployee}</div>
            <p className="text-xs text-muted-foreground">Top performer</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
