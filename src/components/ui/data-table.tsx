'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  ColumnPinningState,
  Column,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { CSSProperties } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PostTypeFilter } from '@/components/PostTypeFilter'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  showPagination?: boolean
  globalFilterFn?: (row: TData, filterValue: string) => boolean
  contentTypeFilter?: {
    value: 'all' | 'video' | 'photo'
    onChange: (value: 'all' | 'video' | 'photo') => void
  }
  onPageChange?: (pageIndex: number, pageSize: number) => void
  onSortingChange?: (sorting: SortingState) => void
  sorting?: SortingState
  manualSorting?: boolean
  isLoading?: boolean
  onRowClick?: (row: TData) => void
  enableColumnPinning?: boolean
  getRowId?: (row: TData) => string
  hiddenColumns?: string[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  showPagination = true,
  globalFilterFn,
  contentTypeFilter,
  onPageChange,
  onSortingChange,
  sorting: externalSorting,
  manualSorting = false,
  isLoading,
  onRowClick,
  enableColumnPinning = false,
  getRowId,
  hiddenColumns = []
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Initialize column visibility with hidden columns
  const initialColumnVisibility = React.useMemo(() => {
    const visibility: VisibilityState = {}
    hiddenColumns.forEach(columnId => {
      visibility[columnId] = false
    })
    return visibility
  }, [hiddenColumns])

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility)
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [shadowOpacity, setShadowOpacity] = React.useState({ left: 0, right: 0 })

  const tableWrapperRef = React.useRef<HTMLDivElement>(null)

  // Extract column pinning configuration from column meta
  const initialColumnPinning = React.useMemo(() => {
    if (!enableColumnPinning) return { left: [], right: [] }

    const left: string[] = []
    const right: string[] = []

    columns.forEach((col: any) => {
      if (col.meta?.pinned === 'left' && col.accessorKey) {
        left.push(col.accessorKey as string)
      } else if (col.meta?.pinned === 'left' && col.id) {
        left.push(col.id)
      } else if (col.meta?.pinned === 'right' && col.accessorKey) {
        right.push(col.accessorKey as string)
      } else if (col.meta?.pinned === 'right' && col.id) {
        right.push(col.id)
      }
    })

    return { left, right }
  }, [columns, enableColumnPinning])

  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(initialColumnPinning)

  // Use external sorting if provided, otherwise use internal
  const sorting = manualSorting && externalSorting !== undefined ? externalSorting : internalSorting
  const setSorting = manualSorting && onSortingChange ? onSortingChange : setInternalSorting

  // Function to get pinning styles for columns
  const getCommonPinningStyles = (column: Column<any>): CSSProperties => {
    const isPinned = column.getIsPinned()
    const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left')
    const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right')

    const leftShadow = `-2px 0 3px -2px rgba(0,0,0,${0.3 * shadowOpacity.left}) inset`
    const rightShadow = `2px 0 3px -2px rgba(0,0,0,${0.3 * shadowOpacity.right}) inset`

    return {
      boxShadow: isLastLeftPinnedColumn ? leftShadow
                : isFirstRightPinnedColumn ? rightShadow
                : 'none',
      transition: 'box-shadow 0.1s linear',
      left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
      right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
      position: isPinned ? 'sticky' : 'relative',
      width: column.getSize(),
      zIndex: isPinned ? 1 : 0,
    }
  }

  const table = useReactTable({
    data,
    columns,
    getRowId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnPinningChange: setColumnPinning,
    manualSorting,
    globalFilterFn: globalFilterFn ? (row, _columnId, filterValue) => {
      return globalFilterFn(row.original, filterValue)
    } : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnPinning: enableColumnPinning ? columnPinning : { left: [], right: [] },
    },
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  })

  // Scroll event listener for shadow fade effect
  React.useEffect(() => {
    if (!enableColumnPinning || !tableWrapperRef.current) return

    const handleScroll = () => {
      const el = tableWrapperRef.current
      if (!el) return

      const scrollLeft = el.scrollLeft
      const maxScroll = el.scrollWidth - el.clientWidth
      const threshold = 10 // 10px threshold for fade effect

      const leftOpacity = Math.min(scrollLeft / threshold, 1)
      const rightOpacity = Math.min((maxScroll - scrollLeft) / threshold, 1)

      setShadowOpacity({ left: leftOpacity, right: rightOpacity })
    }

    const el = tableWrapperRef.current
    el.addEventListener('scroll', handleScroll)

    // Initial check
    handleScroll()

    return () => {
      el.removeEventListener('scroll', handleScroll)
    }
  }, [enableColumnPinning])

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto] min-h-0">
      {/* Filters - Auto height at top */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 border-b bg-background">
        {globalFilterFn ? (
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-full sm:max-w-sm"
          />
        ) : searchKey ? (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="w-full sm:max-w-sm"
          />
        ) : null}

        <div className="flex items-center gap-2 sm:ml-auto">
          {contentTypeFilter && (
            <PostTypeFilter
              value={contentTypeFilter.value}
              onChange={contentTypeFilter.onChange}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scrollable table container - Critical: min-h-0 for flex scrolling */}
      <div ref={tableWrapperRef} className="overflow-auto min-h-0">
        <Table className="relative">
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => {
                  const pinningStyles = enableColumnPinning
                    ? getCommonPinningStyles(header.column)
                    : {}

                  return (
                    <TableHead
                      key={header.id}
                      className="bg-background"
                      style={pinningStyles}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinningStyles = enableColumnPinning
                      ? getCommonPinningStyles(cell.column)
                      : {}

                    return (
                      <TableCell
                        key={cell.id}
                        style={pinningStyles}
                        className={cell.column.getIsPinned() ? 'bg-background' : ''}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{' '}
              of {table.getFilteredRowModel().rows.length} entries
            </div>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value)
                table.setPageSize(newSize)
                if (onPageChange) {
                  onPageChange(table.getState().pagination.pageIndex, newSize)
                }
              }}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            >
              {[10, 25, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize} per page
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                table.previousPage()
                if (onPageChange) {
                  onPageChange(table.getState().pagination.pageIndex - 1, table.getState().pagination.pageSize)
                }
              }}
              disabled={!table.getCanPreviousPage() || isLoading}
              className="flex-1 sm:flex-none"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                table.nextPage()
                if (onPageChange) {
                  onPageChange(table.getState().pagination.pageIndex + 1, table.getState().pagination.pageSize)
                }
              }}
              disabled={!table.getCanNextPage() || isLoading}
              className="flex-1 sm:flex-none"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to create sortable column headers
export function createSortableHeader(title: string) {
  return ({ column }: { column: any }) => {
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-auto p-0 hover:bg-transparent"
      >
        {title}
        <ArrowUpDown className="h-2 w-2" />
      </Button>
    )
  }
}