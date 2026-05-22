type TankAbbr = 'PLD' | 'WAR' | 'DRK' | 'GNB';
type HealerAbbr = 'WHM' | 'SCH' | 'AST' | 'SGE';
type MeleeDpsAbbr = 'DRG' | 'MNK' | 'NIN' | 'SAM' | 'RPR' | 'VPR';
type CasterDpsAbbr = 'BLM' | 'SMN' | 'RDM' | 'PCT';
type RangedDpsAbbr = 'BRD' | 'MCH' | 'DNC';
type DpsAbbr = MeleeDpsAbbr | CasterDpsAbbr | RangedDpsAbbr;

export type JobAbbreviation = TankAbbr | HealerAbbr | DpsAbbr;

export type JobRole = 'tank' | 'healer' | 'dps';

type TankSubRole = 'offtank' | 'maintank';
type HealerSubRole = 'regen' | 'shield';
type DpsSubRole = 'melee' | 'caster' | 'ranged';

export type JobSubRole = TankSubRole | HealerSubRole | DpsSubRole;

export type JobAbilityType = 'mitigation' | 'utility' | 'interrupt' | 'buff' | 'debuff';

export interface JobAbility {
    title: string,
    type: JobAbilityType,
    duration: number,
    cooldown: number,
    singletarget?: boolean
}

interface BaseJob {
    title: string;
    abbr: JobAbbreviation;
    abilities: JobAbility[];
}

export type Job =
    | (BaseJob & { role: 'tank'; subrole?: TankSubRole })
    | (BaseJob & { role: 'healer'; subrole?: HealerSubRole })
    | (BaseJob & { role: 'dps'; subrole?: DpsSubRole });