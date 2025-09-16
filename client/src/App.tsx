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



function Router() {
  const [currentView, setCurrentView] = useState<"public" | "admin">("public");
  const [currentPage, setCurrentPage] = useState<"form" | "calendar" | "kanban">("form");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookingActivities, setSelectedBookingActivities] = useState<any[]>([]);
  
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Query to fetch calendar blocked slots (public data, no auth needed)
  const { data: calendarData, isLoading: isLoadingCalendar } = useQuery({
    queryKey: ['/api/calendar/blocked-slots'],
    select: (data) => data.blockedSlots || [], // Unwrap the server response
  });

  // Query to fetch admin bookings (real API call)
  const { data: adminBookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['/api/bookings'],
    enabled: currentView === 'admin' && isAuthenticated && user?.isAdmin,
    select: (data) => data.bookings, // Unwrap the server response
  });

  // Public view only shows calendar blocked slots, no need for detailed bookings
  const bookings = adminBookings;
  
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

  // EventRegistrationForm handles its own submission, no need for handleBookingSubmit

  const handleBookingClick = async (booking: any) => {
    if (currentView === 'admin' && isAuthenticated && user?.isAdmin) {
      // Fetch real booking details with activity logs for admin view
      fetchBookingDetailsMutation.mutate(booking.id);
    } else {
      // For public view, show limited booking details without activity logs
      setSelectedBooking(booking);
      setSelectedBookingActivities([]); // Public view doesn't show activity logs
      setIsModalOpen(true);
    }
  };

  const handleMoveBooking = (bookingId: string, newStatus: any) => {
    if (currentView === 'admin' && isAuthenticated && user?.isAdmin) {
      // Use real API call with activity logging
      updateStatusMutation.mutate({ bookingId, status: newStatus });
    }
    // Public view doesn't have booking move functionality
  };

  const handleStatusChange = (bookingId: string, newStatus: any) => {
    handleMoveBooking(bookingId, newStatus);
  };

  const renderCurrentPage = () => {
    if (currentView === "public") {
      if (currentPage === "form") {
        return (
          <div className="container mx-auto p-6">
            <EventRegistrationForm />
          </div>
        );
      } else if (currentPage === "calendar") {
        if (isLoadingCalendar) {
          return (
            <div className="container mx-auto p-6">
              <div className="flex items-center justify-center h-48">
                <div className="text-muted-foreground">Laddar kalender...</div>
              </div>
            </div>
          );
        }
        
        return (
          <div className="container mx-auto p-6">
            <PublicCalendar blockedSlots={calendarData} />
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
              blockedSlots={calendarData || []} 
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
          activityLog={selectedBookingActivities}
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
