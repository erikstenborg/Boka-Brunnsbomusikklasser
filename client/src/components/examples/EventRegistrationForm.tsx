import EventRegistrationForm from '../EventRegistrationForm';

export default function EventRegistrationFormExample() {
  const handleSubmit = (data: any) => {
    console.log('Registration submitted:', data);
    // Simulate submission delay
    return new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <EventRegistrationForm onSubmit={handleSubmit} />
    </div>
  );
}