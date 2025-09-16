import KanbanBoard from '../KanbanBoard';
import { useState } from 'react';

export default function KanbanBoardExample() {
  // todo: remove mock functionality
  const [mockBookings, setMockBookings] = useState([
    {
      id: '1',
      eventType: 'luciatag' as const,
      contactName: 'Anna Andersson',
      contactEmail: 'anna@example.com',
      contactPhone: '+46 70 123 45 67',
      requestedDate: '2024-12-13',
      startTime: '10:00',
      duration: '2',
      additionalNotes: 'Need space for 25 children and accompaniment',
      status: 'pending' as const,
      createdAt: '2024-12-01T10:00:00Z',
      updatedAt: '2024-12-01T10:00:00Z',
    },
    {
      id: '2',
      eventType: 'sjungande_julgran' as const,
      contactName: 'Erik Eriksson',
      contactEmail: 'erik@skolan.se',
      contactPhone: '+46 70 987 65 43',
      requestedDate: '2024-12-15',
      startTime: '14:00',
      duration: '3',
      additionalNotes: 'Annual school Christmas event',
      status: 'reviewing' as const,
      assignedTo: 'Maria',
      createdAt: '2024-12-02T14:30:00Z',
      updatedAt: '2024-12-02T16:15:00Z',
    },
    {
      id: '3',
      eventType: 'luciatag' as const,
      contactName: 'Birgitta Svensson',
      contactEmail: 'birgitta@kyrkan.se',
      contactPhone: '+46 70 555 12 34',
      requestedDate: '2024-12-20',
      startTime: '18:00',
      duration: '2',
      status: 'approved' as const,
      assignedTo: 'Johan',
      createdAt: '2024-11-28T09:15:00Z',
      updatedAt: '2024-12-03T11:20:00Z',
    },
    {
      id: '4',
      eventType: 'sjungande_julgran' as const,
      contactName: 'Lars Larsson',
      contactEmail: 'lars@gmail.com',
      contactPhone: '+46 70 999 88 77',
      requestedDate: '2024-12-10',
      startTime: '16:00',
      duration: '2.5',
      additionalNotes: 'Family gathering, outdoor location preferred',
      status: 'completed' as const,
      assignedTo: 'Sofia',
      createdAt: '2024-11-25T13:45:00Z',
      updatedAt: '2024-12-10T18:30:00Z',
    },
  ]);

  const handleBookingClick = (booking: any) => {
    console.log('Booking clicked:', booking);
  };

  const handleMoveBooking = (bookingId: string, newStatus: any) => {
    setMockBookings(prev => 
      prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: newStatus, updatedAt: new Date().toISOString() }
          : booking
      )
    );
    console.log(`Moved booking ${bookingId} to ${newStatus}`);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Event Management</h1>
          <p className="text-muted-foreground">Manage Christmas event bookings through the workflow</p>
        </div>
        <KanbanBoard 
          bookings={mockBookings}
          onBookingClick={handleBookingClick}
          onMoveBooking={handleMoveBooking}
        />
      </div>
    </div>
  );
}