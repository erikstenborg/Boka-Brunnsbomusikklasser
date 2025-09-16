import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockedTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  eventType: "luciatag" | "sjungande_julgran";
}

interface PublicCalendarProps {
  blockedSlots?: BlockedTimeSlot[];
  className?: string;
}

export default function PublicCalendar({ blockedSlots = [], className }: PublicCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const monthNames = [
    "Januari", "Februari", "Mars", "April", "Maj", "Juni",
    "Juli", "Augusti", "September", "Oktober", "November", "December"
  ];
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday = 0
  
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };
  
  const getDateString = (day: number) => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  
  const getBlockedSlotsForDate = (day: number) => {
    const dateString = getDateString(day);
    return blockedSlots.filter(slot => slot.date === dateString);
  };
  
  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === currentYear && 
           today.getMonth() === currentMonth && 
           today.getDate() === day;
  };
  
  const renderCalendarDays = () => {
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 p-1" />
      );
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const blockedSlots = getBlockedSlotsForDate(day);
      const hasBlockedSlots = blockedSlots.length > 0;
      
      days.push(
        <div
          key={day}
          className={cn(
            "h-24 p-1 border border-border",
            isToday(day) && "bg-primary/5 border-primary"
          )}
          data-testid={`calendar-day-${day}`}
        >
          <div className="h-full flex flex-col">
            <div className={cn(
              "text-sm font-medium mb-1",
              isToday(day) ? "text-primary" : "text-foreground"
            )}>
              {day}
            </div>
            
            {hasBlockedSlots && (
              <div className="flex-1 space-y-1">
                {blockedSlots.slice(0, 2).map((slot, index) => (
                  <div
                    key={slot.id}
                    className="text-xs p-1 bg-muted rounded text-muted-foreground"
                    data-testid={`blocked-slot-${slot.id}`}
                  >
                    <div className="truncate">
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div className="truncate text-[10px]">
                      Bokad
                    </div>
                  </div>
                ))}
                
                {blockedSlots.length > 2 && (
                  <div className="text-[10px] text-muted-foreground p-1">
                    +{blockedSlots.length - 2} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };
  
  return (
    <Card className={cn("w-full", className)} data-testid="card-public-calendar">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Tillgängliga tidsintervall
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth("prev")}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-lg font-semibold min-w-[140px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth("next")}
              data-testid="button-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted rounded" />
            <span>Tidsintervall ej tillgängliga</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-background border border-border rounded" />
            <span>Tillgängligt för bokning</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-7 gap-0 mb-2">
          {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((day) => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-sm font-medium text-muted-foreground border-b border-border"
            >
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-0">
          {renderCalendarDays()}
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>OBS:</strong> Denna kalender visar när tidsintervall redan är bokade. 
            Välj en tillgänglig tid när du skickar din eventförfrågan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}