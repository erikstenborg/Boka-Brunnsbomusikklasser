import EventDetailModal from '../EventDetailModal';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function EventDetailModalExample() {
  const [isOpen, setIsOpen] = useState(false);
  
  // todo: remove mock functionality
  const mockBooking = {
    id: '123',
    eventType: 'luciatag' as const,
    contactName: 'Anna Andersson',
    contactEmail: 'anna@example.com',
    contactPhone: '+46 70 123 45 67',
    requestedDate: '2024-12-13',
    startTime: '10:00',
    duration: '2.5',
    additionalNotes: 'Need space for 25 children and accompaniment. Please ensure there is a piano available for the musical performance.',
    status: 'reviewing' as const,
    assignedTo: 'Maria Svensson',
    createdAt: '2024-12-01T10:00:00Z',
    updatedAt: '2024-12-02T16:15:00Z',
  };

  const mockActivityLog = [
    {
      id: '1',
      action: 'Booking Created',
      details: 'Initial booking request submitted',
      userId: 'user1',
      userName: 'Anna Andersson',
      timestamp: '2024-12-01T10:00:00Z',
    },
    {
      id: '2', 
      action: 'Status Changed',
      details: 'Moved from "New Request" to "Under Review"',
      userId: 'admin1',
      userName: 'Maria Svensson',
      timestamp: '2024-12-02T14:30:00Z',
    },
    {
      id: '3',
      action: 'Assigned',
      details: 'Booking assigned to Maria Svensson for review',
      userId: 'admin1',
      userName: 'Maria Svensson', 
      timestamp: '2024-12-02T16:15:00Z',
    },
  ];

  const handleStatusChange = (bookingId: string, newStatus: any) => {
    console.log(`Status changed for booking ${bookingId} to ${newStatus}`);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Event Detail Modal</h1>
        <p className="text-muted-foreground">
          Click the button below to see the detailed view of an event booking with full information and activity log.
        </p>
        
        <EventDetailModal
          booking={mockBooking}
          activityLog={mockActivityLog}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onStatusChange={handleStatusChange}
        >
          <Button>View Event Details</Button>
        </EventDetailModal>
        
        <div className="p-4 border rounded-lg bg-muted/50">
          <h3 className="font-semibold mb-2">Modal Features</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Complete event and contact information</li>
            <li>• Status management with visual indicators</li>
            <li>• Activity log with timestamps and user attribution</li>
            <li>• Responsive layout with scrollable content</li>
            <li>• Status change functionality for workflow management</li>
          </ul>
        </div>
      </div>
    </div>
  );
}