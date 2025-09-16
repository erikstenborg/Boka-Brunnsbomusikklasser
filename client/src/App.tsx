import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import EventRegistrationForm from "@/components/EventRegistrationForm";
import PublicCalendar from "@/components/PublicCalendar";
import KanbanBoard from "@/components/KanbanBoard";
import EventDetailModal from "@/components/EventDetailModal";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

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
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookingActivities, setSelectedBookingActivities] = useState<any[]>([]);
  
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Query to fetch admin bookings (real API call)
  const { data: adminBookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['/api/bookings'],
    enabled: currentView === 'admin' && isAuthenticated && user?.isAdmin,
    select: (data) => data.bookings, // Unwrap the server response
  });

  // Use mock data for public view, real data for admin view
  const bookings = currentView === 'admin' && isAuthenticated && user?.isAdmin ? adminBookings : mockBookings;
  
  // Use useEffect to handle admin access redirect to prevent render loops
  useEffect(() => {
    if (currentView === "admin" && isAuthenticated && !user?.isAdmin) {
      setCurrentView("public");
    }
  }, [currentView, isAuthenticated, user?.isAdmin]);

  const handleViewChange = (view: "public" | "admin") => {
    if (view === "admin" && (!isAuthenticated || !user?.isAdmin)) {
      return; // Prevent access to admin without authentication and admin privileges
    }
    setCurrentView(view);
    // Reset to appropriate default page for each view
    if (view === "public") {
      setCurrentPage("form");
    } else {
      setCurrentPage("kanban");
    }
  };

  // Mutation for updating booking status (with activity logging)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const response = await apiRequest('PUT', `/api/bookings/${bookingId}`, { status });
      return await response.json();
    },
    onSuccess: () => {
      refetchBookings();
      toast({
        title: "Status updated",
        description: "Booking status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking status.",
        variant: "destructive",
      });
    },
  });

  // Mutation for fetching booking details
  const fetchBookingDetailsMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const [bookingResponse, activitiesResponse] = await Promise.all([
        apiRequest('GET', `/api/bookings/${bookingId}`),
        apiRequest('GET', `/api/bookings/${bookingId}/activities`)
      ]);
      const booking = await bookingResponse.json();
      const activities = await activitiesResponse.json();
      return { booking: booking.booking, activities: activities.activities };
    },
    onSuccess: (data) => {
      setSelectedBooking(data.booking);
      setSelectedBookingActivities(data.activities || []);
      setIsModalOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch booking details.",
        variant: "destructive",
      });
    },
  });

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
    // For public view, still use mock data
    if (currentView === 'public') {
      // This would be handled by the EventRegistrationForm component's own mutation
    }
    return Promise.resolve();
  };

  const handleBookingClick = async (booking: any) => {
    if (currentView === 'admin' && isAuthenticated && user?.isAdmin) {
      // Fetch real booking details with activity logs
      fetchBookingDetailsMutation.mutate(booking.id);
    } else {
      // Use mock data for public view
      setSelectedBooking(booking);
      setSelectedBookingActivities(mockActivityLog);
      setIsModalOpen(true);
    }
  };

  const handleMoveBooking = (bookingId: string, newStatus: any) => {
    if (currentView === 'admin' && isAuthenticated && user?.isAdmin) {
      // Use real API call with activity logging
      updateStatusMutation.mutate({ bookingId, status: newStatus });
    } else {
      // Mock functionality for public view
      console.log(`Mock: Moving booking ${bookingId} to ${newStatus}`);
    }
  };

  const handleStatusChange = (bookingId: string, newStatus: any) => {
    handleMoveBooking(bookingId, newStatus);
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
    } else if (currentView === "admin" && isAuthenticated && user?.isAdmin) {
      if (currentPage === "kanban") {
        return (
          <div className="container mx-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Evenemanghantering</h1>
                <p className="text-muted-foreground">Hantera julevenemangsbokningar genom arbetsflödet</p>
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
              <h1 className="text-3xl font-bold tracking-tight">Adminkalender</h1>
              <p className="text-muted-foreground">Fullständig evenemangkalender med hanteringsmöjligheter</p>
            </div>
            <PublicCalendar 
              blockedSlots={mockBlockedSlots} 
              className="cursor-pointer"
            />
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Adminvy:</strong> Denna kalender visar fullständiga evenemangdetaljer och tillåter direkt hantering. 
                Klicka på evenemang för att öppna detaljmodaler och hantera bokningar.
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
          onViewChange={handleViewChange}
          onPageChange={setCurrentPage}
        />
        {renderCurrentPage()}
        <EventDetailModal
          booking={selectedBooking}
          activityLog={currentView === 'admin' ? selectedBookingActivities : mockActivityLog}
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
