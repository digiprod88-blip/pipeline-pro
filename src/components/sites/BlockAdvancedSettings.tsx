import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Monitor, Smartphone, MousePointer, ExternalLink, ArrowDown, FormInput, Type, Palette } from "lucide-react";

export interface BlockAdvancedSettings {
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  buttonAction?: "popup_form" | "external_link" | "scroll_to";
  buttonUrl?: string;
  scrollTarget?: string;
  popupFormFields?: string[];
  mobileFontSize?: string;
  desktopFontSize?: string;
  mobileTextColor?: string;
  desktopTextColor?: string;
}

interface BlockAdvancedSettingsProps {
  settings: BlockAdvancedSettings;
  onChange: (settings: BlockAdvancedSettings) => void;
  blockType: string;
}

export function BlockAdvancedSettingsPanel({ settings, onChange, blockType }: BlockAdvancedSettingsProps) {
  const hasButton = ["hero", "cta"].includes(blockType);

  return (
    <div className="space-y-4">
      <Separator />
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Visibility
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="hide-mobile" className="text-sm cursor-pointer">Hide on Mobile</Label>
            </div>
            <Switch id="hide-mobile" checked={settings.hideOnMobile || false} onCheckedChange={(checked) => onChange({ ...settings, hideOnMobile: checked })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="hide-desktop" className="text-sm cursor-pointer">Hide on Desktop</Label>
            </div>
            <Switch id="hide-desktop" checked={settings.hideOnDesktop || false} onCheckedChange={(checked) => onChange({ ...settings, hideOnDesktop: checked })} />
          </div>
        </div>
      </div>

      {/* Device-Specific Styling */}
      <Separator />
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Device-Specific Styling
        </h4>
        <div className="space-y-4">
          {/* Desktop styles */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Type className="h-3 w-3" />Font Size</Label>
                <Input
                  placeholder="e.g. 18px"
                  value={settings.desktopFontSize || ""}
                  onChange={(e) => onChange({ ...settings, desktopFontSize: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Palette className="h-3 w-3" />Text Color</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={settings.desktopTextColor || "#000000"}
                    onChange={(e) => onChange({ ...settings, desktopTextColor: e.target.value })}
                    className="h-8 w-10 p-1 cursor-pointer"
                  />
                  <Input
                    placeholder="#000000"
                    value={settings.desktopTextColor || ""}
                    onChange={(e) => onChange({ ...settings, desktopTextColor: e.target.value })}
                    className="h-8 text-xs flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile styles */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Type className="h-3 w-3" />Font Size</Label>
                <Input
                  placeholder="e.g. 14px"
                  value={settings.mobileFontSize || ""}
                  onChange={(e) => onChange({ ...settings, mobileFontSize: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Palette className="h-3 w-3" />Text Color</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={settings.mobileTextColor || "#000000"}
                    onChange={(e) => onChange({ ...settings, mobileTextColor: e.target.value })}
                    className="h-8 w-10 p-1 cursor-pointer"
                  />
                  <Input
                    placeholder="#000000"
                    value={settings.mobileTextColor || ""}
                    onChange={(e) => onChange({ ...settings, mobileTextColor: e.target.value })}
                    className="h-8 text-xs flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasButton && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Button Action
            </h4>
            <div className="space-y-3">
              <Select
                value={settings.buttonAction || "popup_form"}
                onValueChange={(value: "popup_form" | "external_link" | "scroll_to") =>
                  onChange({ ...settings, buttonAction: value })
                }
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popup_form"><div className="flex items-center gap-2"><FormInput className="h-3.5 w-3.5" /><span>Open Popup Form</span></div></SelectItem>
                  <SelectItem value="external_link"><div className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5" /><span>External Link</span></div></SelectItem>
                  <SelectItem value="scroll_to"><div className="flex items-center gap-2"><ArrowDown className="h-3.5 w-3.5" /><span>Scroll to Section</span></div></SelectItem>
                </SelectContent>
              </Select>

              {settings.buttonAction === "external_link" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">URL</Label>
                  <Input placeholder="https://..." value={settings.buttonUrl || ""} onChange={(e) => onChange({ ...settings, buttonUrl: e.target.value })} className="text-sm" />
                </div>
              )}

              {settings.buttonAction === "scroll_to" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Section ID</Label>
                  <Input placeholder="features, pricing, contact..." value={settings.scrollTarget || ""} onChange={(e) => onChange({ ...settings, scrollTarget: e.target.value })} className="text-sm" />
                </div>
              )}

              {(!settings.buttonAction || settings.buttonAction === "popup_form") && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                  Button will open a lead capture form popup
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
