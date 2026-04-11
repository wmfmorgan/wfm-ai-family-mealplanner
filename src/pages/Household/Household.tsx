import React, { useState, useEffect } from 'react';
import { householdService, HouseholdMember, NutritionProfile, DEFAULT_NUTRITION_PROFILE } from '../../lib/services/household';
import MemberGrid from '../../components/Household/MemberGrid';
import ProfileForm from '../../components/Household/ProfileForm';
import './Household.css';

const Household: React.FC = () => {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const id = await householdService.getMyHouseholdId();
        if (id) {
          setHouseholdId(id);
          const data = await householdService.getMembers(id);
          setMembers(data);
        }
      } catch (err) {
        console.error('Error initializing household page:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleEditMember = (member: HouseholdMember) => {
    setEditingMember(member);
    setIsAdding(false);
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setEditingMember(null);
  };

  const handleSaveMember = async (name: string, profile: NutritionProfile) => {
    if (!householdId) return;

    try {
      if (editingMember) {
        await householdService.updateMember(editingMember.id, { 
          name, 
          nutrition_profile: profile 
        });
      } else if (isAdding) {
        await householdService.addMember(householdId, name, profile);
      }
      
      // Refresh list
      const data = await householdService.getMembers(householdId);
      setMembers(data);
      setEditingMember(null);
      setIsAdding(false);
    } catch (err) {
      console.error('Error saving member:', err);
      alert('Failed to save changes. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="household-page loading">
        <p>Gathering your cookbook notes...</p>
      </div>
    );
  }

  return (
    <div className="household-page">
      <header className="page-header">
        <h1 className="page-title">Household</h1>
        <p className="page-description">
          Manage your family's culinary profiles and dietary requirements.
        </p>
      </header>

      {editingMember || isAdding ? (
        <ProfileForm 
          initialData={
            editingMember 
              ? { name: editingMember.name, nutrition_profile: editingMember.nutrition_profile }
              : { name: '', nutrition_profile: DEFAULT_NUTRITION_PROFILE }
          }
          onSave={handleSaveMember}
          onCancel={() => { setEditingMember(null); setIsAdding(false); }}
        />
      ) : (
        <section className="members-section">
          <MemberGrid 
            members={members}
            onEditMember={handleEditMember}
            onAddMember={handleAddClick}
          />
        </section>
      )}
    </div>
  );
};

export default Household;
