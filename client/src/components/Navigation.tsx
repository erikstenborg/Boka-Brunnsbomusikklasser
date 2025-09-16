import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { CalendarDays, Kanban, LogOut, Settings, User } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";

interface NavigationProps {
  currentView?: "public" | "admin";
  currentPage?: "form" | "calendar" | "kanban";
  isAuthenticated?: boolean;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onViewChange?: (view: "public" | "admin") => void;
  onPageChange?: (page: "form" | "calendar" | "kanban") => void;
  onLogin?: () => void;
  onLogout?: () => void;
  className?: string;
}

export default function Navigation({ 
  currentView = "public",
  currentPage = "form",
  isAuthenticated = false,
  user,
  onViewChange,
  onPageChange,
  onLogin,
  onLogout,
  className 
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleViewChange = (view: "public" | "admin") => {
    console.log(`Switching to ${view} view`);
    if (onViewChange) {
      onViewChange(view);
    }
  };

  const handlePageChange = (page: "form" | "calendar" | "kanban") => {
    console.log(`Navigating to ${page} page`);
    if (onPageChange) {
      onPageChange(page);
    }
  };

  const handleLogin = () => {
    console.log('Login clicked');
    if (onLogin) {
      onLogin();
    }
  };

  const handleLogout = () => {
    console.log('Logout clicked');
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <nav className={cn("border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary" data-testid="text-brand-name">
              Julbokningar
            </span>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center space-x-1">
            <Button
              variant={currentView === "public" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("public")}
              data-testid="button-view-public"
            >
              Public
            </Button>
            <Button
              variant={currentView === "admin" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("admin")}
              disabled={!isAuthenticated}
              data-testid="button-view-admin"
            >
              Admin
              {!isAuthenticated && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Login Required
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center space-x-1">
          {currentView === "public" && (
            <>
              <Button
                variant={currentPage === "form" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePageChange("form")}
                data-testid="button-page-form"
              >
                Book Event
              </Button>
              <Button
                variant={currentPage === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePageChange("calendar")}
                data-testid="button-page-calendar"
              >
                View Calendar
              </Button>
            </>
          )}
          
          {currentView === "admin" && isAuthenticated && (
            <>
              <Button
                variant={currentPage === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePageChange("kanban")}
                data-testid="button-page-kanban"
              >
                <Kanban className="h-4 w-4 mr-1" />
                Workflow
              </Button>
              <Button
                variant={currentPage === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePageChange("calendar")}
                data-testid="button-page-admin-calendar"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Calendar
              </Button>
            </>
          )}
        </div>

        {/* User Actions */}
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          
          {!isAuthenticated ? (
            <Button 
              onClick={handleLogin}
              data-testid="button-login"
            >
              Login with Google
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-9 w-9 rounded-full"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback>
                      {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => console.log('Profile clicked')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => console.log('Settings clicked')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
}