import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DailySale {
  date: string;
  visits: number;
  revenue: number;
}

interface EmployeePerformance {
  employee_name: string;
  services_count: number;
  total_revenue: number;
}

interface ServicePerformance {
  service_name: string;
  times_used: number;
  total_revenue: number;
}

const Reports = () => {
  const [dateRange, setDateRange] = useState("today");
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
  const [servicePerformance, setServicePerformance] = useState<ServicePerformance[]>([]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    return { startDate: startDate.toISOString(), endDate: now.toISOString() };
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    const { startDate, endDate } = getDateRange();

    // Fetch daily sales
    const { data: visits } = await supabase
      .from("visits")
      .select("created_at, final_amount")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (visits) {
      const salesByDate: Record<string, { visits: number; revenue: number }> = {};
      visits.forEach((visit) => {
        const date = new Date(visit.created_at).toLocaleDateString();
        if (!salesByDate[date]) {
          salesByDate[date] = { visits: 0, revenue: 0 };
        }
        salesByDate[date].visits++;
        salesByDate[date].revenue += Number(visit.final_amount);
      });

      setDailySales(
        Object.entries(salesByDate).map(([date, data]) => ({
          date,
          visits: data.visits,
          revenue: data.revenue,
        }))
      );
    }

    // Fetch employee performance
    const { data: visitServices } = await supabase
      .from("visit_services")
      .select(`
        employee_id,
        service_price,
        visit:visits!inner(created_at),
        employee:profiles!visit_services_employee_id_fkey(full_name)
      `)
      .gte("visit.created_at", startDate)
      .lte("visit.created_at", endDate);

    if (visitServices) {
      const employeeStats: Record<string, { count: number; revenue: number }> = {};
      visitServices.forEach((vs: any) => {
        const employeeName = vs.employee?.full_name || "Unknown";
        if (!employeeStats[employeeName]) {
          employeeStats[employeeName] = { count: 0, revenue: 0 };
        }
        employeeStats[employeeName].count++;
        employeeStats[employeeName].revenue += Number(vs.service_price);
      });

      setEmployeePerformance(
        Object.entries(employeeStats).map(([name, data]) => ({
          employee_name: name,
          services_count: data.count,
          total_revenue: data.revenue,
        }))
      );
    }

    // Fetch service performance
    const { data: serviceStats } = await supabase
      .from("visit_services")
      .select(`
        service_id,
        service_price,
        visit:visits!inner(created_at),
        service:services(name)
      `)
      .gte("visit.created_at", startDate)
      .lte("visit.created_at", endDate);

    if (serviceStats) {
      const serviceData: Record<string, { count: number; revenue: number }> = {};
      serviceStats.forEach((vs: any) => {
        const serviceName = vs.service?.name || "Unknown";
        if (!serviceData[serviceName]) {
          serviceData[serviceName] = { count: 0, revenue: 0 };
        }
        serviceData[serviceName].count++;
        serviceData[serviceName].revenue += Number(vs.service_price);
      });

      setServicePerformance(
        Object.entries(serviceData)
          .map(([name, data]) => ({
            service_name: name,
            times_used: data.count,
            total_revenue: data.revenue,
          }))
          .sort((a, b) => b.times_used - a.times_used)
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View salon performance analytics</p>
        </div>

        <div className="w-48">
          <Label htmlFor="dateRange">Date Range</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger id="dateRange">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Daily Sales</TabsTrigger>
          <TabsTrigger value="employees">Employee Performance</TabsTrigger>
          <TabsTrigger value="services">Service Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales Report</CardTitle>
              <CardDescription>Sales breakdown by date</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySales.map((sale) => (
                    <TableRow key={sale.date}>
                      <TableCell>{sale.date}</TableCell>
                      <TableCell className="text-right">{sale.visits}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${sale.revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dailySales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No sales data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Employee Performance</CardTitle>
              <CardDescription>Services performed by each employee</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Services</TableHead>
                    <TableHead className="text-right">Revenue Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeePerformance.map((emp) => (
                    <TableRow key={emp.employee_name}>
                      <TableCell className="font-medium">{emp.employee_name}</TableCell>
                      <TableCell className="text-right">{emp.services_count}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${emp.total_revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {employeePerformance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No employee data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Service Performance</CardTitle>
              <CardDescription>Most popular services and revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Times Used</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicePerformance.map((service) => (
                    <TableRow key={service.service_name}>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell className="text-right">{service.times_used}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${service.total_revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {servicePerformance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No service data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
