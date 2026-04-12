import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlannerGrid from '../components/MealPlanner/PlannerGrid'
import { startOfWeek, format } from 'date-fns'

describe('PlannerGrid', () => {
  it('renders 7 columns starting with Sunday', () => {
    const testDate = new Date(2024, 3, 15) // A Monday
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
})
