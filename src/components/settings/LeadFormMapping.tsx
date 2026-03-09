import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Facebook, 
  ArrowRight, 
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Settings2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

interface LeadForm {
  id: string;
  name: string;
  platform: "facebook" | "instagram" | "pabbly";
  pageId?: string;
  pageName?: string;
  mappings: FieldMapping[];
  isActive: boolean;
  leadsCount: number;
}

const CRM_FIELDS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "notes", label: "Notes" },
  { value: "source", label: "Source" },
  { value: "tags", label: "Tags" },
  { value: "custom_1", label: "Custom Field 1" },
  { value: "custom_2", label: "Custom Field 2" },
];

const SAMPLE_FORMS: LeadForm[] = [
  {
    id: "1",
    name: "Webinar Registration Form",
    platform: "facebook",
    pageId: "123456",
    pageName: "My Business Page",
    mappings: [
      { id: "m1", sourceField: "full_name", targetField: "first_name" },
      { id: "m2", sourceField: "email", targetField: "email" },
      { id: "m3", sourceField: "phone_number", targetField: "phone" },
    ],
    isActive: true,
    leadsCount: 127,
  },
];

export function LeadFormMapping() {
  const [forms, setForms] = useState<LeadForm[]>(SAMPLE_FORMS);
  const [editingForm, setEditingForm] = useState<LeadForm | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newSourceField, setNewSourceField] = useState("");

  const handleToggleForm = (formId: string) => {
    setForms(prev =>
      prev.map(f =>
        f.id === formId ? { ...f, isActive: !f.isActive } : f
      )
    );
    toast.success("Form status updated");
  };

  const handleDeleteForm = (formId: string) => {
    setForms(prev => prev.filter(f => f.id !== formId));
    toast.success("Form mapping deleted");
  };

  const handleUpdateMapping = (formId: string, mappingId: string, targetField: string) => {
    setForms(prev =>
      prev.map(f => {
        if (f.id === formId) {
          return {
            ...f,
            mappings: f.mappings.map(m =>
              m.id === mappingId ? { ...m, targetField } : m
            ),
          };
        }
        return f;
      })
    );
  };

  const handleAddMapping = (formId: string) => {
    if (!newSourceField.trim()) {
      toast.error("Enter source field name");
      return;
    }
    setForms(prev =>
      prev.map(f => {
        if (f.id === formId) {
          return {
            ...f,
            mappings: [
              ...f.mappings,
              {
                id: crypto.randomUUID(),
                sourceField: newSourceField,
                targetField: "notes",
              },
            ],
          };
        }
        return f;
      })
    );
    setNewSourceField("");
    toast.success("Mapping added");
  };

  const handleDeleteMapping = (formId: string, mappingId: string) => {
    setForms(prev =>
      prev.map(f => {
        if (f.id === formId) {
          return {
            ...f,
            mappings: f.mappings.filter(m => m.id !== mappingId),
          };
        }
        return f;
      })
    );
  };

  const handleAddNewForm = () => {
    const newForm: LeadForm = {
      id: crypto.randomUUID(),
      name: "New Lead Form",
      platform: "pabbly",
      mappings: [
        { id: crypto.randomUUID(), sourceField: "name", targetField: "first_name" },
        { id: crypto.randomUUID(), sourceField: "email", targetField: "email" },
      ],
      isActive: true,
      leadsCount: 0,
    };
    setForms(prev => [...prev, newForm]);
    setAddFormOpen(false);
    toast.success("New form mapping created");
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-500" />;
      case "instagram":
        return <Facebook className="h-4 w-4 text-pink-500" />;
      default:
        return <Settings2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Lead Form Mappings</h3>
          <p className="text-xs text-muted-foreground">
            Map incoming lead form fields to CRM contact fields
          </p>
        </div>
        <Button size="sm" onClick={() => setAddFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Form
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No forms mapped yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Your First Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getPlatformIcon(form.platform)}
                    <div>
                      <CardTitle className="text-sm font-medium">{form.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {form.pageName || "External webhook"} • {form.leadsCount} leads captured
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={() => handleToggleForm(form.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteForm(form.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr,32px,1fr,32px] items-center gap-2 text-xs text-muted-foreground font-medium px-1">
                    <span>Source Field</span>
                    <span></span>
                    <span>CRM Field</span>
                    <span></span>
                  </div>
                  
                  {form.mappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="grid grid-cols-[1fr,32px,1fr,32px] items-center gap-2"
                    >
                      <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                        {mapping.sourceField}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                      <Select
                        value={mapping.targetField}
                        onValueChange={(value) =>
                          handleUpdateMapping(form.id, mapping.id, value)
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteMapping(form.id, mapping.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  
                  {/* Add new mapping */}
                  <div className="grid grid-cols-[1fr,32px,1fr,32px] items-center gap-2 pt-2">
                    <Input
                      placeholder="field_name"
                      value={newSourceField}
                      onChange={(e) => setNewSourceField(e.target.value)}
                      className="h-9 text-sm font-mono"
                    />
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => handleAddMapping(form.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Mapping
                    </Button>
                    <div />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Form Dialog */}
      <Dialog open={addFormOpen} onOpenChange={setAddFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lead Form Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleAddNewForm}>
                <Facebook className="h-6 w-6 text-blue-500" />
                <span className="text-xs">Facebook Form</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleAddNewForm}>
                <Facebook className="h-6 w-6 text-pink-500" />
                <span className="text-xs">Instagram Form</span>
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleAddNewForm}>
              <Settings2 className="h-4 w-4 mr-2" />
              External Webhook (Pabbly, Zapier, etc.)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
