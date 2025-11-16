"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
  Column,
  SortingState,
  getSortedRowModel,
  PaginationState,
  getPaginationRowModel,
  VisibilityState,
} from "@tanstack/react-table"
import { CSSProperties, useRef, useState, useEffect, useMemo } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Checkbox } from "./checkbox"
import { Button } from "./button"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  headerTitleElement?: React.ReactNode
  headerActionElement?: React.ReactNode
  footerLeftElement?: React.ReactNode
  selectedRowActions?: React.ReactNode
  enableSelection?: boolean
  onRowSelectionChange?: (updaterOrValue: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void
  leftStickyColumnsCount?: number
  rightStickyColumnsCount?: number
  defaultColumnSize?: number
  enableSorting?: boolean
  enablePagination?: boolean
  pageSize?: number
  fullWidth?: boolean
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  isLoading?: boolean
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string
}

interface ShadowOpacity {
  left: number;
  right: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  headerTitleElement,
  headerActionElement,
  footerLeftElement,
  selectedRowActions,
  enableSelection = false,
  onRowSelectionChange,
  leftStickyColumnsCount = 0,
  rightStickyColumnsCount = 0,
  defaultColumnSize = 116,
  enableSorting = false,
  enablePagination = false,
  pageSize = 10,
  fullWidth = false,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange,
  isLoading = false,
  onRowClick,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [shadowOpacity, setShadowOpacity] = useState<ShadowOpacity>({ left: 0, right: 1 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});
  const [{ pageIndex, pageSize: currentPageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize,
  });
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Use external column visibility if provided, otherwise use internal state
  const columnVisibility = externalColumnVisibility ?? internalColumnVisibility;
  const setColumnVisibility = onColumnVisibilityChange ?? setInternalColumnVisibility;

  useEffect(() => {
    const handleScroll = () => {
      const el = tableWrapperRef.current;
      if (!el) return;

      const scrollLeft = el.scrollLeft;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const threshold = 10; // 10px threshold for fade effect

      // Calculate opacity based on scroll position
      const leftOpacity = Math.min(scrollLeft / threshold, 1);
      const rightOpacity = Math.min((maxScroll - scrollLeft) / threshold, 1);

      setShadowOpacity({ left: leftOpacity, right: rightOpacity });
    };

    const el = tableWrapperRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
    }

    return () => {
      if (el) {
        el.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Update container width on resize and initial mount
  useEffect(() => {
    const updateWidth = () => {
      if (tableWrapperRef.current) {
        setContainerWidth(tableWrapperRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const getCommonPinningStyles = (column: Column<any>): CSSProperties => {
    const isPinned = column.getIsPinned()
    const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left')
    const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right')

    const leftShadow = `-2px 0 3px -2px rgba(0,0,0,${0.3 * shadowOpacity.left}) inset`;
    const rightShadow = `2px 0 3px -2px rgba(0,0,0,${0.3 * shadowOpacity.right}) inset`;

    const size = column.getSize()

    return {
      // boxSizing: 'border-box',
      boxShadow: isLastLeftPinnedColumn
        ? leftShadow
        : isFirstRightPinnedColumn
          ? rightShadow
          : 'none',
      transition: 'box-shadow 0.1s linear',
      left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
      right: isPinned === 'right' ? `${column.getStart('right')}px` : undefined,
      position: isPinned ? 'sticky' : 'relative',
      width: `${size}px`,
      minWidth: `${size}px`,
      maxWidth: `${size}px`,
      zIndex: isPinned ? 1 : 0,
      // Remove borders from sticky columns to eliminate gaps
      ...(isPinned && {
        borderLeft: 'none',
        borderRight: 'none',
      }),
    }
  }

  // Create selection column if row selection is enabled
  const selectionColumn: ColumnDef<TData, any> = {
    id: "select",
    size: 40, // Increased to accommodate padding
    enablePinning: true,
    header: ({ table }) => (
      <div className="pl-[10px]">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="pl-[10px]">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      </div>
    ),
  };

  // Combine selection column with provided columns if row selection is enabled
  const allColumns = enableSelection
    ? [selectionColumn, ...columns]
    : columns;

  // Calculate column sizes with fullWidth support
  const columnsWithSizing = useMemo(() => {
    if (!fullWidth || containerWidth === 0) return allColumns;

    const columnsCopy = [...allColumns];

    // Get the last non-sticky column index
    const lastNonStickyColumnIndex = rightStickyColumnsCount > 0
      ? columnsCopy.length - rightStickyColumnsCount - 1
      : columnsCopy.length - 1;

    if (lastNonStickyColumnIndex < leftStickyColumnsCount) return allColumns;

    // Calculate total width of all columns except the last non-sticky one
    let totalWidth = 0;
    columnsCopy.forEach((col, index) => {
      if (index !== lastNonStickyColumnIndex) {
        totalWidth += (col.size || defaultColumnSize);
      }
    });

    // Calculate remaining width needed to fit container
    const remainingWidth = Math.max(containerWidth - totalWidth, defaultColumnSize);

    // Set size for the last non-sticky column
    columnsCopy[lastNonStickyColumnIndex] = {
      ...columnsCopy[lastNonStickyColumnIndex],
      size: remainingWidth,
    };

    return columnsCopy;
  }, [allColumns, containerWidth, fullWidth, leftStickyColumnsCount, rightStickyColumnsCount, defaultColumnSize]);

  const table = useReactTable({
    data,
    columns: columnsWithSizing,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: enableSelection,
    onRowSelectionChange: (updatedSelection) => {
      const newSelection = typeof updatedSelection === 'function'
        ? updatedSelection(rowSelection)
        : updatedSelection;

      // Only update if selection actually changed
      if (JSON.stringify(newSelection) !== JSON.stringify(rowSelection)) {
        setRowSelection(newSelection);
        if (onRowSelectionChange) {
          onRowSelectionChange(newSelection);
        }
      }
    },
    defaultColumn: {
      size: defaultColumnSize,
      // maxSize: 500,
    },
    enableColumnResizing: false,
    columnResizeMode: 'onEnd',
    state: {
      columnPinning: {
        left: [
          ...(enableSelection ? ['select'] : []),
          ...columns.slice(0, leftStickyColumnsCount).map(col => (col as any).accessorKey || (col as any).id)
        ],
        right: columns.slice(-rightStickyColumnsCount).map(col => (col as any).accessorKey || (col as any).id),
      },
      sorting,
      rowSelection,
      columnVisibility,
      ...(enablePagination && {
        pagination: { pageIndex, pageSize: currentPageSize },
      }),
    },
    onColumnVisibilityChange: setColumnVisibility,
    ...(enableSorting && {
      onSortingChange: setSorting,
      getSortedRowModel: getSortedRowModel(),
    }),
    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
      onPaginationChange: setPagination,
    }),
  });

  // Memoize the table body content
  const tableBody = useMemo(() => (
    <TableBody>
      {isLoading ? (
        // Skeleton rows
        Array.from({ length: currentPageSize }).map((_, rowIndex) => (
          <TableRow key={`skeleton-${rowIndex}`} className="group">
            {table.getAllColumns().filter(col => col.getIsVisible()).map((column) => (
              <TableCell
                key={`skeleton-${rowIndex}-${column.id}`}
                className={cn(
                  column.getIsPinned() && 'bg-background'
                )}
                style={getCommonPinningStyles(column)}
              >
                <div className="h-4 bg-muted animate-pulse rounded" />
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() && "selected"}
            className={cn("group", rowClassName?.(row.original), onRowClick && "cursor-pointer")}
            onClick={() => onRowClick?.(row.original)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(
                  cell.column.getIsPinned() && [
                    rowClassName?.(row.original),
                    'group-data-[state=selected]:bg-gray-900'
                  ]
                )}
                style={getCommonPinningStyles(cell.column)}
              >
                <div
                  className="overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell
            colSpan={allColumns.length}
            className="h-24 text-center text-sm text-muted-foreground"
          >
            No results.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  ), [isLoading, currentPageSize, table.getRowModel(), table.getAllColumns(), getCommonPinningStyles, rowClassName, onRowClick]);

  // Memoize the table header content
  const tableHeader = useMemo(() => (
    <TableHeader className="bg-background sticky top-0 z-10 uppercase">
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              className={cn(
                "bg-background text-xs",
                header.column.getIsPinned() ? 'bg-background' : '',
                header.column.getCanSort() && "cursor-pointer select-none"
              )}
              style={getCommonPinningStyles(header.column)}
              onClick={header.column.getToggleSortingHandler()}
            >
              {header.isPlaceholder ? null : (
                <div className="flex items-center justify-between group">
                  <div className="flex-grow whitespace-nowrap overflow-hidden text-ellipsis">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                  {header.column.getCanSort() && header.column.getIsSorted() && (
                    <div className="ml-2 shrink-0">
                      {header.column.getIsSorted() === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </div>
              )}

            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  ), [table.getHeaderGroups(), getCommonPinningStyles]);

  return (
    <div className="relative flex flex-col h-full">
      {(headerTitleElement || headerActionElement) && (
        <div className="flex justify-between items-center pt-2 pb-3">
          {headerTitleElement}
          {headerActionElement}
        </div>
      )}
      <div className="flex-1 flex flex-col justify-between min-h-0 relative">
        <div ref={tableWrapperRef} className="min-h-0 flex-1 overflow-auto relative rounded-md">
          <Table style={{ width: table.getTotalSize() }}>
            {tableHeader}
            {tableBody}
          </Table>
        </div>
      </div>
      {enablePagination && (
        <div className="flex justify-between items-center py-2 px-2 h-12">
          {/* Left side */}
          <div className="flex-1">
            {footerLeftElement}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <Pagination className="grow-0">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 p-0"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                </PaginationItem>

                {(() => {
                  const totalPages = table.getPageCount();
                  const currentPage = table.getState().pagination.pageIndex;
                  let startPage = currentPage;

                  if (currentPage <= 1) {
                    startPage = 0;
                  } else if (currentPage >= totalPages - 1) {
                    startPage = Math.max(0, totalPages - 3);
                  } else {
                    startPage = currentPage - 1;
                  }

                  const endPage = Math.min(startPage + 3, totalPages);

                  const pageButtons = [];
                  for (let i = startPage; i < endPage; i++) {
                    pageButtons.push(
                      <PaginationItem key={i}>
                        <PaginationLink
                          className="h-6 w-6 min-w-6 p-0 text-xs cursor-pointer select-none"
                          onClick={() => table.setPageIndex(i)}
                          isActive={currentPage === i}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }

                  return pageButtons;
                })()}

                <PaginationItem>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 p-0"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs whitespace-nowrap">Rows per page:</span>
              <Select
                value={table.getState().pagination.pageSize.toString()}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
