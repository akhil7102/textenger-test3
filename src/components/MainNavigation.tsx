import { Home, Users, MessageSquare, User, Settings, Volume2, Shield, Hash, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-mobile";

interface MainNavigationProps {
  onPageChange: (pageId: string) => void;
  activePage: string;
}

export function MainNavigation({ onPageChange, activePage }: MainNavigationProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const navigationItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'browse-friends', label: 'Browse Friends', icon: Users },
    { id: 'direct-messages', label: 'Direct Messages', icon: MessageSquare },
    { id: 'room-chat', label: 'Room Chat', icon: Hash },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'audio-settings', label: 'Audio Settings', icon: Volume2 },
    { id: 'room-profile', label: 'Room Profile', icon: Shield },
  ];

  if (isMobile) {
    return (
      <>
        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 md:hidden">
          <div className="flex justify-around items-center py-2">
            {navigationItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center gap-1 p-2 h-auto ${
                    activePage === item.id 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                  }`}
                  onClick={() => onPageChange(item.id)}
                >
                  <Icon size={20} />
                  <span className="text-xs">{item.label}</span>
                </Button>
              );
            })}
            
            {/* More menu for additional pages */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-1 p-2 h-auto text-muted-foreground"
                >
                  <Menu size={20} />
                  <span className="text-xs">More</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-64">
                <div className="grid grid-cols-2 gap-4 p-4">
                  {navigationItems.slice(4).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className={`flex flex-col items-center gap-2 p-4 h-auto ${
                          activePage === item.id 
                            ? 'bg-muted text-foreground gradient-border' 
                            : 'text-muted-foreground hover-glow'
                        }`}
                        onClick={() => {
                          onPageChange(item.id);
                          // Close sheet after selection
                          const sheet = document.querySelector('[data-radix-sheet-content]');
                          if (sheet) {
                            (sheet as any).click();
                          }
                        }}
                      >
                        <Icon size={24} />
                        <span className="text-sm">{item.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Top Header */}
        <div className="md:hidden p-4 border-b border-border bg-background">
          <h1 className="text-lg font-semibold gradient-text">Textenger</h1>
        </div>
      </>
    );
  }

  // Desktop Sidebar Navigation
  return (
    <div className="w-60 bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold gradient-text">Textenger</h1>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-6">
        {/* Discover Section */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Discover
          </h2>
          <div className="space-y-1">
            {navigationItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`w-full justify-start gap-3 ${
                    activePage === item.id 
                      ? 'bg-muted text-foreground gradient-border' 
                      : 'text-muted-foreground hover-glow'
                  }`}
                  onClick={() => onPageChange(item.id)}
                >
                  <Icon size={18} />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Settings Section */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Settings
          </h2>
          <div className="space-y-1">
            {navigationItems.slice(4).map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`w-full justify-start gap-3 ${
                    activePage === item.id 
                      ? 'bg-muted text-foreground gradient-border' 
                      : 'text-muted-foreground hover-glow'
                  }`}
                  onClick={() => onPageChange(item.id)}
                >
                  <Icon size={18} />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}