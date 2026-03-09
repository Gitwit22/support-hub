import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { ReportPayload } from "@/lib/types/support";
import { AlertTriangle, Wrench, Users, Zap } from "lucide-react";

interface ReportFormProps {
  onSubmit: (payload: ReportPayload) => Promise<void>;
  loading?: boolean;
}

const reportTypes = [
  { value: "incident", label: "Incident", icon: AlertTriangle, desc: "Safety, facility, or emergency issue" },
  { value: "technical", label: "Technical", icon: Wrench, desc: "System outage or malfunction" },
  { value: "behavior", label: "Behavior", icon: Users, desc: "Student or staff concern" },
  { value: "escalation", label: "Escalation", icon: Zap, desc: "Escalate an existing issue" },
];

const severities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function ReportForm({ onSubmit, loading }: ReportFormProps) {
  const [reportType, setReportType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [relatedEntity, setRelatedEntity] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportType || !title.trim() || !description.trim()) return;
    await onSubmit({ reportType, title: title.trim(), description: description.trim(), severity, relatedEntity: relatedEntity.trim() || undefined });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
          <AlertTriangle className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Report Submitted</h3>
        <p className="mt-2 text-sm text-muted-foreground">Your report has been filed and will be reviewed by the support team.</p>
        <Button className="mt-6" variant="outline" onClick={() => { setSubmitted(false); setReportType(""); setTitle(""); setDescription(""); }}>
          Submit Another Report
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!reportType ? (
        <>
          <h3 className="text-lg font-semibold text-foreground">Select Report Type</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reportTypes.map(rt => (
              <Card
                key={rt.value}
                className="cursor-pointer border-border p-4 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                onClick={() => setReportType(rt.value)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <rt.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-card-foreground">{rt.label}</p>
                    <p className="text-xs text-muted-foreground">{rt.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-card-foreground capitalize">{reportType} Report</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReportType("")}>Change type</Button>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Brief summary..." value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Detailed description..." value={description} onChange={e => setDescription(e.target.value)} required maxLength={2000} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={v => setSeverity(v as typeof severity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {severities.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Related Room/Event/Class</Label>
              <Input placeholder="Optional..." value={relatedEntity} onChange={e => setRelatedEntity(e.target.value)} maxLength={100} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setReportType("")}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim() || !description.trim()}>
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
