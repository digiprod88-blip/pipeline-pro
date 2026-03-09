import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Contact {
  id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: string;
  quality?: string | null;
  value?: number | null;
  source?: string | null;
  lead_score: number;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  contact_id: string;
  channel: string;
  direction: string;
  content: string;
  created_at: string;
}

interface Activity {
  id: string;
  contact_id: string;
  type: string;
  description: string;
  created_at: string;
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateCsv(headers: string[], rows: string[][]): string {
  const CHUNK_SIZE = 500;
  const headerRow = headers.map(escapeCsvField).join(",");
  const chunks: string[] = [headerRow];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const chunkStr = chunk.map(row => row.map(cell => escapeCsvField(cell || "")).join(",")).join("\n");
    chunks.push(chunkStr);
  }

  return chunks.join("\n");
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportLeadDetails(contacts: Contact[]) {
  const headers = [
    "ID",
    "Name",
    "Email",
    "Phone",
    "Company",
    "Status",
    "Quality",
    "Value",
    "Lead Score",
    "Source",
    "Tags",
    "Created At",
    "Updated At",
  ];

  const rows = contacts.map(c => [
    c.id,
    `${c.first_name} ${c.last_name || ""}`.trim(),
    c.email || "",
    c.phone || "",
    c.company || "",
    c.status,
    c.quality || "",
    c.value?.toString() || "0",
    c.lead_score.toString(),
    c.source || "",
    c.tags?.join("; ") || "",
    format(new Date(c.created_at), "yyyy-MM-dd HH:mm:ss"),
    format(new Date(c.updated_at), "yyyy-MM-dd HH:mm:ss"),
  ]);

  const csv = generateCsv(headers, rows);
  downloadFile(csv, `leads-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
  
  return contacts.length;
}

export async function exportInteractionHistory(contactIds: string[]) {
  // Fetch messages for selected contacts
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  // Fetch activities for selected contacts
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  const headers = [
    "Contact ID",
    "Type",
    "Direction/Action",
    "Channel",
    "Content/Description",
    "Timestamp",
  ];

  const messageRows = (messages || []).map(m => [
    m.contact_id,
    "Message",
    m.direction,
    m.channel,
    m.content.substring(0, 500),
    format(new Date(m.created_at), "yyyy-MM-dd HH:mm:ss"),
  ]);

  const activityRows = (activities || []).map(a => [
    a.contact_id || "",
    "Activity",
    a.type,
    "-",
    a.description.substring(0, 500),
    format(new Date(a.created_at), "yyyy-MM-dd HH:mm:ss"),
  ]);

  // Combine and sort by timestamp
  const allRows = [...messageRows, ...activityRows].sort((a, b) => 
    new Date(b[5]).getTime() - new Date(a[5]).getTime()
  );

  const csv = generateCsv(headers, allRows);
  downloadFile(csv, `interactions-export-${format(new Date(), "yyyy-MM-dd")}.csv`);

  return allRows.length;
}

export async function exportFullReport(contacts: Contact[]) {
  const contactIds = contacts.map(c => c.id);
  
  // Export lead details
  await exportLeadDetails(contacts);
  
  // Small delay to prevent browser blocking multiple downloads
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Export interaction history
  await exportInteractionHistory(contactIds);
  
  return {
    leads: contacts.length,
    interactions: contactIds.length,
  };
}
