import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClientUploadsProps {
  contactId: string;
}

export function ClientUploads({ contactId }: ClientUploadsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files } = useQuery({
    queryKey: ["client-uploads", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_files")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const filePath = `${contactId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("client_files").insert({
        contact_id: contactId,
        uploaded_by: user!.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["client-uploads"] });
      toast.success("File uploaded!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File must be under 20MB");
        return;
      }
      uploadFile(file);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" />Upload Documents
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">Upload logos, requirement docs, or other files for your project.</p>
        {files?.map(file => (
          <div key={file.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(file.created_at), "MMM d, yyyy")}
                  {file.file_size && ` · ${(file.file_size / 1024).toFixed(0)} KB`}
                </p>
              </div>
            </div>
          </div>
        ))}
        {(!files || files.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No files uploaded yet</p>
        )}
      </CardContent>
    </Card>
  );
}
