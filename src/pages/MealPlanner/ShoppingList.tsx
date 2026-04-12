import React, { useState, useEffect } from 'react';
import { Printer, Check, Plus } from 'lucide-react';
import { plannerService } from '../../lib/services/planner';
import { householdService } from '../../lib/services/household';
import { useAuth } from '../../contexts/AuthContext';
import './ShoppingList.css';

interface ShoppingListItem {
  id: string;
  meal_plan_id: string;
  original_string: string;
  category: string;
  quantity?: string;
}

const CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Pantry & Grains',
  'Canned & Jarred',
  'Bakery',
  'Frozen Foods',
  'Condiments & Spices',
  'Snacks & Sweets',
  'Beverages',
  'Deli',
  'Household'
];

const ShoppingList: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mealPlanId, setMealPlanId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!user) return;
      try {
        const hId = await householdService.getMyHouseholdId();
        setHouseholdId(hId);
      } catch (err) {
        console.error('Error fetching household ID:', err);
      }
    }
    init();
  }, [user]);

  useEffect(() => {
    async function fetchItems() {
      if (!householdId) return;

      try {
        setLoading(true);
        // Get current week's meal plan
        const today = new Date();
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const weekStart = firstDayOfWeek.toISOString().split('T')[0];

        const plan = await plannerService.getMealPlan(householdId, weekStart);
        
        if (plan) {
          setMealPlanId(plan.id);
          const shoppingItems = await plannerService.getShoppingListItems(plan.id);
          setItems(shoppingItems);

          // Load checked items from localStorage
          const savedChecked = localStorage.getItem(`checked_items_${plan.id}`);
          if (savedChecked) {
            setCheckedItems(JSON.parse(savedChecked));
          }
        }
      } catch (err: any) {
        console.error('Error fetching shopping list:', err);
        setError('Failed to load provisions. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [householdId]);

  const toggleItem = (id: string) => {
    const newChecked = { ...checkedItems, [id]: !checkedItems[id] };
    setCheckedItems(newChecked);
    
    if (mealPlanId) {
      localStorage.setItem(`checked_items_${mealPlanId}`, JSON.stringify(newChecked));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const groupedItems = CATEGORIES.reduce((acc, category) => {
    const categoryItems = items.filter(item => item.category === category);
    if (categoryItems.length > 0) {
      acc[category] = categoryItems;
    }
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  // Catch any items that don't match our categories
  const otherItems = items.filter(item => !CATEGORIES.includes(item.category));
  if (otherItems.length > 0) {
    groupedItems['Other'] = otherItems;
  }

  if (loading) {
    return (
      <div className="shopping-list-container">
        <div className="shopping-list-header">
          <h1>The Market Ledger</h1>
          <p className="shopping-list-subtitle">Gathering your provisions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shopping-list-container">
        <div className="shopping-list-header">
          <h1>The Market Ledger</h1>
          <p className="shopping-list-subtitle" style={{ color: 'var(--error)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-list-container">
      <div className="print-actions">
        <button onClick={handlePrint} className="btn-print">
          <Printer size={16} />
          Print Ledger
        </button>
      </div>

      <div className="shopping-list-header">
        <h1>The Market Ledger</h1>
        <p className="shopping-list-subtitle">Weekly Provisions</p>
      </div>

      <div className="shopping-list-layout">
        <aside className="shopping-list-sidebar">
          <div className="shopping-list-notes-card">
            <div className="aspect-[3/4] bg-surface-container overflow-hidden rounded-lg mb-8">
              <img 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCC2JmBxbJS8iqvs7krJ-9KMd785BDNjkhalI4xRUf2MrXL9nKkl-PcYMhYvt5ib5CYX0PznpQUdGU794YpkMif1IkHKa1HsvuOeRBHh0Tm-mq7NJ9-OyEoxw7DoJqO2PXMSol-zLlpcRUl9kPMfKZ6sqdOEN70Elx6LKtpOu6byOfEF7FzobB-6bnKaSBYLEFyThyWGg0-y5A1Yc0NwXMcEargvxD1z9MWjQtWX6YotCYTWiZfRiqnM2TD9TDSagN4JR8fVbKjR3rO" 
                alt="Fresh organic produce"
              />
            </div>
            <h3>Kitchen Notes</h3>
            <p>
              This week's menu focuses on fresh ingredients. Remember to check your pantry for staples before heading to the market.
            </p>
            <div className="mt-6 pt-6 border-t border-outline-variant/20">
              <p className="font-label text-[10px] uppercase tracking-widest text-outline">
                Updated: {new Date().toLocaleDateString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </aside>

        <main className="shopping-list-grid">
          {items.length === 0 ? (
            <div className="empty-state">
              <p className="font-headline italic text-lg text-secondary opacity-80">
                Your ledger is empty. Generate a meal plan to see your provisions.
              </p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, categoryItems]) => (
              <section key={category} className="shopping-category">
                <h2 className="category-title">{category}</h2>
                <div className="items-stack">
                  {categoryItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`shopping-item ${checkedItems[item.id] ? 'checked' : ''}`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <div className="item-left">
                        <div className="custom-checkbox">
                          {checkedItems[item.id] && <Check size={14} className="checkbox-icon" />}
                        </div>
                        <span className="item-text">{item.original_string}</span>
                      </div>
                      {item.quantity && <span className="item-quantity">{item.quantity}</span>}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}

          <div className="mt-16 pt-8 border-t border-outline-variant/10">
            <button className="flex items-center gap-3 text-primary font-body text-sm group" disabled>
              <Plus size={16} className="transition-transform group-hover:rotate-90" />
              <span className="underline underline-offset-4 decoration-primary/30 group-hover:decoration-primary">Append a new provision to the ledger</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ShoppingList;
