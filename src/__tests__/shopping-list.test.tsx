import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ShoppingList from '../pages/MealPlanner/ShoppingList'
import { plannerService } from '../lib/services/planner'
import { householdService } from '../lib/services/household'
import { useAuth } from '../contexts/AuthContext'

// Mock services
vi.mock('../lib/services/planner', () => ({
  plannerService: {
    getMealPlan: vi.fn(),
    getShoppingListItems: vi.fn(),
  }
}))

vi.mock('../lib/services/household', () => ({
  householdService: {
    getMyHouseholdId: vi.fn(),
  }
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('ShoppingList - UI', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u123' },
      session: null,
      loading: false,
      signOut: vi.fn(),
    } as any)
  })
  it('renders empty state when no items are present', async () => {
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ id: 'p123', household_id: 'h123' })
    vi.mocked(plannerService.getShoppingListItems).mockResolvedValue([])

    render(<ShoppingList />)

    await waitFor(() => {
      expect(screen.queryByText(/Gathering your provisions/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText(/Your ledger is empty/i)).toBeInTheDocument()
  })

  it('renders categorized items correctly', async () => {
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ id: 'p123', household_id: 'h123' })
    vi.mocked(plannerService.getShoppingListItems).mockResolvedValue([
      { id: '1', meal_plan_id: 'p123', original_string: 'Carrots', category: 'Produce' },
      { id: '2', meal_plan_id: 'p123', original_string: 'Salmon', category: 'Meat & Seafood' },
      { id: '3', meal_plan_id: 'p123', original_string: 'Milk', category: 'Dairy & Eggs' },
    ])

    render(<ShoppingList />)

    await waitFor(() => {
      expect(screen.queryByText(/Gathering your provisions/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText('Produce')).toBeInTheDocument()
    expect(screen.getByText('Carrots')).toBeInTheDocument()
    expect(screen.getByText('Meat & Seafood')).toBeInTheDocument()
    expect(screen.getByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('Dairy & Eggs')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
  })

  it('toggles item checked state and persists to localStorage', async () => {
    vi.mocked(householdService.getMyHouseholdId).mockResolvedValue('h123')
    vi.mocked(plannerService.getMealPlan).mockResolvedValue({ id: 'p123', household_id: 'h123' })
    vi.mocked(plannerService.getShoppingListItems).mockResolvedValue([
      { id: '1', meal_plan_id: 'p123', original_string: 'Carrots', category: 'Produce' }
    ])

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    render(<ShoppingList />)

    await waitFor(() => {
      expect(screen.queryByText(/Gathering your provisions/i)).not.toBeInTheDocument()
    })

    const item = screen.getByText('Carrots').closest('.shopping-item')
    fireEvent.click(item!)

    expect(item).toHaveClass('checked')
    expect(setItemSpy).toHaveBeenCalledWith('checked_items_p123', JSON.stringify({ '1': true }))
  })
})
