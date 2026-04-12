import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlannerGrid from '../components/MealPlanner/PlannerGrid'
import { startOfWeek, format, addDays } from 'date-fns'

describe('PlannerGrid', () => {
  it('renders 7 columns starting with Sunday', () => {
    const testDate = new Date(2024, 3, 14) // Sunday, Apr 14 2024
    const expectedSunday = startOfWeek(testDate, { weekStartsOn: 0 })
    
    render(<PlannerGrid weekStartDate={expectedSunday} />)
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    days.forEach(day => {
      expect(screen.getByText(new RegExp(day, 'i'))).toBeInTheDocument()
    })
    
    // Check if the first day displayed is Sunday's date
    const formattedSunday = format(expectedSunday, 'MMM d')
    expect(screen.getByText(formattedSunday)).toBeInTheDocument()
  })

  it('calls onLockToggle with correct date string format (yyyy-MM-dd)', () => {
    const weekStart = new Date(2024, 3, 14) // Sunday, Apr 14 2024
    const onLockToggle = vi.fn()
    
    render(
      <PlannerGrid 
        weekStartDate={weekStart} 
        onLockToggle={onLockToggle}
        planData={{
          '2024-04-14': { dinner: { id: '1', recipeName: 'Pasta', isLocked: false } }
        }}
      />
    )
    
    // Find the lock button in the first day (Sunday)
    // We need to look into MealSlot to see how to trigger lock toggle
    const lockButtons = screen.getAllByRole('button', { name: /lock/i })
    fireEvent.click(lockButtons[0]) // First slot in Sunday is breakfast, then lunch, then dinner
    
    // Breakfast is index 0
    expect(onLockToggle).toHaveBeenCalledWith('2024-04-14', 'breakfast', true)
  })
})
