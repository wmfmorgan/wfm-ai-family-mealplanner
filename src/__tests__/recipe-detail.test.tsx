import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeDetail from '../components/MealPlanner/RecipeDetail';
import { Recipe } from '../lib/services/planner';

const mockRecipe: Recipe = {
  household_id: 'h1',
  name: 'Earthly Pasta',
  ingredients: ['Pasta', 'Spinach', 'Pine nuts'],
  instructions: ['Boil pasta', 'Sauté spinach', 'Mix everything'],
  nutrition: { calories: 450, protein: '15g' },
  prep_time_min: 10,
  cook_time_min: 15,
  servings: 4
};

describe('RecipeDetail Component', () => {
  it('does not render when recipe is null', () => {
    const { container } = render(<RecipeDetail recipe={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders recipe details correctly', () => {
    render(<RecipeDetail recipe={mockRecipe} onClose={() => {}} />);
    
    expect(screen.getByText('Earthly Pasta')).toBeInTheDocument();
    expect(screen.getByText('Prep: 10m')).toBeInTheDocument();
    expect(screen.getByText('Cook: 15m')).toBeInTheDocument();
    expect(screen.getByText('Servings: 4')).toBeInTheDocument();
    
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(screen.getByText('Sauté spinach')).toBeInTheDocument();
    
    expect(screen.getByText('calories')).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<RecipeDetail recipe={mockRecipe} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<RecipeDetail recipe={mockRecipe} onClose={onClose} />);
    
    const overlay = screen.getByText('Earthly Pasta').closest('.recipe-detail-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when drawer itself is clicked', () => {
    const onClose = vi.fn();
    render(<RecipeDetail recipe={mockRecipe} onClose={onClose} />);
    
    const drawer = screen.getByText('Earthly Pasta').closest('.recipe-detail-drawer');
    if (drawer) fireEvent.click(drawer);
    expect(onClose).not.toHaveBeenCalled();
  });
});
