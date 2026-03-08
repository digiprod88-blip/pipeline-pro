import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { format, isSameDay, addMinutes, parse, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function useMathChallenge() {
  const [a] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [b] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [answer, setAnswer] = useState("");
  const isValid = Number(answer) === a + b;
  return { question: `${a} + ${b} = ?`, answer, setAnswer, isValid };
}

export default function BookingPage() {
  const { userId } = useParams<{ userId: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"date" | "details" | "done">("date");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const captcha = useMathChallenge();

  const { data: slots } = useQuery({
    queryKey: ["public-booking-slots", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_slots")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: existingAppts } = useQuery({
    queryKey: ["public-appointments", userId, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("user_id", userId!)
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEnd.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!selectedDate,
  });

  const { data: profile } = useQuery({
    queryKey: ["booking-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId!)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!userId,
  });

  // Generate time slots for selected date
  const availableTimeSlots = (() => {
    if (!selectedDate || !slots) return [];
    const dayOfWeek = selectedDate.getDay();
    const daySlots = slots.filter(s => s.day_of_week === dayOfWeek);
    if (daySlots.length === 0) return [];

    const timeSlots: string[] = [];
    for (const slot of daySlots) {
      const start = parse(slot.start_time, "HH:mm:ss", selectedDate);
      const end = parse(slot.end_time, "HH:mm:ss", selectedDate);
      let current = start;
      while (isBefore(current, end)) {
        const slotEnd = addMinutes(current, 30);
        // Check if this slot conflicts with existing appointments
        const timeStr = format(current, "HH:mm");
        const slotStart = new Date(selectedDate);
        slotStart.setHours(current.getHours(), current.getMinutes(), 0, 0);
        const isBooked = existingAppts?.some(appt => {
          const apptStart = new Date(appt.start_time);
          const apptEnd = new Date(appt.end_time);
          return slotStart >= apptStart && slotStart < apptEnd;
        });
        if (!isBooked && isAfter(slotEnd, new Date())) {
          timeSlots.push(timeStr);
        }
        current = slotEnd;
      }
    }
    return timeSlots;
  })();

  // Which days have availability
  const availableDays = slots?.map(s => s.day_of_week) || [];
  const isDateAvailable = (date: Date) => {
    return availableDays.includes(date.getDay()) && isAfter(date, new Date(new Date().setHours(0, 0, 0, 0)));
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot || !form.name || !form.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const startTime = new Date(selectedDate);
      const [h, m] = selectedSlot.split(":").map(Number);
      startTime.setHours(h, m, 0, 0);
      const endTime = addMinutes(startTime, 30);

      const res = await supabase.functions.invoke("book-appointment", {
        body: {
          user_id: userId,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          notes: form.notes || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        },
      });
      if (res.error) throw res.error;
      setStep("done");
      toast.success("Appointment booked!");
    } catch (err: any) {
      toast.error(err.message || "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center p-8">
          <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
          <h2 className="text-xl font-semibold mb-2">Booking Confirmed!</h2>
          <p className="text-muted-foreground text-sm">
            Your appointment on{" "}
            <span className="font-medium text-foreground">
              {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
            </span>{" "}
            at <span className="font-medium text-foreground">{selectedSlot}</span> has been confirmed.
          </p>
          <p className="text-xs text-muted-foreground mt-4">A confirmation will be sent to {form.email}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <CalendarDays className="h-10 w-10 mx-auto text-primary mb-3" />
          <h1 className="text-2xl font-semibold">
            Book a Meeting{profile?.full_name ? ` with ${profile.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Select a date and time that works for you</p>
        </div>

        {step === "date" && (
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <Card>
              <CardContent className="p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                  disabled={(date) => !isDateAvailable(date)}
                  className="pointer-events-auto"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a date"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedDate && (
                  <p className="text-sm text-muted-foreground">Pick a date from the calendar</p>
                )}
                {selectedDate && availableTimeSlots.length === 0 && (
                  <p className="text-sm text-muted-foreground">No available slots for this day</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {availableTimeSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedSlot === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSlot(time)}
                      className="text-sm"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
                {selectedSlot && (
                  <Button className="w-full mt-4" onClick={() => setStep("details")}>
                    Continue
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === "details" && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-base">Your Details</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{selectedDate && format(selectedDate, "MMM d, yyyy")}</Badge>
                <Badge variant="outline">{selectedSlot}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="What would you like to discuss?" />
              </div>
              <div>
                <Label>Security Check: {captcha.question}</Label>
                <Input
                  type="number"
                  value={captcha.answer}
                  onChange={(e) => captcha.setAnswer(e.target.value)}
                  placeholder="Your answer"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("date")} className="flex-1">Back</Button>
                <Button onClick={handleBook} disabled={loading || !form.name || !form.email || !captcha.isValid} className="flex-1">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
