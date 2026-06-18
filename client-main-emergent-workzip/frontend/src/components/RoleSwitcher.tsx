import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, GraduationCap, School, Building2, Heart, Shield, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type Role = 'parent' | 'student' | 'institute' | 'teacher' | 'ngo' | 'admin';

interface RoleSwitcherProps {
  currentRole: string;
  availableRoles: string[];
  onRoleChange?: (newRole: string) => void;
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

const ROLE_CONFIG: Record<Role, { label: string; icon: typeof User; color: string; description: string }> = {
  parent: {
    label: 'Parent',
    icon: User,
    color: '#0B3C5D',
    description: 'Manage children & track progress'
  },
  student: {
    label: 'Student',
    icon: GraduationCap,
    color: '#4ECDC4',
    description: 'Take exams & view results'
  },
  institute: {
    label: 'Institute',
    icon: School,
    color: '#0B3C5D',
    description: 'Manage students & batches'
  },
  teacher: {
    label: 'Teacher',
    icon: Building2,
    color: '#EA580C',
    description: 'Create & grade assessments'
  },
  ngo: {
    label: 'NGO',
    icon: Heart,
    color: '#DC2626',
    description: 'Access program analytics'
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: '#0369A1',
    description: 'Full system access'
  }
};

export function RoleSwitcher({ 
  currentRole, 
  availableRoles, 
  onRoleChange,
  variant = 'default',
  className = ''
}: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const response = await apiRequest('POST', '/api/user/switch-role', { role: newRole });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to switch role');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      onRoleChange?.(data.role);
      setIsOpen(false);
    },
    onError: (error: Error) => {
      console.error('Role switch failed:', error.message);
      setIsOpen(false);
    }
  });

  const currentConfig = ROLE_CONFIG[currentRole as Role] || ROLE_CONFIG.parent;
  const CurrentIcon = currentConfig.icon;

  if (availableRoles.length <= 1) {
    return null;
  }

  if (variant === 'minimal') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className={`gap-2 ${className}`}
            disabled={switchRoleMutation.isPending}
            data-testid="role-switcher-minimal"
          >
            {switchRoleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CurrentIcon className="h-4 w-4" />
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableRoles.map((role) => {
            const config = ROLE_CONFIG[role as Role] || ROLE_CONFIG.parent;
            const Icon = config.icon;
            const isActive = role === currentRole;
            
            return (
              <DropdownMenuItem
                key={role}
                onClick={() => !isActive && switchRoleMutation.mutate(role)}
                className={`gap-2 cursor-pointer ${isActive ? 'bg-muted' : ''}`}
                data-testid={`role-option-${role}`}
              >
                <Icon className="h-4 w-4" style={{ color: config.color }} />
                <span>{config.label}</span>
                {isActive && <Check className="h-4 w-4 ml-auto text-teal-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={`gap-2 ${className}`}
            disabled={switchRoleMutation.isPending}
            data-testid="role-switcher-compact"
          >
            {switchRoleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CurrentIcon className="h-4 w-4" style={{ color: currentConfig.color }} />
                <span className="font-medium">{currentConfig.label}</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Role
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableRoles.map((role) => {
            const config = ROLE_CONFIG[role as Role] || ROLE_CONFIG.parent;
            const Icon = config.icon;
            const isActive = role === currentRole;
            
            return (
              <DropdownMenuItem
                key={role}
                onClick={() => !isActive && switchRoleMutation.mutate(role)}
                className={`gap-3 py-2 cursor-pointer ${isActive ? 'bg-muted' : ''}`}
                data-testid={`role-option-${role}`}
              >
                <Icon className="h-5 w-5" style={{ color: config.color }} />
                <div className="flex-1">
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
                {isActive && <Check className="h-4 w-4 text-teal-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant - full card style
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`gap-3 h-auto py-2 px-4 ${className}`}
          disabled={switchRoleMutation.isPending}
          data-testid="role-switcher-default"
        >
          {switchRoleMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${currentConfig.color}20` }}
              >
                <CurrentIcon className="h-4 w-4" style={{ color: currentConfig.color }} />
              </div>
              <div className="text-left">
                <div className="text-xs text-muted-foreground">Current Role</div>
                <div className="font-semibold">{currentConfig.label}</div>
              </div>
            </>
          )}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
          Switch Role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableRoles.map((role) => {
          const config = ROLE_CONFIG[role as Role] || ROLE_CONFIG.parent;
          const Icon = config.icon;
          const isActive = role === currentRole;
          
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => !isActive && switchRoleMutation.mutate(role)}
              className={`gap-3 py-3 cursor-pointer ${isActive ? 'bg-muted' : ''}`}
              data-testid={`role-option-${role}`}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon className="h-5 w-5" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{config.label}</div>
                <div className="text-xs text-muted-foreground truncate">{config.description}</div>
              </div>
              {isActive && (
                <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-teal-600" />
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
