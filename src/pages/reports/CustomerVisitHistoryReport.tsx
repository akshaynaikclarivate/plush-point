import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface CustomerHistory {
  customer_phone: string;
  customer_name: string;
  last_visit: string;
  total_visits: number;
  total_spent: number;
  avg_spend: number;
  services_taken: string[];
}

export const CustomerVisitHistoryReport = () => {
  const [customers, setCustomers] = useState<CustomerHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCustomerHistory();
  }, []);

  const fetchCustomerHistory = async () => {
    const { data: visits } = await supabase
      .from("visits")
      .select(`
        customer_phone,
        customer_name,
        created_at,
        final_amount,
        visit_services(
          service:services(name)
        )
      `)
      .not("customer_phone", "is", null)
      .order("created_at", { ascending: false });

    if (!visits) return;

    const customerMap = new Map<string, CustomerHistory>();

    visits.forEach((visit: any) => {
      const phone = visit.customer_phone;
      const existing = customerMap.get(phone);

      const services = visit.visit_services?.map((vs: any) => vs.service?.name).filter(Boolean) || [];

      if (existing) {
        existing.total_visits++;
        existing.total_spent += Number(visit.final_amount);
        existing.services_taken = Array.from(new Set([...existing.services_taken, ...services]));
        if (new Date(visit.created_at) > new Date(existing.last_visit)) {
          existing.last_visit = visit.created_at;
          existing.customer_name = visit.customer_name || existing.customer_name;
        }
      } else {
        customerMap.set(phone, {
          customer_phone: phone,
          customer_name: visit.customer_name || "Unknown",
          last_visit: visit.created_at,
          total_visits: 1,
          total_spent: Number(visit.final_amount),
          avg_spend: Number(visit.final_amount),
          services_taken: services,
        });
      }
    });

    const customerList = Array.from(customerMap.values()).map((c) => ({
      ...c,
      avg_spend: c.total_spent / c.total_visits,
    }));

    setCustomers(customerList.sort((a, b) => b.total_spent - a.total_spent));
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Customer Visit History</h2>
        <p className="text-muted-foreground">Detailed history and insights per customer</p>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Records</CardTitle>
          <CardDescription>Complete visit history for all customers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead className="text-right">Total Visits</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Avg Spend</TableHead>
                <TableHead>Services Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.customer_phone}>
                  <TableCell className="font-medium">{customer.customer_name}</TableCell>
                  <TableCell>{customer.customer_phone}</TableCell>
                  <TableCell>{new Date(customer.last_visit).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">{customer.total_visits}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${customer.total_spent.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">${customer.avg_spend.toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.services_taken.slice(0, 3).join(", ")}
                    {customer.services_taken.length > 3 && "..."}
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No customer data available
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
