import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  Mail, 
  Phone, 
  User, 
  Music, 
  Users, 
  MessageSquare,
  History,
  UserCheck
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EventBooking {
  id: string;
  eventType: "luciatag" | "sjungande_julgran";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  requestedDate: string;
  startTime: string;
  duration: string;
  additionalNotes?: string;
  status: "pending" | "reviewing" | "approved" | "completed";
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  timestamp: string;
}

interface EventDetailModalProps {
  booking?: EventBooking;
  activityLog?: ActivityLogEntry[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStatusChange?: (bookingId: string, newStatus: EventBooking['status']) => void;
  children?: React.ReactNode;
}

const eventTypeConfig = {
  luciatag: {
    name: "Luciatåg",
    icon: Music,
    color: "bg-primary/10 text-primary border-primary/20",
    description: "Traditionell svensk luciafirande",
  },
  sjungande_julgran: {
    name: "Sjungande Julgran",
    icon: Users,
    color: "bg-secondary/10 text-secondary-foreground border-secondary/20",
    description: "Julgransuppvisning med sång",
  },
};

const statusConfig = {
  pending: { color: "bg-blue-500", label: "Ny förfrågan" },
  reviewing: { color: "bg-yellow-500", label: "Under granskning" },
  approved: { color: "bg-green-500", label: "Godkänt" },
  completed: { color: "bg-gray-500", label: "Slutfört" },
};

export default function EventDetailModal({ 
  booking, 
  activityLog = [],
  isOpen,
  onOpenChange,
  onStatusChange,
  children 
}: EventDetailModalProps) {
  const [currentStatus, setCurrentStatus] = useState(booking?.status);

  if (!booking) {
    return null;
  }

  const eventConfig = eventTypeConfig[booking.eventType];
  const EventIcon = eventConfig.icon;
  const statusInfo = statusConfig[booking.status];

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy \u2022 h:mm a');
    } catch {
      return dateString;
    }
  };

  const handleStatusChange = (newStatus: EventBooking['status']) => {
    console.log(`Changing status from ${booking.status} to ${newStatus}`);
    setCurrentStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(booking.id, newStatus);
    }
  };

  const getEndTime = () => {
    try {
      const [hours, minutes] = booking.startTime.split(':').map(Number);
      const duration = parseFloat(booking.duration);
      const endHours = Math.floor(hours + duration);
      const endMinutes = Math.round((hours + duration - endHours) * 60) + minutes;
      const finalHours = endHours + Math.floor(endMinutes / 60);
      const finalMinutes = endMinutes % 60;
      return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh]" data-testid="dialog-event-details">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="flex items-center gap-3">
                <EventIcon className="w-6 h-6 text-primary" />
                {eventConfig.name} Bokning
              </DialogTitle>
              <DialogDescription>
                Boknings-ID: {booking.id}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${statusInfo.color}`} />
              <Badge variant="outline" data-testid={`badge-status-${booking.status}`}>
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Event Details */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Evenemangdetaljer
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Eventtyp:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={eventConfig.color}>
                        <EventIcon className="w-3 h-3 mr-1" />
                        {eventConfig.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {eventConfig.description}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Datum:</span>
                    <p className="font-medium" data-testid="text-event-date">
                      {formatDate(booking.requestedDate)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Tid:</span>
                    <p className="font-medium" data-testid="text-event-time">
                      {booking.startTime} - {getEndTime()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Varaktighet: {booking.duration} timmar
                    </p>
                  </div>
                  
                  {booking.assignedTo && (
                    <div>
                      <span className="text-muted-foreground">Tilldelad till:</span>
                      <p className="font-medium flex items-center gap-1" data-testid="text-assigned-to">
                        <UserCheck className="w-3 h-3" />
                        {booking.assignedTo}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Kontaktinformation
              </h3>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Namn:</span>
                    <p className="font-medium" data-testid="text-contact-name">
                      {booking.contactName}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">E-post:</span>
                    <p className="font-medium" data-testid="text-contact-email">
                      {booking.contactEmail}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Telefon:</span>
                    <p className="font-medium" data-testid="text-contact-phone">
                      {booking.contactPhone}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {booking.additionalNotes && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Ytterligare anteckningar
                  </h3>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm" data-testid="text-additional-notes">
                      {booking.additionalNotes}
                    </p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Status Actions */}
            <div className="space-y-4">
              <h3 className="font-semibold">Uppdatera status</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([status, config]) => (
                  <Button
                    key={status}
                    variant={booking.status === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(status as EventBooking['status'])}
                    disabled={booking.status === status}
                    data-testid={`button-status-${status}`}
                  >
                    <div className={`w-2 h-2 rounded-full mr-2 ${config.color}`} />
                    {config.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Activity Log */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4" />
                Aktivitetslogg
              </h3>
              
              {activityLog.length > 0 ? (
                <div className="space-y-3">
                  {activityLog.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="flex gap-3 p-3 bg-muted/50 rounded-lg"
                      data-testid={`activity-log-${entry.id}`}
                    >
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-muted-foreground">{entry.details}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.userName} \u2022 {formatDateTime(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen aktivitet registrerad ännu.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}