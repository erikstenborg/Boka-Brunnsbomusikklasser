import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, Music, Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { eventBookingFormSchema, type EventBookingForm, type EventType } from "@shared/schema";
import { z } from "zod";

interface EventRegistrationFormProps {
  onSubmit?: (data: EventBookingForm) => void;
}

export default function EventRegistrationForm({ onSubmit }: EventRegistrationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  
  // Fetch event types from API
  const { data: eventTypesData, isLoading: isLoadingEventTypes } = useQuery<{
    success: boolean;
    eventTypes: EventType[];
  }>({
    queryKey: ['/api/event-types'],
  });
  
  const form = useForm<EventBookingForm>({
    resolver: zodResolver(eventBookingFormSchema.extend({
      // Override eventTypeId to accept string from form and convert to number
      eventTypeId: z.coerce.number().int().positive({
        message: "Please select a valid event type",
      }),
    })),
    defaultValues: {
      eventTypeId: "" as any, // Form handles as string, gets coerced to number
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      requestedDate: "",
      startTime: "",
      durationHours: 2, // Will be auto-updated based on selected event type
      additionalNotes: "",
    },
  });
  
  // Watch for event type changes to auto-populate duration
  const selectedEventTypeId = form.watch('eventTypeId');
  
  useEffect(() => {
    if (selectedEventTypeId && eventTypesData?.eventTypes) {
      // Convert string form value to number for comparison with integer IDs  
      const eventTypeId = typeof selectedEventTypeId === 'string' ? parseInt(selectedEventTypeId) : selectedEventTypeId;
      const selectedEventType = eventTypesData.eventTypes.find((et: EventType) => et.id === eventTypeId);
      if (selectedEventType) {
        // Convert minutes to hours for form display
        const durationHours = selectedEventType.defaultDurationMinutes / 60;
        form.setValue('durationHours', durationHours);
      }
    }
  }, [selectedEventTypeId, eventTypesData, form]);
  
  const createBookingMutation = useMutation({
    mutationFn: async (data: EventBookingForm) => {
      return apiRequest('POST', '/api/bookings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
  });

  const handleSubmit = async (data: EventBookingForm) => {
    setIsSubmitting(true);
    console.log('Event registration submitted:', data);
    
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Use the API mutation
        await createBookingMutation.mutateAsync(data);
      }
      
      toast({
        title: "Anmälan skickad!",
        description: "Vi kommer att granska din förfrågan och återkomma snart.",
      });
      
      form.reset();
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: "Fel",
        description: "Något gick fel. Vänligen försök igen.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get event types from API data with fallback icons
  const eventTypes = eventTypesData?.eventTypes?.map((eventType: EventType) => ({
    ...eventType,
    icon: eventType.slug === 'luciatag' ? Music : Users, // Fallback icon mapping
  })) || [];
  
  // Show loading state while fetching event types
  if (isLoadingEventTypes) {
    return (
      <Card className="w-full max-w-2xl mx-auto" data-testid="card-event-registration">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Boka ditt julevenemang
          </CardTitle>
          <CardDescription>
            Begär en bokning för luciatåg eller sjungande julgran. Vi kommer att granska din förfrågan och bekräfta tillgänglighet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Laddar eventtyper...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto" data-testid="card-event-registration">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Boka ditt julevenemang
        </CardTitle>
        <CardDescription>
          Begär en bokning för luciatåg eller sjungande julgran. Vi kommer att granska din förfrågan och bekräfta tillgänglighet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="eventTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eventtyp</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value?.toString() || ""}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      data-testid="radio-event-type"
                    >
                      {eventTypes.map((type) => {
                        const Icon = type.icon;
                        // Convert integer ID to string for form handling
                        const typeIdString = type.id.toString();
                        return (
                          <div key={type.id} className="relative">
                            <RadioGroupItem
                              value={typeIdString}
                              id={`eventtype-${typeIdString}`}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={typeIdString}
                              className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover-elevate cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                              data-testid={`label-event-${type.id}`}
                            >
                              <Icon className="w-8 h-8 mb-2 text-primary" />
                              <div className="text-center">
                                <div className="font-semibold">{type.name}</div>
                                <div className="text-sm text-muted-foreground">{type.description}</div>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kontaktnamn</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ditt fullständiga namn" 
                        {...field} 
                        data-testid="input-contact-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-post</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="din@epost.se" 
                        {...field} 
                        data-testid="input-contact-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefonnummer</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="+46 70 123 45 67" 
                      {...field} 
                      data-testid="input-contact-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="requestedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Önskat datum</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-requested-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starttid</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field} 
                        data-testid="input-start-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Varaktighet (timmar)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0.5" 
                        max="8" 
                        step="0.5" 
                        {...field}
                        value={field.value.toString()}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.5)} 
                        data-testid="input-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ytterligare anteckningar</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Övrig info, t.ex. önskat antal set, om någon speciell klass önskas, etc."
                      className="resize-none"
                      rows={4}
                      {...field}
                      data-testid="textarea-additional-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
              data-testid="button-submit-registration"
            >
              {isSubmitting ? "Skickar..." : "Skicka eventförfrågan"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}