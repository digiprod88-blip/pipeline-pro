import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import LeadScoreBadge from "@/components/dashboard/LeadScoreBadge";

type Contact = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  company: string | null;
  quality: "cold" | "warm" | "hot" | null;
  value: number | null;
  stage_id: string | null;
  status: "lead" | "customer";
  lead_score: number;
};

type Stage = {
  id: string;
  name: string;
  position: number;
  color: string | null;
  pipeline_id: string;
};

function LeadCard({ contact, isDragging }: { contact: Contact; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: contact.id,
    data: { type: "contact", contact },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" {...listeners} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {contact.first_name} {contact.last_name}
                </p>
                {contact.company && (
                  <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                )}
              </div>
            </div>
            {contact.quality && (
              <Badge
                variant={contact.quality === "hot" ? "hot" : contact.quality === "warm" ? "warm" : "cold"}
                className="text-[10px] shrink-0"
              >
                {contact.quality}
              </Badge>
            )}
          </div>
          {contact.value && Number(contact.value) > 0 && (
            <p className="text-xs text-muted-foreground mt-2">${Number(contact.value).toLocaleString()}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {contact.first_name[0]}
            </div>
            <LeadScoreBadge score={contact.lead_score ?? 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StageColumn({
  stage,
  contacts,
  onAddContact,
}: {
  stage: Stage;
  contacts: Contact[];
  onAddContact: (stageId: string) => void;
}) {
  const stageValue = contacts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color || "hsl(var(--muted-foreground))" }}
          />
          <h3 className="text-sm font-medium">{stage.name}</h3>
          <span className="text-xs text-muted-foreground">({contacts.length})</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddContact(stage.id)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {stageValue > 0 && (
        <p className="text-xs text-muted-foreground mb-2 px-1">${stageValue.toLocaleString()}</p>
      )}
      <div className="flex-1 space-y-2 rounded-lg bg-secondary/50 p-2 min-h-[200px]">
        <SortableContext items={contacts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {contacts.map((contact) => (
            <LeadCard key={contact.id} contact={contact} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "score_desc" | "score_asc" | "value_desc">("default");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", "00000000-0000-0000-0000-000000000001")
        .order("position");
      if (error) throw error;
      return data as Stage[];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["pipeline-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, company, quality, value, stage_id, status, lead_score")
        .eq("pipeline_id", "00000000-0000-0000-0000-000000000001");
      if (error) throw error;
      return data as Contact[];
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ contactId, stageId }: { contactId: string; stageId: string }) => {
      const stage = stages?.find((s) => s.id === stageId);
      const isConverted = stage?.name === "Converted";
      const { error } = await supabase
        .from("contacts")
        .update({
          stage_id: stageId,
          ...(isConverted ? { status: "customer" as const } : {}),
        })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-stats"] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const contact = contacts?.find((c) => c.id === event.active.id);
    if (contact) setActiveContact(contact);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveContact(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Check if dropped over a stage column or another contact
    const overContact = contacts?.find((c) => c.id === over.id);
    const targetStageId = overContact?.stage_id;

    if (targetStageId && targetStageId !== contacts?.find((c) => c.id === active.id)?.stage_id) {
      updateStage.mutate({ contactId: active.id as string, stageId: targetStageId });
    }
  };

  const handleAddContact = (stageId: string) => {
    setSelectedStageId(stageId);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag leads across stages</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="score_desc">Score ↓</SelectItem>
              <SelectItem value="score_asc">Score ↑</SelectItem>
              <SelectItem value="value_desc">Value ↓</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setSelectedStageId(stages?.[0]?.id ?? null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages?.map((stage) => {
            let stageContacts = contacts?.filter((c) => c.stage_id === stage.id) ?? [];
            if (sortBy === "score_desc") stageContacts = [...stageContacts].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
            else if (sortBy === "score_asc") stageContacts = [...stageContacts].sort((a, b) => (a.lead_score ?? 0) - (b.lead_score ?? 0));
            else if (sortBy === "value_desc") stageContacts = [...stageContacts].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
            return (
              <StageColumn
                key={stage.id}
                stage={stage}
                contacts={stageContacts}
                onAddContact={handleAddContact}
              />
            );
          })}
        </div>
        <DragOverlay>
          {activeContact && <LeadCard contact={activeContact} />}
        </DragOverlay>
      </DndContext>

      <AddContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultStageId={selectedStageId}
        pipelineId="00000000-0000-0000-0000-000000000001"
      />
    </div>
  );
}
