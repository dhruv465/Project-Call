import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

interface DashboardCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export function DashboardCard({
  title,
  description,
  icon,
  footer,
  className,
  children,
  onClick
}: DashboardCardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-300 border hover:border-border/80 hover:shadow-sm",
        onClick && "cursor-pointer hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {icon && <div className="text-muted-foreground/60">{icon}</div>}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
