import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CalendarDays, Clock, Music, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const eventRegistrationSchema = z.object({
  eventType: z.enum(["luciatag", "sjungande_julgran"], {
    required_error: "Vänligen välj en eventtyp",
  }),
  contactName: z.string().min(2, "Namnet måste vara minst 2 tecken"),
  contactEmail: z.string().email("Vänligen ange en giltig e-postadress"),
  contactPhone: z.string().min(10, "Vänligen ange ett giltigt telefonnummer"),
  requestedDate: z.string().min(1, "Vänligen välj ett datum"),
  startTime: z.string().min(1, "Vänligen välj en starttid"),
  duration: z.string().default("2"),
  additionalNotes: z.string().optional(),
});

type EventRegistrationForm = z.infer<typeof eventRegistrationSchema>;

interface EventRegistrationFormProps {
  onSubmit?: (data: EventRegistrationForm) => void;
}

export default function EventRegistrationForm({ onSubmit }: EventRegistrationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EventRegistrationForm>({
    resolver: zodResolver(eventRegistrationSchema),
    defaultValues: {
      eventType: undefined,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      requestedDate: "",
      startTime: "",
      duration: "2",
      additionalNotes: "",
    },
  });

  const handleSubmit = async (data: EventRegistrationForm) => {
    setIsSubmitting(true);
    console.log('Event registration submitted:', data);
    
    try {
      if (onSubmit) {
        await onSubmit(data);
      }
      
      toast({
        title: "Anmälan skickad!",
        description: "Vi kommer att granska din förfrågan och återkomma snart.",
      });
      
      form.reset();
    } catch (error) {
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
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Varaktighet (timmar)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="8" 
                        step="0.5" 
                        {...field} 
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