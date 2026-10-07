import DefaultPet from './DefaultPet/DefaultPet';
import type { CharacterName } from '../pet.types';
import type { ComponentType } from 'react';
import type { PetCharacterProps } from '../pet.types';

export const characters = {
  default: DefaultPet,
} satisfies Record<CharacterName, ComponentType<PetCharacterProps>>;
