import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MealPlanner from '../pages/MealPlanner/MealPlanner'
import { plannerService } from '../lib/services/planner'
import { householdService } from '../lib/services/household'

// Mock services
vi.mock('../lib/services/planner', () => ({
  plannerService: {
    getMealPlan: vi.fn(),
    updateSlot: vi.fn(),
    saveMealPlan: vi.fn(),
    clearSlot: vi.fn(),
    refreshSlot: vi.fn(),
  }
}))

vi.mock('../lib/services/household', () => ({
  householdService: {
    getMyHouseholdId: vi.fn(),
    getMembers: vi.fn(),
  },
  DEFAULT_NUTRITION_PROFILE: {
    target_calories: 2000,
    macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
    dietary_choice: 'Standard',
    is_child: false
  }
}))

const mockMember = { 
  id: 'm1', 
  name: 'Alice', 
  household_id: 'h123',
  nutrition_profile: {
    target_calories: 2000,
    macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
    dietary_choice: 'omnivore',
    allergies: [],
    avoidances: [],
    appliances: ['oven'],
    cooking_skill: 'intermediate',
    is_child: false
  },
  is_owner: true,
  is_active: true,
  created_at: new Date().toISOString()
};

describe('Surgical Slot Control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(householdService.getMembers).mockResolvedValue([mockMember])
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('clears a slot when delete button is clicked', async () => {
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ 
      id: 'p1',
      slots: [{
        id: 's1',
        meal_plan_id: 'p1',
        day_of_week: 0,
        meal_type: 'dinner',
        recipe_id: 'r1',
        recipe: { name: 'Old Meal' },
        is_locked: false
      }]
    })

    render(<MealPlanner />)

    await waitFor(() => {
      expect(screen.getByText('Old Meal')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTitle('Clear meal')
    fireEvent.click(deleteButton)

    // Check optimism: UI cleared
    await waitFor(() => {
      expect(screen.queryByText('Old Meal')).not.toBeInTheDocument()
    })

    expect(plannerService.clearSlot).toHaveBeenCalledWith('s1')
  })

  it('refreshes a slot when refresh button is clicked', async () => {
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ 
      id: 'p1',
      slots: [{
        id: 's1',
        meal_plan_id: 'p1',
        day_of_week: 0,
        meal_type: 'dinner',
        recipe_id: 'r1',
        recipe: { name: 'Old Meal' },
        is_locked: false
      }]
    })

    vi.mocked(plannerService.refreshSlot).mockResolvedValue({ 
      id: 'r2',
      name: 'New Meal'
    })

    render(<MealPlanner />)

    await waitFor(() => {
      expect(screen.getByText('Old Meal')).toBeInTheDocument()
    })

    const refreshButton = screen.getByTitle('Refresh meal')
    fireEvent.click(refreshButton)

    // Check loading state optimism
    expect(screen.getByText('Refreshing...')).toBeInTheDocument()

    // Check final update
    await waitFor(() => {
      expect(screen.getByText('New Meal')).toBeInTheDocument()
    })

    expect(plannerService.refreshSlot).toHaveBeenCalled()
  })
})
