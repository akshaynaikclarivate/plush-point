import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DiscountStats {
  totalDiscount: number;
  totalRevenue: number;
  discountPercentage: number;
  discountsByStaff: Array<{
    staff_name: string;
    discount_amount: number;
    visit_count: number;
  }>;
  discountsByService: Array<{
    service_name: string;
    discount_amount: number;
    times_discounted: number;
  }>;
}

interface DiscountReportProps {
  dateRange: { startDate: string; endDate: string };
}

export const DiscountReport = ({ dateRange }: DiscountReportProps) => {
  const [stats, setStats] = useState<DiscountStats>({
    totalDiscount: 0,
    totalRevenue: 0,
    discountPercentage: 0,
    discountsByStaff: [],
    discountsByService: [],
  });

  useEffect(() => {
    fetchDiscountStats();
  }, [dateRange]);

  const fetchDiscountStats = async () => {
    const { startDate, endDate } = dateRange;

    // Get all visits with discounts
    const { data: visits } = await supabase
      .from("visits")
      .select("discount, total_amount, final_amount, created_by")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .gt("discount", 0);

    if (!visits) return;

    const totalDiscount = visits.reduce((sum, v) => sum + (Number(v.discount) || 0), 0);
    const totalRevenue = visits.reduce((sum, v) => sum + Number(v.total_amount), 0);

    // Get discounts by staff
    const { data: staffVisits } = await supabase
      .from("visits")
      .select(`
        discount,
        created_by,
        creator:profiles!visits_created_by_fkey(full_name)
      `)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .gt("discount", 0);

    const staffDiscounts: Record<string, { amount: number; count: number }> = {};
    staffVisits?.forEach((v: any) => {
      const name = v.creator?.full_name || "Unknown";
      if (!staffDiscounts[name]) {
        staffDiscounts[name] = { amount: 0, count: 0 };
      }
      staffDiscounts[name].amount += Number(v.discount);
      staffDiscounts[name].count++;
    });

    setStats({
      totalDiscount,
      totalRevenue,
      discountPercentage: totalRevenue > 0 ? (totalDiscount / totalRevenue) * 100 : 0,
      discountsByStaff: Object.entries(staffDiscounts)
        .map(([name, data]) => ({
          staff_name: name,
          discount_amount: data.amount,
          visit_count: data.count,
        }))
        .sort((a, b) => b.discount_amount - a.discount_amount),
      discountsByService: [],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Discount Report</h2>
        <p className="text-muted-foreground">Track discount usage and revenue impact</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Discounts Given</CardDescription>
            <CardTitle className="text-3xl">${stats.totalDiscount.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue (Before Discount)</CardDescription>
            <CardTitle className="text-3xl">${stats.totalRevenue.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Discount % of Revenue</CardDescription>
            <CardTitle className="text-3xl">{stats.discountPercentage.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discounts by Staff</CardTitle>
          <CardDescription>Staff members who applied discounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead className="text-right">Visits with Discount</TableHead>
                <TableHead className="text-right">Total Discount Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.discountsByStaff.map((staff) => (
                <TableRow key={staff.staff_name}>
                  <TableCell className="font-medium">{staff.staff_name}</TableCell>
                  <TableCell className="text-right">{staff.visit_count}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${staff.discount_amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {stats.discountsByStaff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No discount data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
