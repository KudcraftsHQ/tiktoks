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
import { ArrowUpDown, ChevronDown, ArrowUp, ArrowDown, LayoutList, LayoutGrid } from 'lucide-react'
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
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface PostCategory {
  id: string
  name: string
  postCount: number
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  showPagination?: boolean
  globalFilterFn?: (row: TData, filterValue: string) => boolean
  categoryFilter?: {
    value: string
    onChange: (value: string) => void
  }
  dateRangeFilter?: {
    value: DateRange
    onChange: (range: DateRange) => void
  }
  onPageChange?: (pageIndex: number, pageSize: number) => void
  onSortingChange?: (sorting: SortingState) => void
  sorting?: SortingState
  manualSorting?: boolean
  manualPagination?: boolean
  totalRows?: number
  isLoading?: boolean
  onRowClick?: (row: TData) => void
  enableColumnPinning?: boolean
  getRowId?: (row: TData) => string
  hiddenColumns?: string[]
  initialColumnVisibility?: VisibilityState
  customHeaderActions?: React.ReactNode
  hideColumnSelector?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  showPagination = true,
  globalFilterFn,
  categoryFilter,
  dateRangeFilter,
  onPageChange,
  onSortingChange,
  sorting: externalSorting,
  manualSorting = false,
  manualPagination = false,
  totalRows,
  isLoading,
  onRowClick,
  enableColumnPinning = false,
  getRowId,
  hiddenColumns = [],
  initialColumnVisibility: externalInitialColumnVisibility,
  customHeaderActions,
  hideColumnSelector = false
}: DataTableProps<TData, TValue>) {
  // Fetch categories for filter
  const [categories, setCategories] = React.useState<PostCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(false)

  React.useEffect(() => {
    // Only fetch if category filter is provided
    if (!categoryFilter) return

    const fetchCategories = async () => {
      setCategoriesLoading(true)
      try {
        const response = await fetch('/api/post-categories')
        const result = await response.json()
        if (result.success && result.data) {
          setCategories(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setCategoriesLoading(false)
      }
    }

    fetchCategories()
  }, [categoryFilter])
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Initialize column visibility with hidden columns or external visibility
  const computedInitialColumnVisibility = React.useMemo(() => {
    if (externalInitialColumnVisibility) {
      return externalInitialColumnVisibility
    }

    const visibility: VisibilityState = {}
    hiddenColumns.forEach(columnId => {
      visibility[columnId] = false
    })
    return visibility
  }, [JSON.stringify(hiddenColumns), externalInitialColumnVisibility])

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(computedInitialColumnVisibility)

  // Update column visibility when external visibility changes
  React.useEffect(() => {
    setColumnVisibility(computedInitialColumnVisibility)
  }, [JSON.stringify(computedInitialColumnVisibility)])
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [shadowOpacity, setShadowOpacity] = React.useState({ left: 0, right: 0 })
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 25,
  })

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
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnPinningChange: setColumnPinning,
    manualSorting,
    manualPagination,
    enableMultiSort: true, // Enable multi-column sorting (Shift+Click)
    sortDescFirst: true, // Prioritize descending sort first
    pageCount: manualPagination && totalRows !== undefined
      ? Math.ceil(totalRows / pagination.pageSize)
      : undefined,
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
      pagination,
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

  // Check if we should show the filter bar
  const hasSearchOrFilters = !!(
    globalFilterFn ||
    searchKey ||
    customHeaderActions ||
    dateRangeFilter ||
    categoryFilter ||
    !hideColumnSelector
  )

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto] min-h-0">
      {/* Filters - Auto height at top */}
      {hasSearchOrFilters && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 pb-3 border-b bg-background">
          {globalFilterFn ? (
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="w-full sm:max-w-sm h-8 text-xs"
            />
          ) : searchKey ? (
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              className="w-full sm:max-w-sm h-8 text-xs"
            />
          ) : null}

          <div className="flex items-center gap-2 sm:ml-auto">
            {customHeaderActions}
            {dateRangeFilter && (
              <DateRangeFilter
                value={dateRangeFilter.value}
                onChange={dateRangeFilter.onChange}
              />
            )}
            {categoryFilter && (
              <Select
                value={categoryFilter.value}
                onValueChange={categoryFilter.onChange}
                disabled={categoriesLoading}
              >
                <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                  <SelectValue placeholder={categoriesLoading ? "Loading..." : "All Categories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-xs">
                      {category.name} ({category.postCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!hideColumnSelector && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto h-8 text-xs px-3">
                    Columns <ChevronDown className="ml-1.5 h-3 w-3" />
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
            )}
          </div>
        </div>
      )}

      {/* Scrollable table container - Critical: min-h-0 for flex scrolling */}
      <div ref={tableWrapperRef} className="overflow-auto min-h-0 relative">
        {/* Loading overlay - full screen centered spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
            <div className="flex items-center gap-3 bg-background/95 px-6 py-4 rounded-lg shadow-lg border">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span className="text-sm font-medium">Loading...</span>
            </div>
          </div>
        )}

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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                // Check if this is a reference row
                const isReferenceRow = (row.original as any)._rowType === 'reference'
                const rowClassName = [
                  onRowClick ? 'cursor-pointer group' : '',
                  isReferenceRow ? 'bg-[#383838]' : ''
                ].filter(Boolean).join(' ')

                return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  className={rowClassName}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinningStyles = enableColumnPinning
                      ? getCommonPinningStyles(cell.column)
                      : {}

                    return (
                      <TableCell
                        key={cell.id}
                        style={pinningStyles}
                        className={isReferenceRow ? "bg-[#383838]" : "bg-background"}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
                )
              })
            ) : !isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {showPagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {(() => {
                const pageIndex = table.getState().pagination.pageIndex
                const pageSize = table.getState().pagination.pageSize
                const total = manualPagination && totalRows !== undefined 
                  ? totalRows 
                  : table.getFilteredRowModel().rows.length
                
                const from = pageIndex * pageSize + 1
                const to = Math.min((pageIndex + 1) * pageSize, total)
                
                return `Showing ${from} to ${to} of ${total} entries`
              })()}
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

// Helper function to create sortable column headers with multi-sort indicators
export function createSortableHeader(title: string) {
  return ({ column, table }: { column: any; table: any }) => {
    const isSorted = column.getIsSorted()
    const sortingState = table.getState().sorting
    const sortIndex = sortingState.findIndex((s: any) => s.id === column.id)
    const isMultiSorted = sortingState.length > 1 && sortIndex !== -1

    return (
      <Button
        variant="ghost"
        onClick={(event) => {
          // Manually control sorting state to ensure desc-first behavior
          const columnId = column.id
          const existingSort = sortingState.find((s: any) => s.id === columnId)
          const isMulti = event.shiftKey

          let newSorting: any[]

          if (!existingSort) {
            // Not currently sorted -> sort descending (first click)
            if (isMulti) {
              newSorting = [...sortingState, { id: columnId, desc: true }]
            } else {
              newSorting = [{ id: columnId, desc: true }]
            }
          } else if (existingSort.desc) {
            // Currently desc -> sort ascending (second click)
            if (isMulti) {
              newSorting = sortingState.map((s: any) =>
                s.id === columnId ? { ...s, desc: false } : s
              )
            } else {
              newSorting = [{ id: columnId, desc: false }]
            }
          } else {
            // Currently asc -> clear sort (third click)
            if (isMulti) {
              newSorting = sortingState.filter((s: any) => s.id !== columnId)
            } else {
              newSorting = []
            }
          }

          table.setSorting(newSorting)
        }}
        className={`h-auto p-0 hover:bg-transparent group ${isSorted ? 'font-bold' : ''}`}
        title={isMultiSorted ? `Sort order: ${sortIndex + 1}. Shift+Click to modify multi-sort` : 'Click to sort, Shift+Click for multi-sort'}
      >
        {title}
        {isSorted && (
          <span className="inline-flex items-center ml-1">
            {isMultiSorted && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-primary/20 text-primary rounded-full mr-0.5">
                {sortIndex + 1}
              </span>
            )}
            {isSorted === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          </span>
        )}
        {!isSorted && <ArrowUpDown className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-50" />}
      </Button>
    )
  }
}