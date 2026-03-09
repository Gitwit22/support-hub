import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ticket, FileText, MessageCircle } from "lucide-react";

interface SupportTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  ticketsContent: React.ReactNode;
  reportsContent: React.ReactNode;
  responsesContent: React.ReactNode;
}

export function SupportTabs({ activeTab, onTabChange, ticketsContent, reportsContent, responsesContent }: SupportTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="bg-secondary">
        <TabsTrigger value="tickets" className="gap-1.5 data-[state=active]:bg-card">
          <Ticket className="h-4 w-4" /> Tickets
        </TabsTrigger>
        <TabsTrigger value="reports" className="gap-1.5 data-[state=active]:bg-card">
          <FileText className="h-4 w-4" /> Reports
        </TabsTrigger>
        <TabsTrigger value="responses" className="gap-1.5 data-[state=active]:bg-card">
          <MessageCircle className="h-4 w-4" /> Responses
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tickets">{ticketsContent}</TabsContent>
      <TabsContent value="reports">{reportsContent}</TabsContent>
      <TabsContent value="responses">{responsesContent}</TabsContent>
    </Tabs>
  );
}
