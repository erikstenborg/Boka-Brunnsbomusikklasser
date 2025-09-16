import ThemeToggle from '../ThemeToggle';

export default function ThemeToggleExample() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Theme Toggle</h1>
        <p className="text-muted-foreground">
          Click the button to switch between light and dark themes:
        </p>
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
        <div className="space-y-2 p-4 border rounded-lg">
          <h3 className="font-semibold">Sample Content</h3>
          <p className="text-muted-foreground">
            This text changes color with the theme to demonstrate the toggle functionality.
          </p>
        </div>
      </div>
    </div>
  );
}