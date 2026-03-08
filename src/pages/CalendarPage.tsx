import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CalendarDays, Clock, MapPin, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, addHours, isSameDay } from "date-fns";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [openAppt, setOpenAppt] = useState(false);
  const [openSlots, setOpenSlots] = useState(false);

  const [apptForm, setApptForm] = useState({
    title: "", description: "", start_time: "", end_time: "", location: "",
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*, contacts(first_name, last_name)").order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: bookingSlots } = useQuery({
    queryKey: ["booking-slots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("booking_slots").select("*").order("day_of_week");
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, first_name, last_name").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const [selectedContact, setSelectedContact] = useState<string>("");

  const createAppointment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").insert({
        user_id: user!.id,
        contact_id: selectedContact || null,
        title: apptForm.title,
        description: apptForm.description || null,
        start_time: apptForm.start_time,
        end_time: apptForm.end_time,
        location: apptForm.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setOpenAppt(false);
      setApptForm({ title: "", description: "", start_time: "", end_time: "", location: "" });
      setSelectedContact("");
      toast.success("Appointment created!");
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted");
    },
  });

  const saveSlot = useMutation({
    mutationFn: async (slot: { day_of_week: number; start_time: string; end_time: string }) => {
      const { error } = await supabase.from("booking_slots").insert({ user_id: user!.id, ...slot });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      toast.success("Slot added");
    },
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booking_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      toast.success("Slot removed");
    },
  });

  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });

  const dayAppointments = appointments?.filter(a => isSameDay(new Date(a.start_time), selectedDate)) || [];

  const bookingUrl = `${window.location.origin}/book/${user?.id}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar & Appointments</h1>
          <p className="text-muted-foreground text-sm">Manage your schedule and booking availability</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openSlots} onOpenChange={setOpenSlots}>
            <DialogTrigger asChild>
              <Button variant="outline"><Clock className="h-4 w-4 mr-2" />Booking Slots</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Available Booking Slots</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <Copy className="h-3 w-3" />
                  <span className="truncate">{bookingUrl}</span>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success("Link copied!"); }}>Copy</Button>
                </div>

                <div className="space-y-2">
                  {bookingSlots?.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between text-sm border-b border-border pb-1">
                      <span>{DAYS[slot.day_of_week]} {slot.start_time} - {slot.end_time}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteSlot.mutate(slot.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 items-end">
                  <div>
                    <Label>Day</Label>
                    <Select value={String(newSlot.day_of_week)} onValueChange={v => setNewSlot({ ...newSlot, day_of_week: parseInt(v) })}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>From</Label><Input type="time" value={newSlot.start_time} onChange={e => setNewSlot({ ...newSlot, start_time: e.target.value })} /></div>
                  <div><Label>To</Label><Input type="time" value={newSlot.end_time} onChange={e => setNewSlot({ ...newSlot, end_time: e.target.value })} /></div>
                  <Button size="sm" onClick={() => saveSlot.mutate(newSlot)}>Add</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={openAppt} onOpenChange={setOpenAppt}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Appointment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Appointment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title</Label><Input value={apptForm.title} onChange={e => setApptForm({ ...apptForm, title: e.target.value })} placeholder="Meeting with..." /></div>
                <div><Label>Description</Label><Textarea value={apptForm.description} onChange={e => setApptForm({ ...apptForm, description: e.target.value })} /></div>
                <div>
                  <Label>Contact (optional)</Label>
                  <Select value={selectedContact} onValueChange={setSelectedContact}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>
                      {contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start</Label><Input type="datetime-local" value={apptForm.start_time} onChange={e => setApptForm({ ...apptForm, start_time: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="datetime-local" value={apptForm.end_time} onChange={e => setApptForm({ ...apptForm, end_time: e.target.value })} /></div>
                </div>
                <div><Label>Location</Label><Input value={apptForm.location} onChange={e => setApptForm({ ...apptForm, location: e.target.value })} placeholder="Office / Zoom link" /></div>
                <Button className="w-full" onClick={() => createAppointment.mutate()} disabled={!apptForm.title || !apptForm.start_time || !apptForm.end_time}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card>
          <CardContent className="p-3">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h2>
          {dayAppointments.length === 0 && <p className="text-sm text-muted-foreground">No appointments for this day</p>}
          {dayAppointments.map((appt: any) => (
            <Card key={appt.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-medium">{appt.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(appt.start_time), "HH:mm")} - {format(new Date(appt.end_time), "HH:mm")}</span>
                    </div>
                    {appt.location && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-3 w-3" />{appt.location}</div>}
                    {appt.contacts && <p className="text-sm">With: {appt.contacts.first_name} {appt.contacts.last_name}</p>}
                    {appt.description && <p className="text-xs text-muted-foreground">{appt.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={appt.status === "completed" ? "success" : "outline"} className="capitalize">{appt.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => deleteAppointment.mutate(appt.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
