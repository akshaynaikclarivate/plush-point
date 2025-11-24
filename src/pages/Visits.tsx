import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
}

interface Employee {
  id: string;
  full_name: string;
}

interface CustomerMatch {
  customer_name: string;
  customer_phone: string;
}

const Visits = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [serviceEmployees, setServiceEmployees] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [matchingCustomers, setMatchingCustomers] = useState<CustomerMatch[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch active services
      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, price, category_id")
        .eq("active", true)
        .order("name");

      if (servicesData) setServices(servicesData);

      // Fetch active employees
      const { data: employeesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");

      if (employeesData) setEmployees(employeesData);
    };

    fetchData();
  }, []);

  const toggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
      const newServiceEmployees = { ...serviceEmployees };
      delete newServiceEmployees[serviceId];
      setServiceEmployees(newServiceEmployees);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const setEmployeeForService = (serviceId: string, employeeId: string) => {
    setServiceEmployees({
      ...serviceEmployees,
      [serviceId]: employeeId,
    });
  };

  const handlePhoneChange = async (phone: string) => {
    setCustomerPhone(phone);
    setCustomerName(""); // Clear name when phone changes
    
    if (phone.length >= 3) {
      const { data } = await supabase
        .from("visits")
        .select("customer_name, customer_phone")
        .ilike("customer_phone", `%${phone}%`)
        .order("created_at", { ascending: false });
      
      if (data && data.length > 0) {
        // Remove duplicates by phone number
        const uniqueCustomers = data.reduce((acc: CustomerMatch[], current) => {
          const exists = acc.find(item => item.customer_phone === current.customer_phone);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        setMatchingCustomers(uniqueCustomers);
        setShowDropdown(true);
      } else {
        setMatchingCustomers([]);
        setShowDropdown(false);
      }
    } else {
      setMatchingCustomers([]);
      setShowDropdown(false);
    }
  };

  const handleCustomerSelect = (customer: CustomerMatch) => {
    setCustomerPhone(customer.customer_phone);
    setCustomerName(customer.customer_name);
    setShowDropdown(false);
    toast.success(`Selected: ${customer.customer_name}`);
  };

  const calculateTotal = () => {
    return Array.from(selectedServices).reduce((sum, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return sum + (service?.price || 0);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const customerName = formData.get("customerName") as string;
    const customerPhone = formData.get("customerPhone") as string;
    const customerNotes = formData.get("customerNotes") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const discount = parseFloat(formData.get("discount") as string) || 0;

    // Validate that all selected services have assigned employees
    for (const serviceId of selectedServices) {
      if (!serviceEmployees[serviceId]) {
        toast.error("Please assign an employee to all selected services");
        setLoading(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const totalAmount = calculateTotal();
    const finalAmount = totalAmount - discount;

    // Create visit
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_notes: customerNotes,
        total_amount: totalAmount,
        discount: discount,
        final_amount: finalAmount,
        payment_method: paymentMethod,
        payment_status: "completed",
        created_by: user.id,
      })
      .select()
      .single();

    if (visitError) {
      toast.error("Failed to create visit");
      setLoading(false);
      return;
    }

    // Create visit services
    const visitServices = Array.from(selectedServices).map(serviceId => {
      const service = services.find(s => s.id === serviceId);
      return {
        visit_id: visit.id,
        service_id: serviceId,
        employee_id: serviceEmployees[serviceId],
        service_price: service?.price || 0,
      };
    });

    const { error: servicesError } = await supabase
      .from("visit_services")
      .insert(visitServices);

    if (servicesError) {
      toast.error("Failed to save services");
      setLoading(false);
      return;
    }

    toast.success("Visit recorded successfully!");
    navigate("/");
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Customer Visit</h1>
        <p className="text-muted-foreground">Record a new walk-in customer</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Enter customer details and select services</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 relative">
                <Label htmlFor="customerPhone">Phone Number (Optional)</Label>
                <Input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  placeholder="+1234567890"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onFocus={() => matchingCustomers.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  autoComplete="off"
                />
                
                {showDropdown && matchingCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    <ul className="py-1">
                      {matchingCustomers.map((customer, index) => (
                        <li
                          key={index}
                          className="px-4 py-2 hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-foreground">{customer.customer_name}</span>
                            <span className="text-sm text-muted-foreground">{customer.customer_phone}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  placeholder="John Doe"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerNotes">Notes (Optional)</Label>
              <Textarea
                id="customerNotes"
                name="customerNotes"
                placeholder="Any special requests or notes..."
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <Label>Select Services</Label>
              <div className="space-y-3 rounded-lg border p-4">
                {services.map((service) => (
                  <div key={service.id} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={service.id}
                        checked={selectedServices.has(service.id)}
                        onCheckedChange={() => toggleService(service.id)}
                      />
                      <label
                        htmlFor={service.id}
                        className="flex-1 cursor-pointer text-sm font-medium"
                      >
                        {service.name} - ${service.price}
                      </label>
                    </div>

                    {selectedServices.has(service.id) && (
                      <div className="ml-6">
                        <Select
                          value={serviceEmployees[service.id]}
                          onValueChange={(value) => setEmployeeForService(service.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Assign employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select name="paymentMethod" defaultValue="cash" required>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">Discount ($)</Label>
                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || selectedServices.size === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Visit
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default Visits;
