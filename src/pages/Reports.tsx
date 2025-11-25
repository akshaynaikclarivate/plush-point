import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, Briefcase, Clock, CreditCard, RefreshCw, TrendingUp } from "lucide-react";

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

interface PeakHour {
  hour: string;
  visits: number;
}

interface PaymentMethodStats {
  method: string;
  count: number;
  total_amount: number;
}

interface CustomerRetention {
  new_customers: number;
  returning_customers: number;
  retention_rate: number;
}

interface AvgTicketValue {
  date: string;
  avg_value: number;
}

const Reports = () => {
  const [dateRange, setDateRange] = useState("today");
  const [selectedReport, setSelectedReport] = useState("sales");
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
  const [servicePerformance, setServicePerformance] = useState<ServicePerformance[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodStats[]>([]);
  const [customerRetention, setCustomerRetention] = useState<CustomerRetention | null>(null);
  const [avgTicketValues, setAvgTicketValues] = useState<AvgTicketValue[]>([]);

  const reportTypes = [
    { id: "sales", label: "Daily Sales", icon: DollarSign },
    { id: "employees", label: "Employees", icon: Users },
    { id: "services", label: "Services", icon: Briefcase },
    { id: "peak", label: "Peak Hours", icon: Clock },
    { id: "payment", label: "Payments", icon: CreditCard },
    { id: "retention", label: "Retention", icon: RefreshCw },
    { id: "ticket", label: "Avg Ticket", icon: TrendingUp },
  ];

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

    // Fetch peak hours
    if (visits) {
      const hourCounts: Record<string, number> = {};
      visits.forEach((visit) => {
        const hour = new Date(visit.created_at).getHours();
        const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
        hourCounts[hourLabel] = (hourCounts[hourLabel] || 0) + 1;
      });

      setPeakHours(
        Object.entries(hourCounts)
          .map(([hour, visits]) => ({ hour, visits }))
          .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
      );
    }

    // Fetch payment method breakdown
    const { data: paymentData } = await supabase
      .from("visits")
      .select("payment_method, final_amount")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (paymentData) {
      const methodStats: Record<string, { count: number; total: number }> = {};
      paymentData.forEach((visit) => {
        const method = visit.payment_method || "Unknown";
        if (!methodStats[method]) {
          methodStats[method] = { count: 0, total: 0 };
        }
        methodStats[method].count++;
        methodStats[method].total += Number(visit.final_amount);
      });

      setPaymentMethods(
        Object.entries(methodStats)
          .map(([method, data]) => ({
            method,
            count: data.count,
            total_amount: data.total,
          }))
          .sort((a, b) => b.count - a.count)
      );
    }

    // Fetch customer retention
    const { data: allVisits } = await supabase
      .from("visits")
      .select("customer_phone, created_at")
      .not("customer_phone", "is", null)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (allVisits) {
      const customerFirstVisit = new Map<string, string>();
      
      allVisits.forEach((visit) => {
        if (!customerFirstVisit.has(visit.customer_phone)) {
          customerFirstVisit.set(visit.customer_phone, visit.created_at);
        } else {
          const firstVisit = customerFirstVisit.get(visit.customer_phone)!;
          if (new Date(visit.created_at) < new Date(firstVisit)) {
            customerFirstVisit.set(visit.customer_phone, visit.created_at);
          }
        }
      });

      let newCustomers = 0;
      let returningCustomers = 0;

      customerFirstVisit.forEach((firstVisit, phone) => {
        const isNewInPeriod = new Date(firstVisit) >= new Date(startDate);
        if (isNewInPeriod) {
          newCustomers++;
        } else {
          returningCustomers++;
        }
      });

      const totalCustomers = newCustomers + returningCustomers;
      const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

      setCustomerRetention({
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        retention_rate: retentionRate,
      });
    }

    // Fetch average ticket value
    if (visits) {
      const dailyTickets: Record<string, { total: number; count: number }> = {};
      visits.forEach((visit) => {
        const date = new Date(visit.created_at).toLocaleDateString();
        if (!dailyTickets[date]) {
          dailyTickets[date] = { total: 0, count: 0 };
        }
        dailyTickets[date].total += Number(visit.final_amount);
        dailyTickets[date].count++;
      });

      setAvgTicketValues(
        Object.entries(dailyTickets).map(([date, data]) => ({
          date,
          avg_value: data.total / data.count,
        }))
      );
    }
  };

  const renderReportContent = () => {
    switch (selectedReport) {
      case "sales":
        return (
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
        );

      case "employees":
        return (
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
        );

      case "services":
        return (
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
        );

      case "peak":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Peak Hours Analysis</CardTitle>
              <CardDescription>Busiest hours of the day</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    <TableHead className="text-right">Number of Visits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peakHours.map((hour) => (
                    <TableRow key={hour.hour}>
                      <TableCell className="font-medium">{hour.hour}</TableCell>
                      <TableCell className="text-right">{hour.visits}</TableCell>
                    </TableRow>
                  ))}
                  {peakHours.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "payment":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Breakdown</CardTitle>
              <CardDescription>Payment preferences and totals</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map((method) => (
                    <TableRow key={method.method}>
                      <TableCell className="font-medium capitalize">{method.method}</TableCell>
                      <TableCell className="text-right">{method.count}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${method.total_amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paymentMethods.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No payment data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "retention":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Customer Retention</CardTitle>
              <CardDescription>New vs returning customers</CardDescription>
            </CardHeader>
            <CardContent>
              {customerRetention ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>New Customers</CardDescription>
                        <CardTitle className="text-3xl">{customerRetention.new_customers}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Returning Customers</CardDescription>
                        <CardTitle className="text-3xl">{customerRetention.returning_customers}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Retention Rate</CardDescription>
                        <CardTitle className="text-3xl">{customerRetention.retention_rate.toFixed(1)}%</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No retention data available</p>
              )}
            </CardContent>
          </Card>
        );

      case "ticket":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Average Ticket Value</CardTitle>
              <CardDescription>Average spend per visit over time</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Average Ticket Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {avgTicketValues.map((ticket) => (
                    <TableRow key={ticket.date}>
                      <TableCell className="font-medium">{ticket.date}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${ticket.avg_value.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {avgTicketValues.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      default:
        return null;
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

      <div className="flex gap-6">
        {/* Left sidebar menu */}
        <div className="w-64 shrink-0">
          <Card>
            <CardHeader>
              <CardTitle>Report Types</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  return (
                    <Button
                      key={report.id}
                      variant={selectedReport === report.id ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedReport(report.id)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {report.label}
                    </Button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="flex-1">
          {renderReportContent()}
        </div>
      </div>
    </div>
  );
};

export default Reports;
