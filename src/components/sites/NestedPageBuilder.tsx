import { useState, useCallback } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Save, Plus, Monitor, Tablet, Smartphone, Layout, Columns, Type, Image,
  MousePointer, Play, FormInput, Minus, Space, Trash2, GripVertical, Settings2, ChevronDown, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PageSection, PageRow, PageColumn, PageElement, DevicePreview, ElementType,
  ColumnPreset, COLUMN_PRESETS, ELEMENT_TEMPLATES, createSection, createRow, createElement,
} from "./types";

const ELEMENT_ICONS: Record<ElementType, React.ElementType> = {
  heading: Type, text: Type, image: Image, button: MousePointer,
  video: Play, form: FormInput, divider: Minus, spacer: Space,
};

interface NestedPageBuilderProps {
  pageId: string;
  pageTitle: string;
  initialSections: PageSection[];
  onSave: (sections: PageSection[]) => void;
  onBack: () => void;
  saving?: boolean;
}

export function NestedPageBuilder({ pageId, pageTitle, initialSections, onSave, onBack, saving }: NestedPageBuilderProps) {
  const [sections, setSections] = useState<PageSection[]>(initialSections);
  const [devicePreview, setDevicePreview] = useState<DevicePreview>("desktop");
  const [selectedElement, setSelectedElement] = useState<{ sectionId: string; rowId: string; columnId: string; elementId: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [showAddElement, setShowAddElement] = useState<{ sectionId: string; rowId: string; columnId: string } | null>(null);

  const previewWidths: Record<DevicePreview, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addSection = () => {
    const section = createSection();
    setSections(prev => [...prev, section]);
    setExpandedSections(prev => new Set([...prev, section.id]));
    toast.success("Section added");
  };

  const addRow = (sectionId: string, preset: ColumnPreset = "1") => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, rows: [...s.rows, createRow(preset)] } : s
    ));
  };

  const addElement = (sectionId: string, rowId: string, columnId: string, type: ElementType) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? {
        ...s,
        rows: s.rows.map(r =>
          r.id === rowId ? {
            ...r,
            columns: r.columns.map(c =>
              c.id === columnId ? { ...c, elements: [...c.elements, createElement(type)] } : c
            ),
          } : r
        ),
      } : s
    ));
    setShowAddElement(null);
    toast.success("Element added");
  };

  const updateElement = (sectionId: string, rowId: string, columnId: string, elementId: string, updates: Partial<PageElement>) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? {
        ...s,
        rows: s.rows.map(r =>
          r.id === rowId ? {
            ...r,
            columns: r.columns.map(c =>
              c.id === columnId ? {
                ...c,
                elements: c.elements.map(e =>
                  e.id === elementId ? { ...e, ...updates } : e
                ),
              } : c
            ),
          } : r
        ),
      } : s
    ));
  };

  const removeElement = (sectionId: string, rowId: string, columnId: string, elementId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? {
        ...s,
        rows: s.rows.map(r =>
          r.id === rowId ? {
            ...r,
            columns: r.columns.map(c =>
              c.id === columnId ? { ...c, elements: c.elements.filter(e => e.id !== elementId) } : c
            ),
          } : r
        ),
      } : s
    ));
    setSelectedElement(null);
  };

  const removeRow = (sectionId: string, rowId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, rows: s.rows.filter(r => r.id !== rowId) } : s
    ));
  };

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const getSelectedElementData = () => {
    if (!selectedElement) return null;
    const section = sections.find(s => s.id === selectedElement.sectionId);
    const row = section?.rows.find(r => r.id === selectedElement.rowId);
    const column = row?.columns.find(c => c.id === selectedElement.columnId);
    return column?.elements.find(e => e.id === selectedElement.elementId);
  };

  const selectedData = getSelectedElementData();

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden md:inline">Back</span>
          </Button>
          <h2 className="text-sm font-medium truncate">{pageTitle}</h2>
          <Badge variant="secondary" className="text-xs">{sections.length} sections</Badge>
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
          {[
            { key: "desktop", icon: Monitor },
            { key: "tablet", icon: Tablet },
            { key: "mobile", icon: Smartphone },
          ].map(({ key, icon: Icon }) => (
            <Button
              key={key}
              variant={devicePreview === key ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setDevicePreview(key as DevicePreview)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-4 w-4 mr-1" />
            Section
          </Button>
          <Button size="sm" onClick={() => onSave(sections)} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <div
            className="mx-auto transition-all duration-300 bg-background border rounded-lg shadow-sm min-h-[400px]"
            style={{ maxWidth: previewWidths[devicePreview] }}
          >
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center p-4">
                <Layout className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm mb-4">No sections yet. Add a section to start building.</p>
                <Button onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="border-b border-dashed border-border last:border-b-0"
                    style={{
                      paddingTop: `${section.paddingTop || 60}px`,
                      paddingBottom: `${section.paddingBottom || 60}px`,
                      backgroundColor: section.backgroundColor,
                    }}
                  >
                    <div className={`mx-auto px-4 ${section.width === "narrow" ? "max-w-2xl" : section.width === "container" ? "max-w-6xl" : ""}`}>
                      {/* Section Header */}
                      <div className="flex items-center justify-between mb-4 -mt-4 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {expandedSections.has(section.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <span className="font-medium">{section.name || "Section"}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addRow(section.id)}>
                            <Columns className="h-3 w-3 mr-1" />
                            Row
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeSection(section.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Rows */}
                      <AnimatePresence>
                        {expandedSections.has(section.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4"
                          >
                            {section.rows.map((row) => (
                              <div key={row.id} className="border border-dashed border-border/50 rounded-lg p-2 hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                                  <span>Row ({row.preset})</span>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeRow(section.id, row.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex gap-2" style={{ gap: `${row.gap || 24}px` }}>
                                  {row.columns.map((column) => (
                                    <div
                                      key={column.id}
                                      className="border border-dashed border-border/30 rounded p-2 min-h-[80px] flex flex-col"
                                      style={{
                                        flex: column.width === "full" ? 1 : column.width === "1/2" ? 0.5 : column.width === "1/3" ? 0.333 : column.width === "2/3" ? 0.667 : column.width === "1/4" ? 0.25 : 0.75,
                                      }}
                                    >
                                      {/* Elements */}
                                      {column.elements.map((element) => {
                                        const Icon = ELEMENT_ICONS[element.type];
                                        const isSelected = selectedElement?.elementId === element.id;
                                        return (
                                          <div
                                            key={element.id}
                                            onClick={() => setSelectedElement({ sectionId: section.id, rowId: row.id, columnId: column.id, elementId: element.id })}
                                            className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors mb-1 ${isSelected ? "bg-primary/10 border border-primary" : "bg-muted/50 hover:bg-muted"}`}
                                          >
                                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="truncate flex-1">{element.content.text || element.content.content || element.type}</span>
                                          </div>
                                        );
                                      })}
                                      {/* Add Element Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full h-8 text-xs border-dashed border mt-auto"
                                        onClick={() => setShowAddElement({ sectionId: section.id, rowId: row.id, columnId: column.id })}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Element
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {section.rows.length === 0 && (
                              <div className="text-center py-6 text-muted-foreground text-sm">
                                <Button variant="outline" size="sm" onClick={() => addRow(section.id)}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Row
                                </Button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedData && selectedElement && (
          <div className="hidden md:block border-l border-border bg-card shrink-0 w-[300px] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold capitalize">{selectedData.type} Settings</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedElement(null)}>✕</Button>
              </div>

              <Tabs defaultValue="content">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-3">
                  {Object.entries(selectedData.content).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs capitalize">{key}</Label>
                      {value.length > 50 ? (
                        <Textarea
                          value={value}
                          onChange={(e) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { content: { ...selectedData.content, [key]: e.target.value } })}
                          rows={3}
                          className="text-sm"
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { content: { ...selectedData.content, [key]: e.target.value } })}
                          className="text-sm"
                        />
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-xs">Visibility</Label>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Hide on Mobile</span>
                      <Switch
                        checked={selectedData.visibility?.hideOnMobile || false}
                        onCheckedChange={(checked) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { visibility: { ...selectedData.visibility, hideOnMobile: checked } })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Hide on Desktop</span>
                      <Switch
                        checked={selectedData.visibility?.hideOnDesktop || false}
                        onCheckedChange={(checked) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { visibility: { ...selectedData.visibility, hideOnDesktop: checked } })}
                      />
                    </div>
                  </div>

                  {selectedData.type === "button" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Button Action</Label>
                      <Select
                        value={selectedData.buttonAction?.type || "link"}
                        onValueChange={(value) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { buttonAction: { ...selectedData.buttonAction, type: value as "link" | "popup" | "scroll" } })}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="link">Open Link</SelectItem>
                          <SelectItem value="popup">Open Popup</SelectItem>
                          <SelectItem value="scroll">Scroll To</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedData.type === "video" && (
                    <div className="space-y-3">
                      <Label className="text-xs">Video Settings</Label>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Autoplay</span>
                        <Switch
                          checked={selectedData.videoSettings?.autoplay || false}
                          onCheckedChange={(checked) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { videoSettings: { ...selectedData.videoSettings, autoplay: checked } })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Loop</span>
                        <Switch
                          checked={selectedData.videoSettings?.loop || false}
                          onCheckedChange={(checked) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { videoSettings: { ...selectedData.videoSettings, loop: checked } })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Show Controls</span>
                        <Switch
                          checked={selectedData.videoSettings?.controls ?? true}
                          onCheckedChange={(checked) => updateElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId, { videoSettings: { ...selectedData.videoSettings, controls: checked } })}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => removeElement(selectedElement.sectionId, selectedElement.rowId, selectedElement.columnId, selectedElement.elementId)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove Element
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* Add Element Sheet */}
      <Sheet open={!!showAddElement} onOpenChange={(open) => !open && setShowAddElement(null)}>
        <SheetContent side="bottom" className="max-h-[50vh]">
          <SheetHeader>
            <SheetTitle>Add Element</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3 pt-4">
            {ELEMENT_TEMPLATES.map((t) => {
              const Icon = ELEMENT_ICONS[t.type];
              return (
                <button
                  key={t.type}
                  onClick={() => showAddElement && addElement(showAddElement.sectionId, showAddElement.rowId, showAddElement.columnId, t.type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-primary/30 hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
