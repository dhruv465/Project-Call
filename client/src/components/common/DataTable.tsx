import React from 'react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  placeholderRows?: number;
  className?: string;
  enableSelection?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onRowClick?: (row: T) => void;
}

interface ColumnDef<T> {
  accessorKey?: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  placeholderRows = 5,
  className,
  enableSelection = false,
  showSearch = false,
  searchPlaceholder = "Search...",
  onSearchChange,
  onRowClick
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = React.useState<Record<string, boolean>>({});
  const [sortConfig, setSortConfig] = React.useState<{
    key: string | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected: Record<string, boolean> = {};
      data.forEach((_, index) => {
        newSelected[index.toString()] = true;
      });
      setSelectedRows(newSelected);
    } else {
      setSelectedRows({});
    }
  };

  const handleSelectRow = (index: string, checked: boolean) => {
    setSelectedRows(prev => ({
      ...prev,
      [index]: checked
    }));
  };

  const allSelected = data.length > 0 && Object.keys(selectedRows).length === data.length;
  const someSelected = Object.keys(selectedRows).length > 0 && !allSelected;

  return (
    <div className={cn("space-y-4", className)}>
      {showSearch && (
        <div className="flex items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-9 h-10"
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        </div>
      )}
      
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {enableSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    // Custom indeterminate state handled in CSS
                    className={cn("ml-1.5", someSelected && "data-[state=checked]:bg-primary/50")}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              
              {columns.map((column, i) => (
                <TableHead 
                  key={i} 
                  className={cn(
                    column.sortable && "cursor-pointer select-none",
                    column.className
                  )}
                  onClick={() => column.sortable && column.accessorKey && handleSort(column.accessorKey)}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && column.accessorKey && (
                      <span className="ml-1">
                        {sortConfig.key === column.accessorKey ? (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading state with placeholder rows
              Array.from({ length: placeholderRows }).map((_, rowIndex) => (
                <TableRow key={`loading-${rowIndex}`}>
                  {enableSelection && (
                    <TableCell>
                      <div className="h-4 w-4 bg-muted/60 rounded animate-pulse ml-1.5" />
                    </TableCell>
                  )}
                  {columns.map((_, colIndex) => (
                    <TableCell key={`loading-${rowIndex}-${colIndex}`}>
                      <div className="h-5 bg-muted/60 rounded animate-pulse w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (enableSelection ? 1 : 0)} 
                  className="h-32 text-center text-muted-foreground"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              data.map((row, rowIndex) => (
                <TableRow 
                  key={rowIndex}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {enableSelection && (
                    <TableCell 
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Checkbox
                        checked={!!selectedRows[rowIndex.toString()]}
                        onCheckedChange={(checked) => 
                          handleSelectRow(rowIndex.toString(), !!checked)
                        }
                        aria-label={`Select row ${rowIndex + 1}`}
                        className="ml-1.5"
                      />
                    </TableCell>
                  )}
                  
                  {columns.map((column, colIndex) => (
                    <TableCell 
                      key={`${rowIndex}-${colIndex}`} 
                      className={column.className}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function StatusBadge({ 
  status, 
  variant = 'default'
}: { 
  status: string; 
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}) {
  return (
    <Badge variant={variant} className="h-6 px-2 text-xs font-normal">
      {status}
    </Badge>
  );
}

export function TableActions({
  onEdit,
  onDelete,
  onView,
  disabled = false,
  className
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0" 
            disabled={disabled}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {onView && (
            <DropdownMenuItem onClick={onView}>
              View details
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
