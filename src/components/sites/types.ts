// Nested Page Builder Type System
// Architecture: Section → Row → Column → Element

export type DeviceVisibility = {
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
};

export type ElementType = "heading" | "text" | "image" | "button" | "video" | "form" | "divider" | "spacer";

export interface ButtonAction {
  type: "link" | "popup" | "scroll";
  url?: string;
  popupId?: string;
  scrollTo?: string;
}

export interface PageElement {
  id: string;
  type: ElementType;
  content: Record<string, string>;
  visibility?: DeviceVisibility;
  buttonAction?: ButtonAction;
  videoSettings?: {
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
  };
}

export type ColumnWidth = "1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "full";

export interface PageColumn {
  id: string;
  width: ColumnWidth;
  elements: PageElement[];
  padding?: string;
  backgroundColor?: string;
}

export type ColumnPreset = "1" | "1-1" | "1-1-1" | "1-1-1-1" | "1-2" | "2-1" | "1-2-1";

export interface PageRow {
  id: string;
  columns: PageColumn[];
  preset: ColumnPreset;
  gap?: string;
  verticalAlign?: "top" | "center" | "bottom";
}

export type SectionWidth = "full" | "container" | "narrow";

export interface PageSection {
  id: string;
  name?: string;
  rows: PageRow[];
  width: SectionWidth;
  backgroundColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  visibility?: DeviceVisibility;
}

export type DevicePreview = "desktop" | "tablet" | "mobile";

export const COLUMN_PRESETS: Record<ColumnPreset, ColumnWidth[]> = {
  "1": ["full"],
  "1-1": ["1/2", "1/2"],
  "1-1-1": ["1/3", "1/3", "1/3"],
  "1-1-1-1": ["1/4", "1/4", "1/4", "1/4"],
  "1-2": ["1/3", "2/3"],
  "2-1": ["2/3", "1/3"],
  "1-2-1": ["1/4", "1/2", "1/4"],
};

export const ELEMENT_TEMPLATES: { type: ElementType; label: string; icon: string; defaults: Record<string, string> }[] = [
  { type: "heading", label: "Heading", icon: "Type", defaults: { text: "Your Headline", level: "h2" } },
  { type: "text", label: "Text", icon: "AlignLeft", defaults: { content: "Write your content here..." } },
  { type: "image", label: "Image", icon: "Image", defaults: { src: "", alt: "Image description" } },
  { type: "button", label: "Button", icon: "MousePointer", defaults: { text: "Click Here", variant: "primary" } },
  { type: "video", label: "Video", icon: "Play", defaults: { url: "", poster: "" } },
  { type: "form", label: "Form", icon: "FormInput", defaults: { title: "Get Started", fields: "name,email", buttonText: "Submit" } },
  { type: "divider", label: "Divider", icon: "Minus", defaults: { style: "solid" } },
  { type: "spacer", label: "Spacer", icon: "Space", defaults: { height: "40" } },
];

export function createSection(name?: string): PageSection {
  return {
    id: crypto.randomUUID(),
    name: name || "New Section",
    rows: [],
    width: "container",
    paddingTop: "60",
    paddingBottom: "60",
  };
}

export function createRow(preset: ColumnPreset = "1"): PageRow {
  const widths = COLUMN_PRESETS[preset];
  return {
    id: crypto.randomUUID(),
    preset,
    columns: widths.map((width) => ({
      id: crypto.randomUUID(),
      width,
      elements: [],
    })),
    gap: "24",
  };
}

export function createElement(type: ElementType): PageElement {
  const template = ELEMENT_TEMPLATES.find((t) => t.type === type)!;
  return {
    id: crypto.randomUUID(),
    type,
    content: { ...template.defaults },
  };
}
