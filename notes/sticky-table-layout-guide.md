# Sticky Table Header & Fixed Layout Structure Guide

This document explains the CSS styling approach used in the Datacuan shop detail page to create a professional-looking fixed layout with sticky table headers.

## Table of Contents
- [Overview](#overview)
- [Page Layout Structure](#page-layout-structure)
- [Sticky Header Implementation](#sticky-header-implementation)
- [Fixed Height Containers](#fixed-height-containers)
- [Responsive Design Patterns](#responsive-design-patterns)
- [Key CSS Techniques](#key-css-techniques)

## Overview

The shop detail page uses a combination of CSS Flexbox, fixed heights, and sticky positioning to create a professional data analysis interface where:
- The page header stays fixed at the top
- The table header remains visible when scrolling through products
- Left and right columns are sticky for better data comparison
- The layout adapts seamlessly between desktop and mobile

## Page Layout Structure

### Main Container Hierarchy

```
Page Component
└── HeaderContent (Fixed at top)
└── Main Container (flex flex-col)
    └── Content Wrapper (flex flex-row with fixed viewport height)
        ├── Left Column (Summary & Chart - Fixed width, scrollable)
        └── Right Column (Products Table - Flexible width, scrollable)
```

### Key Layout Code (page.tsx:378-439)

```tsx
<div className="flex flex-row gap-0 h-auto lg:h-[calc(100vh-74px)]">
    {/* Left Column - Statistics & Chart */}
    <div className="lg:w-[350px] xl:w-[450px] lg:min-w-[350px] lg:border-r
                    lg:pr-4 lg:overflow-y-clip lg:h-[calc(100vh-72px)]">
        <div className="space-y-4">
            {/* Summary Cards */}
            {/* Chart Component */}
        </div>
    </div>

    {/* Right Column - Products Table */}
    <div className="flex-1 lg:h-[calc(100vh-72px)] overflow-hidden">
        <ItemsList {...props} />
    </div>
</div>
```

**Key Points:**
- `h-[calc(100vh-74px)]` - Calculates exact height minus header (74px)
- `flex-1` - Right column takes remaining space
- `overflow-hidden` - Prevents double scrollbars
- `lg:` prefix - Desktop-specific styles

## Sticky Header Implementation

### Table Header Sticky Positioning

The sticky header is implemented in the DataTable component using CSS position sticky:

**Code Reference (data-table.tsx:318)**

```tsx
<TableHeader className="bg-gray-100 sticky top-0 z-10 uppercase">
    {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
                <TableHead
                    className={cn(
                        "bg-gray-100 text-xs",
                        header.column.getIsPinned() ? 'bg-gray-100' : ''
                    )}
                    style={getCommonPinningStyles(header.column)}
                >
                    {/* Header content */}
                </TableHead>
            ))}
        </TableRow>
    ))}
</TableHeader>
```

**Essential CSS Classes:**
- `sticky` - Position sticky
- `top-0` - Stick to top of scrolling container
- `z-10` - Stack above table body
- `bg-gray-100` - Background color (prevents content showing through)

### Sticky Columns (Left & Right)

Sticky columns use a combination of CSS and dynamic JavaScript:

**Code Reference (data-table.tsx:136-158)**

```typescript
const getCommonPinningStyles = (column: Column<any>): CSSProperties => {
    const isPinned = column.getIsPinned()
    const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left')
    const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right')

    const leftShadow = `-2px 0 3px -2px rgba(0,0,0,${0.3 * shadowOpacity.left}) inset`;
    const rightShadow = `2px 0 3px -2px rgba(0,0,0,${0.3 * shadowOpacity.right}) inset`;

    return {
        boxShadow: isLastLeftPinnedColumn ? leftShadow
                  : isFirstRightPinnedColumn ? rightShadow
                  : 'none',
        transition: 'box-shadow 0.1s linear',
        left: isPinned === 'left' ? column.getStart('left') : undefined,
        right: isPinned === 'right' ? column.getStart('right') : undefined,
        position: isPinned ? 'sticky' : 'relative',
        width: column.getSize(),
        zIndex: isPinned ? 1 : 0,
    }
}
```

**Key Features:**
- **Dynamic shadows** - Fade in/out based on scroll position
- **Precise positioning** - Uses `left`/`right` with calculated pixel values
- **Z-index management** - Ensures proper stacking
- **Smooth transitions** - 0.1s linear for shadow changes

### Shadow Fade Effect

Shadows fade based on scroll position:

**Code Reference (data-table.tsx:94-121)**

```typescript
useEffect(() => {
    const handleScroll = () => {
        const scrollLeft = el.scrollLeft;
        const maxScroll = el.scrollWidth - el.clientWidth;
        const threshold = 10; // 10px threshold for fade effect

        const leftOpacity = Math.min(scrollLeft / threshold, 1);
        const rightOpacity = Math.min((maxScroll - scrollLeft) / threshold, 1);

        setShadowOpacity({ left: leftOpacity, right: rightOpacity });
    };

    el.addEventListener('scroll', handleScroll);
}, []);
```

**How it works:**
1. Monitors horizontal scroll
2. Calculates opacity (0-1) based on distance scrolled
3. Updates shadow opacity in real-time
4. Creates professional "peek" effect

## Fixed Height Containers

### Products List Container

**Code Reference (ItemsList.tsx:257)**

```tsx
<div className="grid grid-rows-[auto_auto_1fr] h-full md:h-auto md:flex md:flex-col md:h-full">
    {/* Header (auto height) */}
    <div className="flex items-center justify-between py-2 bg-background z-30">
        {/* Search, filters, actions */}
    </div>

    {/* Mobile search (auto height) */}
    {isMobile && (
        <div className="w-full mb-2">
            {/* Search input */}
        </div>
    )}

    {/* Scrollable content (fills remaining space) */}
    <div className="overflow-y-auto flex-1 min-h-0 md:flex md:flex-col md:flex-grow">
        {/* Table or cards */}
    </div>
</div>
```

**Grid Layout Strategy:**
- `grid-rows-[auto_auto_1fr]` - Header (auto), Search (auto), Content (remaining)
- `h-full` - Takes full height of parent
- `min-h-0` - Critical for flex children to scroll properly
- `overflow-y-auto` - Enables vertical scrolling

### Table Wrapper Structure

**Code Reference (data-table.tsx:360-380)**

```tsx
<div className="relative flex flex-col h-full">
    {/* Optional header */}

    {/* Table container with border */}
    <div className="rounded-md border flex-1 flex flex-col justify-between min-h-0 relative">
        {/* Scrollable table wrapper */}
        <div ref={tableWrapperRef}
             className="min-h-0 flex-1 overflow-auto relative rounded-md">
            <Table style={{ width: table.getTotalSize() }}>
                {tableHeader}
                {tableBody}
            </Table>
        </div>
    </div>

    {/* Pagination footer */}
    {enablePagination && (
        <div className="flex justify-between items-center py-2 px-2 h-12">
            {/* Pagination controls */}
        </div>
    )}
</div>
```

**Critical Classes:**
- `h-full` - Outer container fills available space
- `flex-1` - Middle container expands
- `min-h-0` - **CRUCIAL** - Allows flex items to shrink below content size
- `overflow-auto` - Scroll when content exceeds container

## Responsive Design Patterns

### Breakpoint Strategy

The layout uses Tailwind's responsive prefixes:

| Breakpoint | Width | Usage |
|------------|-------|-------|
| (default) | < 640px | Mobile - stacked layout |
| `sm:` | ≥ 640px | Small tablets |
| `md:` | ≥ 768px | Tablets - keep mobile structure |
| `lg:` | ≥ 1024px | Desktop - side-by-side layout |
| `xl:` | ≥ 1280px | Large desktop - wider columns |

### Mobile vs Desktop Layout

**Mobile (< 1024px):**
```tsx
<div className="h-auto">  {/* Auto height - natural flow */}
    <div className="overflow-visible">  {/* No fixed viewport */}
        {/* Summary cards stack vertically */}
        {/* Chart full width */}
        {/* Table full width below */}
    </div>
</div>
```

**Desktop (≥ 1024px):**
```tsx
<div className="lg:h-[calc(100vh-74px)]">  {/* Fixed viewport height */}
    <div className="lg:flex-row">
        <div className="lg:w-[350px] lg:overflow-y-clip">  {/* Fixed width */}
            {/* Sidebar content */}
        </div>
        <div className="flex-1 lg:overflow-hidden">  {/* Flexible width */}
            {/* Main content */}
        </div>
    </div>
</div>
```

### View Mode Switching

**Code Reference (ItemsList.tsx:463-516)**

```tsx
<div className="overflow-y-auto flex-1 min-h-0">
    {viewMode === 'thumbnail' ? (
        <div className="flex flex-col sm:grid sm:grid-cols-3 md:flex md:flex-wrap lg:grid lg:grid-cols-3 gap-2">
            {/* Product cards */}
        </div>
    ) : (
        <div className="h-full flex flex-col overflow-hidden md:flex-grow">
            <ProductsTable {...props} />
        </div>
    )}
</div>
```

## Key CSS Techniques

### 1. Viewport Height Calculation

**Problem:** Need full viewport height minus header
**Solution:** CSS calc()

```css
/* 100vh - header height (74px) */
height: calc(100vh - 74px);
```

**Tailwind equivalent:**
```tsx
className="h-[calc(100vh-74px)]"
```

### 2. Flexbox Scroll Container Pattern

**Problem:** Flex children don't scroll properly
**Solution:** Use `min-h-0` or `min-w-0`

```css
.parent {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.scrollable-child {
    flex: 1;
    min-height: 0;  /* Critical! */
    overflow: auto;
}
```

**Why it works:** By default, flex items won't shrink below their content size. `min-height: 0` allows them to be smaller than their content, enabling overflow scrolling.

### 3. Sticky Positioning Requirements

For `position: sticky` to work:

```css
.sticky-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: #f3f4f6;  /* Must have background */
}

/* Parent container must have: */
.scroll-container {
    overflow: auto;  /* Or overflow-y: auto */
    height: /* some fixed value */;
}
```

**Checklist:**
- ✅ Parent has overflow (auto/scroll)
- ✅ Parent has defined height
- ✅ Sticky element has background color
- ✅ Sticky element has z-index
- ✅ No ancestor has `overflow: hidden` (will break sticky)

### 4. Z-Index Stacking

**Layer hierarchy:**
```
z-50   - Tooltips/Modals
z-30   - Search bar / Top UI elements
z-10   - Sticky table header
z-1    - Sticky columns
z-0    - Regular table cells
```

**Code Reference (data-table.tsx:156)**
```typescript
zIndex: isPinned ? 1 : 0
```

### 5. Background Color on Sticky Elements

**Why needed:** Without background, content scrolls through sticky elements

```tsx
<TableHeader className="bg-gray-100 sticky top-0">
    <TableHead className="bg-gray-100">
        {/* Content */}
    </TableHead>
</TableHeader>
```

**Both need background:**
- Sticky container (TableHeader)
- Individual cells (TableHead)

### 6. Preventing Double Scrollbars

**Problem:** Nested scrollable containers create multiple scrollbars
**Solution:** Careful overflow management

```tsx
{/* Parent: hide overflow */}
<div className="overflow-hidden h-[calc(100vh-72px)]">
    {/* Child: allow scrolling */}
    <div className="overflow-y-auto h-full">
        {/* Content */}
    </div>
</div>
```

### 7. Dynamic Column Width with Full Width

**Code Reference (data-table.tsx:193-223)**

The table calculates column widths to fill container:

```typescript
// Calculate total width of all columns except last non-sticky
let totalWidth = 0;
columnsCopy.forEach((col, index) => {
    if (index !== lastNonStickyColumnIndex) {
        totalWidth += (col.size || defaultColumnSize);
    }
});

// Remaining width for last column
const remainingWidth = Math.max(containerWidth - totalWidth, defaultColumnSize);

// Set size for the last non-sticky column
columnsCopy[lastNonStickyColumnIndex] = {
    ...columnsCopy[lastNonStickyColumnIndex],
    size: remainingWidth,
};
```

**Benefits:**
- No horizontal scrollbar when not needed
- Professional full-width appearance
- Responsive to window resize

## Summary

### Critical CSS Classes for Sticky Table

```tsx
{/* Outer container */}
<div className="h-[calc(100vh-74px)] overflow-hidden">
    {/* Scrollable wrapper */}
    <div className="h-full overflow-auto">
        {/* Table */}
        <table>
            {/* Sticky header */}
            <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                    {/* Sticky column */}
                    <th className="sticky left-0 z-1 bg-gray-100">
                        {/* Content */}
                    </th>
                </tr>
            </thead>
            <tbody>
                {/* Body content */}
            </tbody>
        </table>
    </div>
</div>
```

### Common Pitfalls & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Sticky header not sticking | Parent lacks overflow | Add `overflow-auto` to scrollable parent |
| Flex child won't scroll | Default min-height | Add `min-h-0` to flex child |
| Content shows through sticky | No background | Add `bg-{color}` to sticky element |
| Sticky column behind header | Wrong z-index | Header: `z-10`, Columns: `z-1` |
| Double scrollbars | Multiple overflow containers | Use `overflow-hidden` on outer container |
| Layout breaks on mobile | Fixed heights | Use `lg:h-[...]` for desktop only |

### Best Practices

1. **Use calc() for precision**
   ```tsx
   h-[calc(100vh-{headerHeight}px)]
   ```

2. **Always set background on sticky elements**
   ```tsx
   className="sticky top-0 bg-white"
   ```

3. **Use min-h-0 for flex scrolling**
   ```tsx
   className="flex-1 min-h-0 overflow-auto"
   ```

4. **Responsive height management**
   ```tsx
   {/* Mobile: auto height */}
   {/* Desktop: fixed viewport height */}
   className="h-auto lg:h-[calc(100vh-74px)]"
   ```

5. **Test scroll behavior**
   - Vertical scroll in table
   - Horizontal scroll with sticky columns
   - Sticky header stays visible
   - Shadows appear/disappear correctly

---

## Reference Files

- **Main Page:** [src/app/(app)/app/shops/[storeId]/page.tsx](src/app/(app)/app/shops/[storeId]/page.tsx)
- **Data Table:** [src/components/ui/data-table.tsx](src/components/ui/data-table.tsx)
- **Items List:** [src/components/shop-detail/ItemsList.tsx](src/components/shop-detail/ItemsList.tsx)
- **Products Table:** [src/components/shop-detail/ProductsTable.tsx](src/components/shop-detail/ProductsTable.tsx)
