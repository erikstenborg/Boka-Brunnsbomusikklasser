import Navigation from '../Navigation';
import { useState } from 'react';

export default function NavigationExample() {
  const [currentView, setCurrentView] = useState<"public" | "admin">("public");
  const [currentPage, setCurrentPage] = useState<"form" | "calendar" | "kanban">("form");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // todo: remove mock functionality
  const mockUser = {
    name: "Maria Svensson",
    email: "maria@example.com",
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    console.log('User logged in');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView("public");
    console.log('User logged out');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        currentView={currentView}
        currentPage={currentPage}
        isAuthenticated={isAuthenticated}
        user={isAuthenticated ? mockUser : undefined}
        onViewChange={setCurrentView}
        onPageChange={setCurrentPage}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Navigation Demo</h1>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Current View:</strong> {currentView}
              </div>
              <div>
                <strong>Current Page:</strong> {currentPage}
              </div>
              <div>
                <strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>User:</strong> {isAuthenticated ? mockUser.name : 'None'}
              </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Navigation Test</h3>
              <p className="text-sm text-muted-foreground">
                • Try switching between Public and Admin views<br/>
                • Admin view requires login (click "Login with Google")<br/>
                • Navigate between different pages in each view<br/>
                • Test the user menu when logged in<br/>
                • Try the theme toggle
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}