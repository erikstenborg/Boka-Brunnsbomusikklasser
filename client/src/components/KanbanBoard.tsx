import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, Mail, Phone, User, Music, Users, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { type EventBookingWithStatusAndType, type ActivityLog } from "@shared/schema";

// Use the shared schema types
type EventBooking = EventBookingWithStatusAndType;
type ActivityLogEntry = ActivityLog;

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  color: string;
}

interface KanbanBoardProps {
  bookings?: EventBooking[];
  onBookingClick?: (booking: EventBooking) => void;
  onMoveBooking?: (bookingId: number, newStatus: string) => void;
  className?: string;
}

const columns: KanbanColumn[] = [
  { id: 'pending', title: 'Nya förfrågningar', status: 'pending', color: 'bg-blue-50 border-blue-200' },
  { id: 'reviewing', title: 'Under granskning', status: 'reviewing', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'approved', title: 'Godkänt', status: 'approved', color: 'bg-green-50 border-green-200' },
  { id: 'completed', title: 'Slutfört', status: 'completed', color: 'bg-gray-50 border-gray-200' },
];

const eventTypeConfig = {
  luciatag: {
    name: "Luciatåg",
    icon: Music,
    color: "bg-primary/10 text-primary",
  },
  sjungande_julgran: {
    name: "Sjungande Julgran",
    icon: Users,
    color: "bg-secondary/10 text-secondary-foreground",
  },
};

// Helper function to get event type config
const getEventTypeConfig = (eventType: EventBooking['eventType']) => {
  return eventTypeConfig[eventType.slug as keyof typeof eventTypeConfig] || eventTypeConfig.luciatag;
};

export default function KanbanBoard({ 
  bookings = [], 
  onBookingClick, 
  onMoveBooking,
  className 
}: KanbanBoardProps) {
  const [draggedBooking, setDraggedBooking] = useState<EventBooking | null>(null);

  const getBookingsByStatus = (status: string) => {
    return bookings.filter(booking => booking.status.slug === status);
  };

  const handleDragStart = (e: React.DragEvent, booking: EventBooking) => {
    setDraggedBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedBooking && draggedBooking.status.slug !== newStatus) {
      console.log(`Moving booking ${draggedBooking.id} from ${draggedBooking.status.slug} to ${newStatus}`);
      if (onMoveBooking) {
        onMoveBooking(draggedBooking.id, newStatus);
      }
    }
    setDraggedBooking(null);
  };

  const handleDragEnd = () => {
    setDraggedBooking(null);
  };

  const formatDate = (dateString: string | Date) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString.toString();
    }
  };

  const formatTime = (dateString: string | Date) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return 'Unknown';
    }
  };

  const renderBookingCard = (booking: EventBooking) => {
    const eventConfig = getEventTypeConfig(booking.eventType);
    const EventIcon = eventConfig.icon;

    return (
      <Card
        key={booking.id}
        className="cursor-pointer hover-elevate active-elevate-2 transition-all"
        draggable
        onDragStart={(e) => handleDragStart(e, booking)}
        onDragEnd={handleDragEnd}
        onClick={() => onBookingClick?.(booking)}
        data-testid={`booking-card-${booking.id}`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <Badge className={eventConfig.color} data-testid={`badge-event-type-${booking.eventType.slug}`}>
                <EventIcon className="w-3 h-3 mr-1" />
                {eventConfig.name}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('More options clicked for booking:', booking.id);
                }}
                data-testid={`button-more-${booking.id}`}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium truncate" data-testid={`text-contact-name-${booking.id}`}>
                  {booking.contactName}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span data-testid={`text-date-${booking.id}`}>
                  {formatDate(booking.startAt)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span data-testid={`text-time-${booking.id}`}>
                  {formatTime(booking.startAt)} ({Math.round(booking.durationMinutes / 60)}h)
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span className="truncate" data-testid={`text-email-${booking.id}`}>
                  {booking.contactEmail}
                </span>
              </div>
            </div>
            
            {booking.additionalNotes && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <p className="line-clamp-2" data-testid={`text-notes-${booking.id}`}>
                  {booking.additionalNotes}
                </p>
              </div>
            )}
            
            {booking.assignedTo && (
              <div className="flex items-center gap-2 pt-1">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs">
                    {booking.assignedTo.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  Tilldelad till {booking.assignedTo}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("w-full", className)} data-testid="kanban-board">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnBookings = getBookingsByStatus(column.status);
          
          return (
            <div
              key={column.id}
              className={cn(
                "rounded-lg border-2 border-dashed p-4 min-h-[500px]",
                column.color,
                draggedBooking && "border-primary"
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
              data-testid={`column-${column.status}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{column.title}</h3>
                <Badge 
                  variant="secondary" 
                  className="bg-background/80"
                  data-testid={`badge-count-${column.status}`}
                >
                  {columnBookings.length}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {columnBookings.map(renderBookingCard)}
              </div>
              
              {columnBookings.length === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <p className="text-sm">Inga bokningar</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}