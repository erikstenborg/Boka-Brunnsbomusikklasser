import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, Music, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { eventBookingFormSchema, type EventBookingForm } from "@shared/schema";

interface EventRegistrationFormProps {
  onSubmit?: (data: EventBookingForm) => void;
}

export default function EventRegistrationForm({ onSubmit }: EventRegistrationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  
  const form = useForm<EventBookingForm>({
    resolver: zodResolver(eventBookingFormSchema),
    defaultValues: {
      eventType: "" as any, // Set to empty string instead of undefined to avoid validation mismatch
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      requestedDate: "",
      startTime: "",
      durationHours: 2,
      additionalNotes: "",
    },
  });
  
  const createBookingMutation = useMutation({
    mutationFn: async (data: EventBookingForm) => {
      return apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
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

  const eventTypes = [
    {
      id: "luciatag",
      name: "Luciatåg",
      description: "Traditionell svensk luciafirande",
      icon: Music,
    },
    {
      id: "sjungande_julgran",
      name: "Sjungande Julgran",
      description: "Julgransuppvisning med sång",
      icon: Users,
    },
  ];

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
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eventtyp</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      data-testid="radio-event-type"
                    >
                      {eventTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <div key={type.id} className="relative">
                            <RadioGroupItem
                              value={type.id}
                              id={type.id}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={type.id}
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
                      placeholder="Särskilda krav, antal deltagare, etc."
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