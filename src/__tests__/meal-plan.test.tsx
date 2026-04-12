import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MealPlanner from '../pages/MealPlanner/MealPlanner'
import { plannerService } from '../lib/services/planner'
import { householdService, DEFAULT_NUTRITION_PROFILE } from '../lib/services/household'

const mockMember = { 
  id: 'm1', 
  name: 'Alice', 
  household_id: 'h123',
  nutrition_profile: DEFAULT_NUTRITION_PROFILE,
  is_owner: true,
  is_active: true,
  created_at: new Date().toISOString()
};

// Mock services
vi.mock('../lib/services/planner', () => ({
  plannerService: {
    getMealPlan: vi.fn(),
    updateSlot: vi.fn(),
    saveMealPlan: vi.fn(),
  }
}))

vi.mock('../lib/services/household', () => ({
  householdService: {
    getMyHouseholdId: vi.fn(),
    getMembers: vi.fn(),
  }
}))

describe('MealPlanner - Optimistic UI', () => {
  it('toggles lock visually even if slot has no ID', async () => {
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(householdService.getMembers).mockResolvedValue([mockMember])
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ 
      slots: [] // Empty plan, so slots won't have IDs initially
    })

    render(<MealPlanner />)

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument()
    })

    // Find a lock button (they should be present even for empty slots)
    const lockButtons = screen.getAllByRole('button', { name: /lock/i })
    
    // Initial state: not locked (🔓)
    expect(lockButtons[0].textContent).toBe('🔓')

    // Click to lock
    fireEvent.click(lockButtons[0])

    // Should update visually to 🔒 immediately (optimistic)
    expect(lockButtons[0].textContent).toBe('🔒')
    
    // Should NOT call service because there's no ID
    expect(plannerService.updateSlot).not.toHaveBeenCalled()
  })

  it('updates manual entry visually even if slot has no ID', async () => {
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(householdService.getMembers).mockResolvedValue([mockMember])
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ slots: [] })

    render(<MealPlanner />)

    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument()
    })

    // Click "Add meal..." to edit
    const addMealText = screen.getAllByText(/Add meal.../i)[0]
    fireEvent.click(addMealText)

    // Find input and type
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Pizza' } })
    fireEvent.blur(input)

    // Should update visually
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    
    // Should NOT call service
    expect(plannerService.updateSlot).not.toHaveBeenCalled()
  })

  it('opens recipe detail drawer when a recipe slot is clicked', async () => {
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(householdService.getMembers).mockResolvedValue([mockMember])
    
    const mockRecipe = {
      name: 'Signature Soup',
      ingredients: ['Water', 'Veggies'],
      instructions: ['Boil'],
      prep_time_min: 5,
      cook_time_min: 10,
      servings: 2
    }

    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ 
      slots: [{
        id: 's1',
        day_of_week: 0,
        meal_type: 'dinner',
        is_locked: true,
        recipe: mockRecipe
      }]
    })

    render(<MealPlanner />)

    await waitFor(() => {
      expect(screen.queryByText(/Opening your family cookbook/i)).not.toBeInTheDocument()
    })

    // Find the slot with recipe name (now it shouldn't be an input because it's locked)
    const recipeSlot = screen.getByText('Signature Soup')
    fireEvent.click(recipeSlot)

    // Drawer should open with full details
    expect(screen.getByText('Signature Soup', { selector: '.recipe-title' })).toBeInTheDocument()
    expect(screen.getByText('Prep: 5m')).toBeInTheDocument()
    expect(screen.getByText('Veggies')).toBeInTheDocument()
    expect(screen.getByText('Boil')).toBeInTheDocument()

    // Close the drawer
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)

    // Drawer should disappear
    await waitFor(() => {
      expect(screen.queryByText('Signature Soup', { selector: '.recipe-title' })).not.toBeInTheDocument()
    })
  })
})
