import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  ShoppingCart,
  BarChart3,
  Settings,
  Printer,
  LogOut,
  Store,
  ArrowRight,
  Crown,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface POSNavHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  showBackButton?: boolean;
  backPath?: string;
}

const navItems = [
  { href: '/pos', label: 'الكاشير', icon: ShoppingCart },
  { href: '/pos-daily-report', label: 'تقرير اليوم', icon: BarChart3 },
  { href: '/pos-settings', label: 'الإعدادات', icon: Settings },
  { href: '/pos-print-settings', label: 'الطباعة', icon: Printer },
];

export default function POSNavHeader({ 
  title, 
  subtitle, 
  icon,
  showBackButton = true,
  backPath = '/pos'
}: POSNavHeaderProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <header className="h-16 bg-card border-b flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-50">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Link href={backPath}>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            {icon || <Store className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2 h-9",
                    isActive && "bg-primary/10 text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
          
          {/* Admin Link */}
          {isAdmin && (
            <>
              <div className="w-px h-6 bg-border mx-2" />
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Crown className="h-4 w-4 text-amber-500" />
                  لوحة التحكم
                </Button>
              </Link>
            </>
          )}
          
          {/* User Info & Logout */}
          <div className="w-px h-6 bg-border mx-2" />
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
              <Badge variant="outline" className="text-xs">
                {user?.role === 'admin' ? 'مدير' : user?.role === 'supervisor' ? 'مشرف' : 'موظف'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </nav>
        
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-card border-b p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-12",
                    isActive && "bg-primary/10 text-primary"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
          
          {isAdmin && (
            <>
              <div className="border-t my-2" />
              <Link href="/dashboard">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Crown className="h-5 w-5 text-amber-500" />
                  لوحة التحكم الرئيسية
                </Button>
              </Link>
            </>
          )}
          
          <div className="border-t my-2" />
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {user?.name?.charAt(0) || 'م'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.role === 'admin' ? 'مدير' : user?.role === 'supervisor' ? 'مشرف' : 'موظف'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
