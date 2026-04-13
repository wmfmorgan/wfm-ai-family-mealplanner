import React from 'react';
import MemberCard from './MemberCard';
import { HouseholdMember } from '../../lib/services/household';
import './MemberGrid.css';

export interface MemberGridProps {
  members: HouseholdMember[];
  onEditMember: (member: HouseholdMember) => void;
  onDeleteMember: (member: HouseholdMember) => void;
  onAddMember: () => void;
}

const MemberGrid: React.FC<MemberGridProps> = ({ members, onEditMember, onDeleteMember, onAddMember }) => {
  return (
    <div className="member-grid-container">
      <div className="member-grid">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            name={member.name}
            isOwner={member.is_owner}
            dietaryNeeds={[
              ...(member.nutrition_profile.dietary_choice !== 'Standard' ? [member.nutrition_profile.dietary_choice] : []),
              ...member.nutrition_profile.allergies,
              ...(member.nutrition_profile.is_child ? ['Child'] : [])
            ]}
            avoidances={member.nutrition_profile.avoidances}
            calorieTarget={member.nutrition_profile.target_calories}
            macros={{
              protein: `${member.nutrition_profile.macro_targets.protein_pct}%`,
              carbs: `${member.nutrition_profile.macro_targets.carbs_pct}%`,
              fat: `${member.nutrition_profile.macro_targets.fat_pct}%`,
            }}
            onEdit={() => onEditMember(member)}
            onDelete={() => onDeleteMember(member)}
          />
        ))}
        <button className="add-member-card" onClick={onAddMember}>
          <span className="material-symbols-outlined plus-icon">add</span>
          <span className="add-text">Add Member</span>
        </button>
      </div>
    </div>
  );
};

export default MemberGrid;
