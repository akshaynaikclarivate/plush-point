import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CustomerData {
  customer_name: string;
  customer_phone: string;
  total_visits: number;
  total_spending: number;
  last_visit: string;
}

const Customers = () => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("visits")
        .select("customer_name, customer_phone, final_amount, check_in_time")
        .not("customer_phone", "is", null);

      if (startDate) {
        query = query.gte("check_in_time", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("check_in_time", endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate customer data
      const customerMap = new Map<string, CustomerData>();

      data?.forEach((visit) => {
        const key = visit.customer_phone;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customer_name: visit.customer_name || "Unknown",
            customer_phone: visit.customer_phone,
            total_visits: 0,
            total_spending: 0,
            last_visit: visit.check_in_time,
          });
        }

        const customer = customerMap.get(key)!;
        customer.total_visits += 1;
        customer.total_spending += Number(visit.final_amount);
        
        if (new Date(visit.check_in_time) > new Date(customer.last_visit)) {
          customer.last_visit = visit.check_in_time;
        }
      });

      const customerList = Array.from(customerMap.values()).sort(
        (a, b) => b.total_spending - a.total_spending
      );

      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (error: any) {
      toast.error("Failed to load customers: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [startDate, endDate]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(
        (customer) =>
          customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.customer_phone.includes(searchTerm)
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchTerm("");
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Customers</h1>
        <p className="text-muted-foreground">View and manage customer information</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 flex items-end">
              <Button onClick={clearFilters} variant="outline" className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer List ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading customers...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No customers found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Total Visits</TableHead>
                  <TableHead className="text-right">Total Spending</TableHead>
                  <TableHead>Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                    <TableCell>{customer.customer_phone}</TableCell>
                    <TableCell className="text-right">{customer.total_visits}</TableCell>
                    <TableCell className="text-right">
                      ${customer.total_spending.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(customer.last_visit), "PPP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Customers;
