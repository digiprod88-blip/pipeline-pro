import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, Download, Trash2, File, Image, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClientFilesProps {
  contactId: string;
  readOnly?: boolean;
}

export default function ClientFiles({ contactId, readOnly = false }: ClientFilesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files } = useQuery({
    queryKey: ["client-files", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_files")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const uploadFile = async (file: globalThis.File) => {
    setUploading(true);
    try {
      const filePath = `${contactId}/${Date.now()}-${file.name}`;
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

      queryClient.invalidateQueries({ queryKey: ["client-files", contactId] });
      toast.success("File uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("client-files")
      .download(filePath);
    if (error) {
      toast.error("Download failed");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteFile = useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      await supabase.storage.from("client-files").remove([filePath]);
      const { error } = await supabase.from("client_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", contactId] });
      toast.success("File deleted");
    },
  });

  const getFileIcon = (mimeType: string | null) => {
    if (mimeType?.startsWith("image/")) return <Image className="h-4 w-4 text-primary" />;
    if (mimeType?.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          Files
        </CardTitle>
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FileUp className="h-3.5 w-3.5 mr-1" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {(!files || files.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No files shared</p>
        )}
        {files?.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {getFileIcon(file.mime_type)}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(Number(file.file_size))} • {format(new Date(file.created_at), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => downloadFile(file.file_path, file.file_name)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => deleteFile.mutate({ id: file.id, filePath: file.file_path })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
