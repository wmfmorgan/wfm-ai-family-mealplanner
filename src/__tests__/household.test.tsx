import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Household from '../pages/Household/Household';
import { householdService } from '../lib/services/household';

// Mock the service
vi.mock('../lib/services/household', async () => {
  const actual = await vi.importActual('../lib/services/household');
  return {
    ...actual,
    householdService: {
      getMyHouseholdId: vi.fn(),
      getMembers: vi.fn(),
      deleteMember: vi.fn(),
      updateMember: vi.fn(),
      addMember: vi.fn(),
    }
  };
});

const mockMembers = [
  {
    id: '1',
    name: 'Owner',
    is_owner: true,
    nutrition_profile: {
      target_calories: 2000,
      macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
      allergies: [],
      avoidances: [],
      appliances: [],
      cooking_skill: 'beginner',
      is_child: false
    }
  },
  {
    id: '2',
    name: 'Member',
    is_owner: false,
    nutrition_profile: {
      target_calories: 2000,
      macro_targets: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
      allergies: [],
      avoidances: ['cilantro'],
      appliances: [],
      cooking_skill: 'beginner',
      is_child: false
    }
  }
];

describe('Household Page Refinements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (householdService.getMyHouseholdId as any).mockResolvedValue('h1');
    (householdService.getMembers as any).mockResolvedValue(mockMembers);
  });

  it('renders members and displays avoidances', async () => {
    render(<Household />);
    await waitFor(() => expect(screen.getByText('Owner')).toBeDefined());
    expect(screen.getByText('Member')).toBeDefined();
    expect(screen.getByText('cilantro')).toBeDefined();
  });

  it('shows delete button only for non-owners', async () => {
    render(<Household />);
    await waitFor(() => expect(screen.getByText('Owner')).toBeDefined());
    
    const ownerCard = screen.getByText('Owner').closest('.member-card');
    const memberCard = screen.getByText('Member').closest('.member-card');
    
    expect(ownerCard?.querySelector('.delete-button')).toBeNull();
    expect(memberCard?.querySelector('.delete-button')).not.toBeNull();
  });

  it('handles deletion with confirmation', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    render(<Household />);
    await waitFor(() => expect(screen.getByText('Member')).toBeDefined());
    
    const deleteBtn = screen.getByTitle('Remove Member');
    fireEvent.click(deleteBtn);
    
    expect(window.confirm).toHaveBeenCalled();
  });

  it('validates macros in ProfileForm (Manual Mode)', async () => {
    render(<Household />);
    await waitFor(() => expect(screen.getByText('Member')).toBeDefined());
    
    // Click edit on member
    const editBtns = screen.getAllByTitle('Edit Profile');
    fireEvent.click(editBtns[1]); // Member's edit button
    
    // Toggle manual mode
    const manualToggle = screen.getByLabelText('Manual Mode');
    fireEvent.click(manualToggle);
    
    // Change protein to 40% (total = 110%)
    const proteinInput = screen.getByLabelText('Protein (%)');
    fireEvent.change(proteinInput, { target: { value: '40' } });
    
    expect(screen.getByText(/Total macros must equal 100%/)).toBeDefined();
    const saveBtn = screen.getByText('Save Changes');
    expect(saveBtn).toBeDisabled();
    
    // Change back to 30% (total = 100%)
    fireEvent.change(proteinInput, { target: { value: '30' } });
    expect(saveBtn).not.toBeDisabled();
  });

  it('fixes Chef Notes multi-word typing', async () => {
    render(<Household />);
    await waitFor(() => expect(screen.getByText('Member')).toBeDefined());
    
    const editBtns = screen.getAllByTitle('Edit Profile');
    fireEvent.click(editBtns[1]);
    
    const notesInput = screen.getByPlaceholderText(/e.g. No mushrooms/);
    fireEvent.change(notesInput, { target: { value: 'No ' } });
    expect(notesInput).toHaveValue('No ');
    
    fireEvent.change(notesInput, { target: { value: 'No cilantro' } });
    expect(notesInput).toHaveValue('No cilantro');
  });
});
