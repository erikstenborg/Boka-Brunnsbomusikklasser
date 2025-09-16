import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "@/components/Navigation";
import EventRegistrationForm from "@/components/EventRegistrationForm";
import PublicCalendar from "@/components/PublicCalendar";
import KanbanBoard from "@/components/KanbanBoard";
import EventDetailModal from "@/components/EventDetailModal";
import NotFound from "@/pages/not-found";

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
];

const mockBookings = [
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
];

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
];

function Router() {
  const [currentView, setCurrentView] = useState<"public" | "admin">("public");
  const [currentPage, setCurrentPage] = useState<"form" | "calendar" | "kanban">("form");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookings, setBookings] = useState(mockBookings);
  
  const mockUser = {
    name: "Maria Svensson",
    email: "maria@admin.com",
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    console.log('User authenticated');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView("public");
    console.log('User logged out');
  };

  const handleViewChange = (view: "public" | "admin") => {
    if (view === "admin" && !isAuthenticated) {
      return; // Prevent access to admin without authentication
    }
    setCurrentView(view);
    // Reset to appropriate default page for each view
    if (view === "public") {
      setCurrentPage("form");
    } else {
      setCurrentPage("kanban");
    }
  };

  const handleBookingSubmit = (data: any) => {
    console.log('New booking submitted:', data);
    // In real app, this would save to backend
    const newBooking = {
      ...data,
      id: Date.now().toString(),
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setBookings(prev => [...prev, newBooking]);
    return Promise.resolve();
  };

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleMoveBooking = (bookingId: string, newStatus: any) => {
    setBookings(prev => 
      prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: newStatus, updatedAt: new Date().toISOString() }
          : booking
      )
    );
  };

  const handleStatusChange = (bookingId: string, newStatus: any) => {
    handleMoveBooking(bookingId, newStatus);
    // In real app, would also log activity
    console.log(`Status changed for booking ${bookingId} to ${newStatus}`);
  };

  const renderCurrentPage = () => {
    if (currentView === "public") {
      if (currentPage === "form") {
        return (
          <div className="container mx-auto p-6">
            <EventRegistrationForm onSubmit={handleBookingSubmit} />
          </div>
        );
      } else if (currentPage === "calendar") {
        return (
          <div className="container mx-auto p-6">
            <PublicCalendar blockedSlots={mockBlockedSlots} />
          </div>
        );
      }
    } else if (currentView === "admin" && isAuthenticated) {
      if (currentPage === "kanban") {
        return (
          <div className="container mx-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Event Management</h1>
                <p className="text-muted-foreground">Manage Christmas event bookings through the workflow</p>
              </div>
              <KanbanBoard 
                bookings={bookings}
                onBookingClick={handleBookingClick}
                onMoveBooking={handleMoveBooking}
              />
            </div>
          </div>
        );
      } else if (currentPage === "calendar") {
        return (
          <div className="container mx-auto p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Admin Calendar</h1>
              <p className="text-muted-foreground">Full event calendar with management capabilities</p>
            </div>
            <PublicCalendar 
              blockedSlots={mockBlockedSlots} 
              className="cursor-pointer"
            />
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Admin View:</strong> This calendar will show full event details and allow direct management. 
                Click events to open detail modals and manage bookings.
              </p>
            </div>
          </div>
        );
      }
    }
    
    return <NotFound />;
  };

  return (
    <Switch>
      <Route path="/">
        <Navigation
          currentView={currentView}
          currentPage={currentPage}
          isAuthenticated={isAuthenticated}
          user={isAuthenticated ? mockUser : undefined}
          onViewChange={handleViewChange}
          onPageChange={setCurrentPage}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
        {renderCurrentPage()}
        <EventDetailModal
          booking={selectedBooking}
          activityLog={mockActivityLog}
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          onStatusChange={handleStatusChange}
        />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
