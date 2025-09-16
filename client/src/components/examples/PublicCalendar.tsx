import PublicCalendar from '../PublicCalendar';

export default function PublicCalendarExample() {
  // todo: remove mock functionality
  const mockBlockedSlots = [
    {
      id: '1',
      date: '2024-12-13',
      startTime: '10:00',
      endTime: '12:00',
      eventType: 'luciatag' as const,
    },
    {
      id: '2',
      date: '2024-12-13',
      startTime: '14:00',
      endTime: '16:00',
      eventType: 'sjungande_julgran' as const,
    },
    {
      id: '3',
      date: '2024-12-15',
      startTime: '09:00',
      endTime: '11:00',
      eventType: 'luciatag' as const,
    },
    {
      id: '4',
      date: '2024-12-20',
      startTime: '16:00',
      endTime: '18:00',
      eventType: 'sjungande_julgran' as const,
    },
    {
      id: '5',
      date: '2024-12-20',
      startTime: '19:00',
      endTime: '21:00',
      eventType: 'luciatag' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <PublicCalendar blockedSlots={mockBlockedSlots} />
    </div>
  );
}